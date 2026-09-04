import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  applyCashPaymentFee,
  applySystemPayment,
  generatePixPayload,
  getCardSummary,
  releaseProviderPayout
} from '../services/finance.js';

const router = Router();

const validStatuses = ['SOLICITADO', 'ACEITO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'];

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const idField = req.user.role === 'CLIENTE' ? 'sr.client_id' : 'sr.provider_id';
    const rows = await query(
      `SELECT
        sr.*,
        s.title AS service_title,
        client.name AS client_name,
        provider.name AS provider_name,
        p.status AS payment_status,
        p.method AS payment_method,
        p.pix_code,
        p.pix_qr_payload,
        p.card_brand,
        p.card_last4,
        p.provider_fee_status,
        p.paid_at,
        r.rating AS review_rating,
        r.comment AS review_comment
      FROM service_requests sr
      JOIN services s ON s.id = sr.service_id
      JOIN users client ON client.id = sr.client_id
      JOIN users provider ON provider.id = sr.provider_id
      LEFT JOIN payments p ON p.request_id = sr.id
      LEFT JOIN reviews r ON r.request_id = sr.id
      WHERE ${idField} = ?
      ORDER BY sr.created_at DESC`,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticate, authorize('CLIENTE'), async (req, res, next) => {
  const { serviceId, scheduledAt, address, notes, paymentMethod = 'PIX', card = {} } = req.body;

  if (!serviceId) {
    return res.status(400).json({ message: 'Informe o servico desejado.' });
  }

  if (!['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Forma de pagamento invalida.' });
  }

  if (paymentMethod.startsWith('CARTAO')) {
    const digits = String(card.number || '').replace(/\D/g, '');
    if (!card.holderName || digits.length < 13 || !card.expiry || !card.cvv) {
      return res.status(400).json({ message: 'Informe os dados do cartao para concluir o pagamento.' });
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [subscriptions] = await connection.execute(
      `SELECT p.id, p.max_requests_per_month
      FROM client_subscriptions cs
      JOIN plans p ON p.id = cs.plan_id
      WHERE cs.client_id = ? AND cs.status = 'ATIVA' AND p.target_role = 'CLIENTE' AND p.is_active = TRUE
      ORDER BY cs.created_at DESC
      LIMIT 1`,
      [req.user.id]
    );
    let clientPlan = subscriptions[0];

    if (!clientPlan) {
      const [freePlans] = await connection.execute(
        `SELECT id, max_requests_per_month
        FROM plans
        WHERE target_role = 'CLIENTE' AND monthly_price = 0 AND is_active = TRUE
        ORDER BY id ASC
        LIMIT 1`
      );
      clientPlan = freePlans[0];

      if (clientPlan) {
        await connection.execute(
          `INSERT INTO client_subscriptions (client_id, plan_id, status, starts_at, ends_at)
          VALUES (?, ?, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
          [req.user.id, clientPlan.id]
        );
      }
    }

    if (clientPlan?.max_requests_per_month !== null && clientPlan?.max_requests_per_month !== undefined) {
      const [usageRows] = await connection.execute(
        `SELECT COUNT(*) AS requests_count
        FROM service_requests
        WHERE client_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
        [req.user.id]
      );

      if (Number(usageRows[0]?.requests_count || 0) >= Number(clientPlan.max_requests_per_month)) {
        await connection.rollback();
        return res.status(403).json({
          message: 'Voce atingiu o limite mensal do seu plano de cliente. Altere o plano para solicitar mais servicos.'
        });
      }
    }

    const [services] = await connection.execute(
      `SELECT
        s.id,
        s.provider_id,
        s.price,
        COALESCE(p.commission_rate, 12.00) AS commission_rate
      FROM services s
      LEFT JOIN provider_subscriptions ps
        ON ps.provider_id = s.provider_id AND ps.status = 'ATIVA'
      LEFT JOIN plans p
        ON p.id = ps.plan_id AND p.target_role = 'PRESTADOR' AND p.is_active = TRUE
      WHERE s.id = ? AND s.status = 'ATIVO'
      ORDER BY ps.created_at DESC
      LIMIT 1`,
      [serviceId]
    );
    const service = services[0];

    if (!service) {
      await connection.rollback();
      return res.status(404).json({ message: 'Servico nao encontrado ou indisponivel.' });
    }

    const totalAmount = Number(service.price);
    const platformFee = Number((totalAmount * (Number(service.commission_rate) / 100)).toFixed(2));
    const providerAmount = Number((totalAmount - platformFee).toFixed(2));

    const [requestResult] = await connection.execute(
      `INSERT INTO service_requests
        (client_id, service_id, provider_id, scheduled_at, address, notes, total_amount, platform_fee, provider_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        service.id,
        service.provider_id,
        scheduledAt || null,
        address || null,
        notes || null,
        totalAmount,
        platformFee,
        providerAmount
      ]
    );

    const request = {
      id: requestResult.insertId,
      provider_id: service.provider_id,
      total_amount: totalAmount,
      platform_fee: platformFee,
      provider_amount: providerAmount
    };
    let paymentStatus = 'PENDENTE';
    let pix = { code: null, payload: null };
    let cardSummary = { brand: null, last4: null };
    let providerFeeStatus = 'NAO_APLICA';

    if (paymentMethod === 'PIX') {
      pix = generatePixPayload({ requestId: request.id, amount: totalAmount, payerName: req.user.name });
    }

    if (paymentMethod.startsWith('CARTAO')) {
      paymentStatus = 'PAGO';
      cardSummary = getCardSummary(card);
    }

    if (paymentMethod === 'DINHEIRO') {
      paymentStatus = 'PAGO';
      providerFeeStatus = await applyCashPaymentFee(connection, request);
    }

    await connection.execute(
      `INSERT INTO payments
        (request_id, payer_id, amount, method, status, pix_code, pix_qr_payload, card_brand, card_last4, provider_fee_status, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        req.user.id,
        totalAmount,
        paymentMethod,
        paymentStatus,
        pix.code,
        pix.payload,
        cardSummary.brand,
        cardSummary.last4,
        providerFeeStatus,
        paymentStatus === 'PAGO' ? new Date() : null
      ]
    );

    if (paymentMethod.startsWith('CARTAO')) {
      await applySystemPayment(connection, request);
    }

    await connection.commit();
    return res.status(201).json({
      id: request.id,
      message:
        paymentMethod === 'PIX'
          ? 'Solicitacao criada. Use o QR Code PIX para concluir o pagamento.'
          : paymentMethod === 'DINHEIRO'
            ? 'Solicitacao criada com pagamento em dinheiro ao prestador. A taxa da plataforma foi registrada.'
            : 'Solicitacao criada e pagamento aprovado pelo sistema.',
      payment: {
        method: paymentMethod,
        status: paymentStatus,
        pix_code: pix.code,
        pix_qr_payload: pix.payload,
        card_brand: cardSummary.brand,
        card_last4: cardSummary.last4,
        provider_fee_status: providerFeeStatus
      }
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/:id/status', authenticate, authorize('CLIENTE', 'PRESTADOR', 'ADMIN'), async (req, res, next) => {
  const { status } = req.body;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Status invalido.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const ownershipCheck =
      req.user.role === 'PRESTADOR'
        ? 'AND sr.provider_id = ?'
        : req.user.role === 'CLIENTE'
          ? 'AND sr.client_id = ?'
          : '';
    const params = req.user.role === 'ADMIN'
      ? [req.params.id]
      : [req.params.id, req.user.id];
    const [requests] = await connection.execute(
      `SELECT
        sr.id,
        sr.client_id,
        sr.provider_id,
        sr.total_amount,
        sr.platform_fee,
        sr.provider_amount,
        sr.status,
        p.status AS payment_status,
        p.method AS payment_method,
        p.provider_fee_status
      FROM service_requests sr
      LEFT JOIN payments p ON p.request_id = sr.id
      WHERE sr.id = ? ${ownershipCheck}
      LIMIT 1
      FOR UPDATE`,
      params
    );
    const request = requests[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (req.user.role === 'CLIENTE') {
      if (status !== 'CANCELADO') {
        await connection.rollback();
        return res.status(403).json({ message: 'Clientes podem apenas cancelar a propria solicitacao.' });
      }

      if (request.status === 'CONCLUIDO') {
        await connection.rollback();
        return res.status(409).json({ message: 'Solicitacao concluida nao pode ser cancelada automaticamente.' });
      }
    }

    if (status === 'CANCELADO') {
      const [existingPayouts] = await connection.execute(
        "SELECT id FROM financial_transactions WHERE request_id = ? AND type = 'REPASSE_PRESTADOR' LIMIT 1",
        [request.id]
      );

      if (existingPayouts[0]) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Esta solicitacao ja teve repasse liberado. O cancelamento precisa ser tratado pelo administrador.'
        });
      }

      if (request.payment_status === 'PAGO' && request.payment_method !== 'DINHEIRO') {
        await connection.execute(
          "UPDATE payments SET status = 'ESTORNADO' WHERE request_id = ?",
          [request.id]
        );

        await connection.execute(
          `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
          SELECT ?, ?, 'ESTORNO', ?, 'Pagamento estornado por cancelamento da solicitacao'
          WHERE NOT EXISTS (
            SELECT 1 FROM financial_transactions
            WHERE request_id = ? AND type = 'ESTORNO'
          )`,
          [request.id, request.provider_id, request.total_amount, request.id]
        );
      }

      if (request.payment_status === 'PAGO' && request.payment_method === 'DINHEIRO') {
        const [feeRows] = await connection.execute(
          `SELECT
            COALESCE(SUM(CASE WHEN type = 'TAXA_DINHEIRO_COBRADA' THEN amount ELSE 0 END), 0) AS charged,
            COALESCE(SUM(CASE WHEN type = 'TAXA_DINHEIRO_PENDENTE' THEN amount ELSE 0 END), 0) AS pending
          FROM financial_transactions
          WHERE request_id = ?`,
          [request.id]
        );
        const charged = Number(feeRows[0]?.charged || 0);
        const pending = Number(feeRows[0]?.pending || 0);

        await connection.execute(
          "UPDATE payments SET status = 'ESTORNADO', provider_fee_status = 'NAO_APLICA' WHERE request_id = ?",
          [request.id]
        );

        await connection.execute(
          `INSERT IGNORE INTO provider_balances (provider_id, available_amount, pending_fee_amount)
          VALUES (?, 0, 0)`,
          [request.provider_id]
        );
        await connection.execute(
          `UPDATE provider_balances
          SET available_amount = available_amount + ?, pending_fee_amount = GREATEST(pending_fee_amount - ?, 0)
          WHERE provider_id = ?`,
          [charged, pending, request.provider_id]
        );

        if (charged > 0 || pending > 0) {
          await connection.execute(
            `INSERT INTO financial_transactions (request_id, provider_id, type, amount, description)
            VALUES (?, ?, 'ESTORNO', ?, 'Cancelamento em dinheiro. Taxa da plataforma estornada ou dispensada')`,
            [request.id, request.provider_id, Number((charged + pending).toFixed(2))]
          );
        }
      }
    }

    if (['ACEITO', 'EM_ANDAMENTO', 'CONCLUIDO'].includes(status) && request.payment_status !== 'PAGO') {
      await connection.rollback();
      return res.status(403).json({
        message: 'A solicitacao ainda aguarda confirmacao de pagamento. O prestador so pode aceitar ou concluir apos o pagamento.'
      });
    }

    await connection.execute(
      'UPDATE service_requests SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    const payoutReleased = status === 'CONCLUIDO'
      ? await releaseProviderPayout(connection, request)
      : false;

    await connection.commit();
    return res.json({
      message: payoutReleased
        ? 'Servico finalizado e valor liberado para saque.'
        : 'Solicitacao atualizada.'
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', authenticate, authorize('CLIENTE', 'PRESTADOR'), async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const ownerField = req.user.role === 'CLIENTE' ? 'client_id' : 'provider_id';
    const [requests] = await connection.execute(
      `SELECT id, status
      FROM service_requests
      WHERE id = ? AND ${ownerField} = ?
      LIMIT 1
      FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    const request = requests[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (!['CONCLUIDO', 'CANCELADO'].includes(request.status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Somente solicitacoes concluidas ou canceladas podem ser excluidas.' });
    }

    await connection.execute('DELETE FROM service_request_messages WHERE request_id = ?', [request.id]);
    await connection.execute('DELETE FROM reviews WHERE request_id = ?', [request.id]);
    await connection.execute('DELETE FROM payments WHERE request_id = ?', [request.id]);
    await connection.execute('DELETE FROM financial_transactions WHERE request_id = ?', [request.id]);
    await connection.execute('DELETE FROM service_requests WHERE id = ?', [request.id]);

    await connection.commit();
    return res.json({ message: 'Solicitacao excluida do historico.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/:id/pay', authenticate, authorize('ADMIN'), async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.execute(
      `SELECT
        sr.id,
        sr.provider_id,
        sr.total_amount,
        sr.platform_fee,
        sr.provider_amount,
        p.status AS payment_status
      FROM service_requests sr
      LEFT JOIN payments p ON p.request_id = sr.id
      WHERE sr.id = ?
      LIMIT 1`,
      [req.params.id]
    );
    const request = requests[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (request.payment_status === 'PAGO') {
      await connection.rollback();
      return res.json({ message: 'Pagamento ja estava confirmado.' });
    }

    await connection.execute(
      "UPDATE payments SET status = 'PAGO', paid_at = NOW() WHERE request_id = ?",
      [req.params.id]
    );
    await applySystemPayment(connection, request);

    await connection.commit();
    return res.json({ message: 'Pagamento confirmado e financeiro atualizado.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/:id/confirm-payment', authenticate, authorize('CLIENTE'), async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.execute(
      `SELECT
        sr.id,
        sr.provider_id,
        sr.total_amount,
        sr.platform_fee,
        sr.provider_amount,
        p.status AS payment_status,
        p.method AS payment_method
      FROM service_requests sr
      JOIN payments p ON p.request_id = sr.id
      WHERE sr.id = ? AND sr.client_id = ?
      LIMIT 1`,
      [req.params.id, req.user.id]
    );
    const request = requests[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pagamento nao encontrado.' });
    }

    if (request.payment_status === 'PAGO') {
      await connection.rollback();
      return res.json({ message: 'Pagamento ja estava confirmado.' });
    }

    if (request.payment_method !== 'PIX') {
      await connection.rollback();
      return res.status(400).json({ message: 'A confirmacao manual esta disponivel apenas para PIX pendente.' });
    }

    await connection.execute(
      "UPDATE payments SET status = 'PAGO', paid_at = NOW() WHERE request_id = ?",
      [req.params.id]
    );
    await applySystemPayment(connection, request);

    await connection.commit();
    return res.json({ message: 'Pagamento PIX confirmado e repasse reservado ao prestador.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
