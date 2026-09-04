import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function validateServiceInput({ categoryId, title, description, price, durationMinutes }) {
  const parsedCategoryId = Number(categoryId);
  const parsedPrice = Number(price);
  const parsedDuration = Number(durationMinutes || 60);

  if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
    return 'Selecione uma categoria valida.';
  }

  if (!String(title || '').trim() || !String(description || '').trim()) {
    return 'Informe titulo e descricao do servico.';
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return 'Informe um preco maior que zero.';
  }

  if (!Number.isInteger(parsedDuration) || parsedDuration < 15) {
    return 'Informe uma duracao de pelo menos 15 minutos.';
  }

  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const { search = '', categoryId } = req.query;
    const params = [];
    const filters = ["s.status = 'ATIVO'", "u.status = 'ATIVO'"];

    if (search) {
      filters.push('(s.title LIKE ? OR s.description LIKE ? OR u.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      filters.push('s.category_id = ?');
      params.push(Number(categoryId));
    }

    const services = await query(
      `SELECT
        s.id,
        s.title,
        s.description,
        s.price,
        s.duration_minutes,
        s.provider_id,
        u.name AS provider_name,
        c.name AS category_name,
        pp.city,
        pp.state,
        pp.rating,
        pp.is_verified
      FROM services s
      JOIN users u ON u.id = s.provider_id
      JOIN service_categories c ON c.id = s.category_id
      LEFT JOIN provider_profiles pp ON pp.user_id = u.id
      WHERE ${filters.join(' AND ')}
      ORDER BY s.created_at DESC`,
      params
    );

    return res.json(services);
  } catch (error) {
    return next(error);
  }
});

router.get('/mine', authenticate, authorize('PRESTADOR'), async (req, res, next) => {
  try {
    const services = await query(
      `SELECT s.*, c.name AS category_name
      FROM services s
      JOIN service_categories c ON c.id = s.category_id
      WHERE s.provider_id = ?
      ORDER BY s.created_at DESC`,
      [req.user.id]
    );

    return res.json(services);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticate, authorize('PRESTADOR'), async (req, res, next) => {
  try {
    const { categoryId, title, description, price, durationMinutes } = req.body;

    const validationMessage = validateServiceInput({ categoryId, title, description, price, durationMinutes });
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const [subscription] = await query(
      `SELECT p.max_services
      FROM provider_subscriptions ps
      JOIN plans p ON p.id = ps.plan_id
      WHERE ps.provider_id = ? AND ps.status = 'ATIVA' AND p.target_role = 'PRESTADOR' AND p.is_active = TRUE
      ORDER BY ps.created_at DESC
      LIMIT 1`,
      [req.user.id]
    );

    if (!subscription) {
      return res.status(403).json({ message: 'Escolha um plano antes de cadastrar novos servicos.' });
    }

    if (subscription.max_services !== null) {
      const [usage] = await query(
        'SELECT COUNT(*) AS services_count FROM services WHERE provider_id = ?',
        [req.user.id]
      );

      if (Number(usage.services_count || 0) >= Number(subscription.max_services)) {
        return res.status(403).json({
          message: 'Voce atingiu o limite de servicos do seu plano. Altere o plano para publicar mais.'
        });
      }
    }

    const result = await query(
      `INSERT INTO services (provider_id, category_id, title, description, price, duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, Number(categoryId), title.trim(), description.trim(), Number(price), Number(durationMinutes || 60)]
    );

    return res.status(201).json({ id: result.insertId, message: 'Servico cadastrado com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authenticate, authorize('PRESTADOR'), async (req, res, next) => {
  try {
    const { categoryId, title, description, price, durationMinutes } = req.body;

    const validationMessage = validateServiceInput({ categoryId, title, description, price, durationMinutes });
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const result = await query(
      `UPDATE services
      SET category_id = ?, title = ?, description = ?, price = ?, duration_minutes = ?
      WHERE id = ? AND provider_id = ?`,
      [
        Number(categoryId),
        title.trim(),
        description.trim(),
        Number(price),
        Number(durationMinutes || 60),
        req.params.id,
        req.user.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Servico nao encontrado.' });
    }

    return res.json({ message: 'Servico atualizado com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', authenticate, authorize('PRESTADOR'), async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['ATIVO', 'PAUSADO'].includes(status)) {
      return res.status(400).json({ message: 'Status invalido.' });
    }

    const result = await query(
      'UPDATE services SET status = ? WHERE id = ? AND provider_id = ?',
      [status, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Servico nao encontrado.' });
    }

    return res.json({ message: 'Status atualizado.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
