import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

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
    const usageQuery =
      targetRole === 'CLIENTE'
        ? `SELECT COUNT(*) AS requests_count
          FROM service_requests
          WHERE client_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`
        : 'SELECT COUNT(*) AS services_count FROM services WHERE provider_id = ?';

    const [plans, subscriptions, usageRows] = await Promise.all([
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
        WHERE sub.${config.userField} = ? AND sub.status = 'ATIVA' AND p.target_role = ?
        ORDER BY sub.created_at DESC
        LIMIT 1`,
        [req.user.id, targetRole]
      ),
      query(usageQuery, [req.user.id])
    ]);

    let subscription = subscriptions[0] ? normalizePlan(subscriptions[0]) : null;

    if (!subscription) {
      const freePlan = plans.find((plan) => Number(plan.monthly_price || 0) === 0);
      if (freePlan) {
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
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/subscribe', authenticate, authorize('CLIENTE', 'PRESTADOR'), async (req, res, next) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ message: 'Informe o plano desejado.' });
  }

  const connection = await pool.getConnection();
  const targetRole = req.user.role;
  const config = subscriptionTableFor(targetRole);

  try {
    await connection.beginTransaction();

    const [plans] = await connection.execute(
      `SELECT id, max_services, max_requests_per_month
      FROM plans
      WHERE id = ? AND target_role = ? AND is_active = TRUE
      LIMIT 1`,
      [planId, targetRole]
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

    await connection.execute(
      `UPDATE ${config.table}
      SET status = 'CANCELADA', ends_at = NOW()
      WHERE ${config.userField} = ? AND status = 'ATIVA'`,
      [req.user.id]
    );
    await connection.execute(
      `INSERT INTO ${config.table} (${config.userField}, plan_id, status, starts_at, ends_at)
      VALUES (?, ?, 'ATIVA', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [req.user.id, planId]
    );

    await connection.commit();
    return res.status(201).json({ message: 'Plano atualizado com sucesso.' });
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
