import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateBoletoPayload } from '../services/finance.js';

const router = Router();

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function normalizePlan(plan) {
  return {
    ...plan,
    monthly_price: toNumber(plan.monthly_price),
    commission_rate: toNumber(plan.commission_rate),
    max_services: plan.max_services === null ? null : Number(plan.max_services),
    max_requests_per_month: plan.max_requests_per_month === null ? null : Number(plan.max_requests_per_month),
    provider_subscriptions: Number(plan.provider_subscriptions || 0),
    client_subscriptions: Number(plan.client_subscriptions || 0),
    active_subscriptions: Number(plan.active_subscriptions || 0),
    monthly_recurring_revenue: toNumber(plan.monthly_recurring_revenue || 0)
  };
}

function subscriptionTableFor(role) {
  return role === 'CLIENTE'
    ? { table: 'client_subscriptions', userField: 'client_id', usageField: 'requests_count' }
    : { table: 'provider_subscriptions', userField: 'provider_id', usageField: 'services_count' };
}


router.get('/', async (req, res, next) => {
  try {
    const { targetRole } = req.query;
    const params = [];
    const filters = ['is_active = TRUE'];

    if (targetRole && ['CLIENTE', 'PRESTADOR'].includes(targetRole)) {
      filters.push('target_role = ?');
      params.push(targetRole);
    }

    const plans = await query(
      `SELECT id, name, description, target_role, monthly_price, commission_rate, max_services, max_requests_per_month, support_level, is_active
      FROM plans
      WHERE ${filters.join(' AND ')}
      ORDER BY target_role ASC, monthly_price ASC`,
      params
    );

    return res.json(plans.map(normalizePlan));
  } catch (error) {
    return next(error);
  }
});

