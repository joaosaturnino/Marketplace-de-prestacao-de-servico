import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/overview', async (_req, res, next) => {
  try {
    const [users] = await query(
      `SELECT
        SUM(role = 'CLIENTE') AS clients,
        SUM(role = 'PRESTADOR') AS providers,
        SUM(role = 'ADMIN') AS admins
      FROM users`
    );

    const [requests] = await query(
      `SELECT
        COUNT(*) AS total_requests,
        SUM(status = 'CONCLUIDO') AS completed_requests,
        COALESCE(SUM(total_amount), 0) AS gross_volume,
        COALESCE(SUM(platform_fee), 0) AS platform_revenue,
        COALESCE(SUM(provider_amount), 0) AS provider_payable
      FROM service_requests`
    );

    const [payments] = await query(
      `SELECT
        COALESCE(SUM(status = 'PAGO'), 0) AS paid,
        COALESCE(SUM(status = 'PENDENTE'), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'PAGO' THEN amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'PENDENTE' THEN amount ELSE 0 END), 0) AS pending_amount
      FROM payments`
    );

    const [quality] = await query(
      `SELECT
        COUNT(*) AS reviews,
        COALESCE(ROUND(AVG(rating), 2), 0) AS average_rating
      FROM reviews`
    );

    return res.json({ users, requests, payments, quality });
  } catch (error) {
    return next(error);
  }
});

router.get('/requests', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT
        sr.id,
        sr.status,
        sr.total_amount,
        sr.platform_fee,
        sr.provider_amount,
        sr.created_at,
        s.title AS service_title,
        client.name AS client_name,
        provider.name AS provider_name,
        p.status AS payment_status,
        p.method AS payment_method,
        p.pix_code,
        p.card_brand,
        p.card_last4,
        p.provider_fee_status,
        p.paid_at,
        r.rating AS review_rating
      FROM service_requests sr
      JOIN services s ON s.id = sr.service_id
      JOIN users client ON client.id = sr.client_id
      JOIN users provider ON provider.id = sr.provider_id
      LEFT JOIN payments p ON p.request_id = sr.id
      LEFT JOIN reviews r ON r.request_id = sr.id
      ORDER BY sr.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/transactions', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, request_id, provider_id, type, amount, description, created_at
      FROM financial_transactions
      ORDER BY created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/withdrawals', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT
        w.id,
        w.provider_id,
        w.amount,
        w.method,
        w.status,
        w.created_at,
        w.paid_at,
        u.name AS provider_name,
        u.email AS provider_email,
        ppa.pix_key,
        ppa.bank_name,
        ppa.agency,
        ppa.account_number,
        ppa.account_type,
        ppa.holder_name,
        ppa.document
      FROM withdrawals w
      JOIN users u ON u.id = w.provider_id
      LEFT JOIN provider_payout_accounts ppa ON ppa.provider_id = w.provider_id
      ORDER BY w.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.patch('/withdrawals/:id/status', async (req, res, next) => {
  const { status } = req.body;

  if (!['PROCESSANDO', 'PAGO', 'RECUSADO'].includes(status)) {
    return res.status(400).json({ message: 'Status de saque invalido.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [withdrawals] = await connection.execute(
      `SELECT id, provider_id, amount, status
      FROM withdrawals
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
      [req.params.id]
    );
    const withdrawal = withdrawals[0];

    if (!withdrawal) {
      await connection.rollback();
      return res.status(404).json({ message: 'Saque nao encontrado.' });
    }

    if (withdrawal.status === 'PAGO' && status !== 'PAGO') {
      await connection.rollback();
      return res.status(409).json({ message: 'Saque pago nao pode ser alterado automaticamente.' });
    }

    if (withdrawal.status === 'RECUSADO' && status !== 'RECUSADO') {
      await connection.rollback();
      return res.status(409).json({ message: 'Saque recusado precisa ser solicitado novamente pelo prestador.' });
    }

    if (status === 'RECUSADO' && withdrawal.status !== 'RECUSADO') {
      await connection.execute(
        `INSERT IGNORE INTO provider_balances (provider_id, available_amount, pending_fee_amount)
        VALUES (?, 0, 0)`,
        [withdrawal.provider_id]
      );
      await connection.execute(
        'UPDATE provider_balances SET available_amount = available_amount + ? WHERE provider_id = ?',
        [withdrawal.amount, withdrawal.provider_id]
      );
      await connection.execute(
        `INSERT INTO financial_transactions (provider_id, type, amount, description)
        VALUES (?, 'ESTORNO', ?, 'Saque recusado. Valor devolvido ao saldo do prestador')`,
        [withdrawal.provider_id, withdrawal.amount]
      );
    }

    await connection.execute(
      `UPDATE withdrawals
      SET status = ?, paid_at = CASE WHEN ? = 'PAGO' THEN NOW() ELSE paid_at END
      WHERE id = ?`,
      [status, status, req.params.id]
    );

    await connection.commit();
    return res.json({ message: 'Status do saque atualizado.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.created_at,
        COALESCE(cp.phone, pp.phone) AS phone,
        COALESCE(cp.city, pp.city) AS city,
        COALESCE(cp.state, pp.state) AS state,
        pp.document,
        pp.rating,
        pp.is_verified,
        COALESCE(provider_plan.name, client_plan.name) AS plan_name,
        COALESCE(provider_plan.commission_rate, client_plan.commission_rate) AS commission_rate,
        (SELECT COUNT(*) FROM services s WHERE s.provider_id = u.id) AS services_count,
        (SELECT COUNT(*) FROM service_requests sr WHERE sr.client_id = u.id OR sr.provider_id = u.id) AS requests_count,
        (SELECT COALESCE(SUM(sr.total_amount), 0) FROM service_requests sr WHERE sr.client_id = u.id OR sr.provider_id = u.id) AS gross_volume
      FROM users u
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      LEFT JOIN provider_profiles pp ON pp.user_id = u.id
      LEFT JOIN provider_subscriptions ps ON ps.provider_id = u.id AND ps.status = 'ATIVA'
      LEFT JOIN plans provider_plan ON provider_plan.id = ps.plan_id
      LEFT JOIN client_subscriptions cs ON cs.client_id = u.id AND cs.status = 'ATIVA'
      LEFT JOIN plans client_plan ON client_plan.id = cs.plan_id
      ORDER BY u.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['ATIVO', 'BLOQUEADO'].includes(status)) {
      return res.status(400).json({ message: 'Status invalido.' });
    }

    if (Number(req.params.id) === req.user.id && status === 'BLOQUEADO') {
      return res.status(400).json({ message: 'Voce nao pode bloquear sua propria conta.' });
    }

    const result = await query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    return res.json({ message: 'Status do usuario atualizado.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/providers/:id/verification', async (req, res, next) => {
  try {
    const { isVerified } = req.body;

    const result = await query(
      `UPDATE provider_profiles pp
      JOIN users u ON u.id = pp.user_id
      SET pp.is_verified = ?
      WHERE pp.user_id = ? AND u.role = 'PRESTADOR'`,
      [Boolean(isVerified), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Prestador nao encontrado.' });
    }

    return res.json({ message: 'Verificacao do prestador atualizada.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
