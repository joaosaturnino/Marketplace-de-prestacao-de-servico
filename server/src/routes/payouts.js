import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureProviderBalance, settlePendingFees } from '../services/finance.js';

const router = Router();

router.use(authenticate, authorize('PRESTADOR'));

router.get('/account', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      await ensureProviderBalance(connection, req.user.id);
    } finally {
      connection.release();
    }

    const [accounts, balances, withdrawals] = await Promise.all([
      query(
        `SELECT payout_method, pix_key, bank_name, agency, account_number, account_type, holder_name, document
        FROM provider_payout_accounts
        WHERE provider_id = ?
        LIMIT 1`,
        [req.user.id]
      ),
      query(
        'SELECT available_amount, pending_fee_amount, updated_at FROM provider_balances WHERE provider_id = ?',
        [req.user.id]
      ),
      query(
        `SELECT id, amount, method, status, created_at, paid_at
        FROM withdrawals
        WHERE provider_id = ?
        ORDER BY created_at DESC`,
        [req.user.id]
      )
    ]);

    return res.json({
      account: accounts[0] || null,
      balance: balances[0] || { available_amount: 0, pending_fee_amount: 0 },
      withdrawals
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/account', async (req, res, next) => {
  try {
    const {
      payoutMethod = 'PIX',
      pixKey,
      bankName,
      agency,
      accountNumber,
      accountType = 'CORRENTE',
      holderName,
      document
    } = req.body;

    if (!['PIX', 'CONTA_BANCARIA'].includes(payoutMethod)) {
      return res.status(400).json({ message: 'Metodo de saque invalido.' });
    }

    if (payoutMethod === 'PIX' && !pixKey) {
      return res.status(400).json({ message: 'Informe a chave PIX para saque.' });
    }

    if (payoutMethod === 'CONTA_BANCARIA' && (!bankName || !agency || !accountNumber)) {
      return res.status(400).json({ message: 'Informe banco, agencia e conta para saque bancario.' });
    }

    await query(
      `INSERT INTO provider_payout_accounts
        (provider_id, payout_method, pix_key, bank_name, agency, account_number, account_type, holder_name, document)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        payout_method = VALUES(payout_method),
        pix_key = VALUES(pix_key),
        bank_name = VALUES(bank_name),
        agency = VALUES(agency),
        account_number = VALUES(account_number),
        account_type = VALUES(account_type),
        holder_name = VALUES(holder_name),
        document = VALUES(document)`,
      [
        req.user.id,
        payoutMethod,
        pixKey || null,
        bankName || null,
        agency || null,
        accountNumber || null,
        accountType,
        holderName || null,
        document || null
      ]
    );

    return res.json({ message: 'Dados de saque salvos com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/withdraw', async (req, res, next) => {
  const { amount, method = 'PIX' } = req.body;
  const withdrawalAmount = Number(amount || 0);

  if (!withdrawalAmount || withdrawalAmount <= 0) {
    return res.status(400).json({ message: 'Informe um valor de saque valido.' });
  }

  if (!['PIX', 'CONTA_BANCARIA'].includes(method)) {
    return res.status(400).json({ message: 'Metodo de saque invalido.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureProviderBalance(connection, req.user.id);
    await settlePendingFees(connection, req.user.id);

    const [accounts] = await connection.execute(
      'SELECT id FROM provider_payout_accounts WHERE provider_id = ? LIMIT 1',
      [req.user.id]
    );

    if (!accounts[0]) {
      await connection.rollback();
      return res.status(400).json({ message: 'Cadastre uma conta de saque antes de solicitar retirada.' });
    }

    const [balances] = await connection.execute(
      'SELECT available_amount, pending_fee_amount FROM provider_balances WHERE provider_id = ? FOR UPDATE',
      [req.user.id]
    );
    const balance = balances[0];
    const available = Number(balance.available_amount || 0);

    if (Number(balance.pending_fee_amount || 0) > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Existe taxa pendente da plataforma. Ela sera compensada no proximo repasse antes de novos saques.'
      });
    }

    if (withdrawalAmount > available) {
      await connection.rollback();
      return res.status(409).json({ message: 'Saldo disponivel insuficiente para este saque.' });
    }

    const [result] = await connection.execute(
      `INSERT INTO withdrawals (provider_id, amount, method, status)
      VALUES (?, ?, ?, 'PROCESSANDO')`,
      [req.user.id, withdrawalAmount, method]
    );

    await connection.execute(
      'UPDATE provider_balances SET available_amount = available_amount - ? WHERE provider_id = ?',
      [withdrawalAmount, req.user.id]
    );
    await connection.execute(
      `INSERT INTO financial_transactions (provider_id, type, amount, description)
      VALUES (?, 'SAQUE_PRESTADOR', ?, 'Saque solicitado pelo prestador')`,
      [req.user.id, withdrawalAmount]
    );

    await connection.commit();
    return res.status(201).json({ id: result.insertId, message: 'Saque solicitado com sucesso.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