router.get('/mine', authenticate, authorize('CLIENTE', 'PRESTADOR'), async (req, res, next) => {
  try {
    const targetRole = req.user.role;
    const config = subscriptionTableFor(targetRole);

    // Mantem o estado comercial consistente antes de devolver o plano atual.
    // 1) Assinaturas vencidas deixam de ser ativas.
    await query(
      `UPDATE ${config.table}
       SET status = 'CANCELADA'
       WHERE ${config.userField} = ?
         AND status = 'ATIVA'
         AND ends_at IS NOT NULL
         AND ends_at <= NOW()`,
      [req.user.id]
    );

    // 2) Boleto vencido nao pode continuar bloqueando a selecao de outro plano.
    await query(
      `UPDATE plan_billing
       SET status = 'CANCELADO', canceled_at = COALESCE(canceled_at, NOW())
       WHERE user_id = ?
         AND target_role = ?
         AND status = 'PENDENTE'
         AND due_date < CURDATE()`,
      [req.user.id, targetRole]
    );

    // 3) Plano pago so e uma assinatura valida se existir pagamento confirmado
    //    para o mesmo usuario, perfil e plano. Isso corrige registros antigos
    //    que tenham sido gravados como ATIVA sem a cobranca ter sido paga.
    await query(
      `UPDATE ${config.table} sub
       JOIN plans p ON p.id = sub.plan_id
       SET sub.status = 'CANCELADA',
           sub.ends_at = LEAST(COALESCE(sub.ends_at, NOW()), NOW())
       WHERE sub.${config.userField} = ?
         AND sub.status = 'ATIVA'
         AND p.target_role = ?
         AND p.monthly_price > 0
         AND NOT EXISTS (
           SELECT 1
           FROM plan_billing pb
           WHERE pb.user_id = ?
             AND pb.target_role = ?
             AND pb.plan_id = sub.plan_id
             AND pb.status = 'PAGO'
         )`,
      [req.user.id, targetRole, req.user.id, targetRole]
    );

    // 4) Garante no maximo uma assinatura ativa por usuario/perfil.
    //    Mantem a assinatura ativa mais recente e encerra duplicidades antigas.
    await query(
      `UPDATE ${config.table}
       SET status = 'CANCELADA',
           ends_at = LEAST(COALESCE(ends_at, NOW()), NOW())
       WHERE ${config.userField} = ?
         AND status = 'ATIVA'
         AND id <> COALESCE((
           SELECT keep_id
           FROM (
             SELECT id AS keep_id
             FROM ${config.table}
             WHERE ${config.userField} = ?
               AND status = 'ATIVA'
               AND (ends_at IS NULL OR ends_at > NOW())
             ORDER BY created_at DESC, id DESC
             LIMIT 1
           ) latest
         ), -1)`,
      [req.user.id, req.user.id]
    );

    const usageQuery =
      targetRole === 'CLIENTE'
        ? `SELECT COUNT(*) AS requests_count
          FROM service_requests
          WHERE client_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`
        : 'SELECT COUNT(*) AS services_count FROM services WHERE provider_id = ?';

    const [plans, subscriptions, usageRows, billings] = await Promise.all([
      query(
        `SELECT id, name, description, target_role, monthly_price, commission_rate, max_services, max_requests_per_month, support_level, is_active
        FROM plans
        WHERE is_active = TRUE AND target_role = ?
        ORDER BY monthly_price ASC`,
        [targetRole]
      ),
      query(
        `SELECT
          sub.id AS subscription_id,
          sub.status AS subscription_status,
          sub.starts_at,
          sub.ends_at,
          p.id,
          p.name,
          p.description,
          p.target_role,
          p.monthly_price,
          p.commission_rate,
          p.max_services,
          p.max_requests_per_month,
          p.support_level,
          p.is_active
        FROM ${config.table} sub
        JOIN plans p ON p.id = sub.plan_id
        WHERE sub.${config.userField} = ? AND sub.status = 'ATIVA' AND (sub.ends_at IS NULL OR sub.ends_at > NOW()) AND p.target_role = ?
        ORDER BY sub.created_at DESC
        LIMIT 1`,
        [req.user.id, targetRole]
      ),
      query(usageQuery, [req.user.id]),
      query(
        `SELECT
          pb.id,
          pb.plan_id,
          pb.amount,
          pb.status,
          pb.boleto_code,
          pb.digitable_line,
          pb.due_date,
          pb.paid_at,
          pb.canceled_at,
          pb.created_at,
          p.name AS plan_name
        FROM plan_billing pb
        JOIN plans p ON p.id = pb.plan_id
        WHERE pb.user_id = ? AND pb.target_role = ?
        ORDER BY pb.created_at DESC
        LIMIT 10`,
        [req.user.id, targetRole]
      )
    ]);

    let subscription = subscriptions[0] ? normalizePlan(subscriptions[0]) : null;

    if (!subscription) {
      const freePlan = plans.find((plan) => Number(plan.monthly_price || 0) === 0);
      if (freePlan) {
        await query(
          `UPDATE ${config.table} SET status = 'CANCELADA', ends_at = LEAST(COALESCE(ends_at, NOW()), NOW())
           WHERE ${config.userField} = ? AND status = 'ATIVA'`,
          [req.user.id]
        );
        await query(
          `INSERT INTO ${config.table} (${config.userField}, plan_id, status, starts_at, ends_at)
          VALUES (?, ?, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
          [req.user.id, freePlan.id]
        );
        subscription = normalizePlan({ ...freePlan, subscription_status: 'ATIVA' });
      }
    }

    return res.json({
      plans: plans.map(normalizePlan),
      subscription,
      usage: {
        [config.usageField]: Number(usageRows[0]?.[config.usageField] || 0)
      },
      billings: billings.map((billing) => ({
        ...billing,
        amount: Number(billing.amount || 0)
      }))
    });
  } catch (error) {
    return next(error);
  }
});
router.post('/subscribe', authenticate, authorize('CLIENTE', 'PRESTADOR'), async (req, res, next) => {
  const { planId } = req.body;

  const normalizedPlanId = Number(planId);
  if (!Number.isInteger(normalizedPlanId) || normalizedPlanId <= 0) {
    return res.status(400).json({ message: 'Informe um plano valido.' });
  }

  const connection = await pool.getConnection();
  const targetRole = req.user.role;
  const config = subscriptionTableFor(targetRole);

  try {
    await connection.beginTransaction();

    const [plans] = await connection.execute(
      `SELECT id, name, monthly_price, max_services, max_requests_per_month
      FROM plans
      WHERE id = ? AND target_role = ? AND is_active = TRUE
      LIMIT 1`,
      [normalizedPlanId, targetRole]
    );
    const plan = plans[0];

    if (!plan) {
      await connection.rollback();
      return res.status(404).json({ message: 'Plano nao encontrado ou indisponivel para seu perfil.' });
    }

    if (targetRole === 'PRESTADOR' && plan.max_services !== null) {
      const [serviceCounts] = await connection.execute(
        'SELECT COUNT(*) AS services_count FROM services WHERE provider_id = ?',
        [req.user.id]
      );
      const currentServices = Number(serviceCounts[0]?.services_count || 0);

      if (currentServices > Number(plan.max_services)) {
        await connection.rollback();
        return res.status(409).json({
          message: 'Este plano possui limite menor que a quantidade de servicos ja cadastrados.'
        });
      }
    }

    const [pendingBillings] = await connection.execute(
      `SELECT id, plan_id, amount, boleto_code, digitable_line, due_date
      FROM plan_billing
      WHERE user_id = ? AND target_role = ? AND status = 'PENDENTE' AND due_date >= CURDATE()
      ORDER BY created_at DESC
      LIMIT 1`,
      [req.user.id, targetRole]
    );

    if (pendingBillings[0]) {
      const billing = pendingBillings[0];
      await connection.rollback();
      return res.status(200).json({
        message: billing.plan_id === normalizedPlanId ? 'Ja existe um boleto pendente para este plano.' : 'Ja existe um boleto pendente para outro plano. Cancele-o antes de selecionar um novo plano.',
        payment: {
          method: 'BOLETO',
          status: 'PENDENTE',
          planId: billing.plan_id,
          amount: Number(billing.amount),
          boleto_code: billing.boleto_code,
          digitable_line: billing.digitable_line,
          due_date: billing.due_date
        }
      });
    }

    const monthlyPrice = Number(plan.monthly_price || 0);
    let payment = null;

    if (monthlyPrice > 0) {
      const boleto = generateBoletoPayload({
        referenceId: `PLANO-${req.user.id}-${normalizedPlanId}`,
        amount: monthlyPrice,
        payerName: req.user.name,
        type: 'PLANO'
      });
      await connection.execute(
        `INSERT INTO plan_billing
          (user_id, target_role, plan_id, amount, boleto_code, digitable_line, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, targetRole, normalizedPlanId, monthlyPrice, boleto.code, boleto.digitableLine, boleto.dueDate]
      );
      payment = {
        method: 'BOLETO',
        status: 'PENDENTE',
        amount: monthlyPrice,
        boleto_code: boleto.code,
        digitable_line: boleto.digitableLine,
        due_date: boleto.dueDate
      };
    } else {
      await connection.execute(
        `UPDATE ${config.table}
        SET status = 'CANCELADA', ends_at = NOW()
        WHERE ${config.userField} = ? AND status = 'ATIVA'`,
        [req.user.id]
      );
      await connection.execute(
        `INSERT INTO ${config.table} (${config.userField}, plan_id, status, starts_at, ends_at)
        VALUES (?, ?, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [req.user.id, normalizedPlanId]
      );
    }

    await connection.commit();
    return res.status(201).json({
      message: payment ? 'Boleto gerado com sucesso. O plano sera ativado apos a confirmacao do pagamento.' : 'Plano atualizado com sucesso.',
      payment
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/billing/:id/cancel', authenticate, authorize('CLIENTE', 'PRESTADOR'), async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [billings] = await connection.execute(
      `SELECT id
      FROM plan_billing
      WHERE id = ? AND user_id = ? AND target_role = ? AND status = 'PENDENTE'
      LIMIT 1
      FOR UPDATE`,
      [req.params.id, req.user.id, req.user.role]
    );

    if (!billings[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Boleto pendente nao encontrado.' });
    }

    await connection.execute(
      `UPDATE plan_billing
      SET status = 'CANCELADO', canceled_at = NOW()
      WHERE id = ?`,
      [billings[0].id]
    );

    await connection.commit();
    return res.json({ message: 'Plano cancelado. Os outros planos foram liberados.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/admin/summary', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    const plans = await query(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.target_role,
        p.monthly_price,
        p.commission_rate,
        p.max_services,
        p.max_requests_per_month,
        p.support_level,
        p.is_active,
        COUNT(DISTINCT CASE WHEN ps.status = 'ATIVA' THEN ps.id END) AS provider_subscriptions,
        COUNT(DISTINCT CASE WHEN cs.status = 'ATIVA' THEN cs.id END) AS client_subscriptions,
        COUNT(DISTINCT CASE WHEN ps.status = 'ATIVA' THEN ps.id END) +
          COUNT(DISTINCT CASE WHEN cs.status = 'ATIVA' THEN cs.id END) AS active_subscriptions,
        p.monthly_price * (
          COUNT(DISTINCT CASE WHEN ps.status = 'ATIVA' THEN ps.id END) +
          COUNT(DISTINCT CASE WHEN cs.status = 'ATIVA' THEN cs.id END)
        ) AS monthly_recurring_revenue
      FROM plans p
      LEFT JOIN provider_subscriptions ps ON ps.plan_id = p.id
      LEFT JOIN client_subscriptions cs ON cs.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.target_role DESC, p.monthly_price ASC`
    );

    const normalizedPlans = plans.map(normalizePlan);
    const activeSubscriptions = normalizedPlans.reduce(
      (total, plan) => total + Number(plan.active_subscriptions || 0),
      0
    );
    const monthlyRecurringRevenue = normalizedPlans.reduce(
      (total, plan) => total + Number(plan.monthly_recurring_revenue || 0),
      0
    );

    return res.json({
      plans: normalizedPlans,
      totals: {
        active_subscriptions: activeSubscriptions,
        monthly_recurring_revenue: monthlyRecurringRevenue,
        active_plans: normalizedPlans.filter((plan) => Boolean(plan.is_active)).length,
        client_plans: normalizedPlans.filter((plan) => plan.target_role === 'CLIENTE').length,
        provider_plans: normalizedPlans.filter((plan) => plan.target_role === 'PRESTADOR').length
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      targetRole = 'PRESTADOR',
      monthlyPrice,
      commissionRate = 0,
      maxServices,
      maxRequestsPerMonth,
      supportLevel,
      isActive = true
    } = req.body;

    if (!['CLIENTE', 'PRESTADOR'].includes(targetRole)) {
      return res.status(400).json({ message: 'Publico do plano invalido.' });
    }

    if (!name || !description || monthlyPrice === undefined) {
      return res.status(400).json({ message: 'Nome, descricao e mensalidade sao obrigatorios.' });
    }

    const result = await query(
      `INSERT INTO plans
        (name, description, target_role, monthly_price, commission_rate, max_services, max_requests_per_month, support_level, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        targetRole,
        Number(monthlyPrice),
        targetRole === 'PRESTADOR' ? Number(commissionRate) : 0,
        targetRole === 'PRESTADOR' && maxServices !== '' && maxServices !== undefined ? Number(maxServices) : null,
        targetRole === 'CLIENTE' && maxRequestsPerMonth !== '' && maxRequestsPerMonth !== undefined ? Number(maxRequestsPerMonth) : null,
        supportLevel || 'Padrao',
        Boolean(isActive)
      ]
    );

    return res.status(201).json({ id: result.insertId, message: 'Plano criado com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      targetRole,
      monthlyPrice,
      commissionRate,
      maxServices,
      maxRequestsPerMonth,
      supportLevel,
      isActive
    } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (targetRole !== undefined) {
      if (!['CLIENTE', 'PRESTADOR'].includes(targetRole)) {
        return res.status(400).json({ message: 'Publico do plano invalido.' });
      }
      updates.push('target_role = ?');
      params.push(targetRole);
    }

    if (monthlyPrice !== undefined) {
      updates.push('monthly_price = ?');
      params.push(Number(monthlyPrice));
    }

    if (commissionRate !== undefined) {
      updates.push('commission_rate = ?');
      params.push(Number(commissionRate));
    }

    if (maxServices !== undefined) {
      updates.push('max_services = ?');
      params.push(maxServices === '' ? null : Number(maxServices));
    }

    if (maxRequestsPerMonth !== undefined) {
      updates.push('max_requests_per_month = ?');
      params.push(maxRequestsPerMonth === '' ? null : Number(maxRequestsPerMonth));
    }

    if (supportLevel !== undefined) {
      updates.push('support_level = ?');
      params.push(supportLevel);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(Boolean(isActive));
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'Informe ao menos um campo para atualizar.' });
    }

    params.push(req.params.id);

    const result = await query(
      `UPDATE plans SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Plano nao encontrado.' });
    }

    return res.json({ message: 'Plano atualizado com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
