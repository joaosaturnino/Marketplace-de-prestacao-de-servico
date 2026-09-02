import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const categories = await query('SELECT id, name, description FROM service_categories ORDER BY name');
    return res.json(categories);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Nome da categoria e obrigatorio.' });
    }

    const result = await query(
      'INSERT INTO service_categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    return res.status(201).json({ id: result.insertId, message: 'Categoria criada com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ja existe uma categoria com este nome.' });
    }
    return next(error);
  }
});

router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'Informe ao menos um campo para atualizar.' });
    }

    params.push(req.params.id);

    const result = await query(
      `UPDATE service_categories SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Categoria nao encontrada.' });
    }

    return res.json({ message: 'Categoria atualizada com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ja existe uma categoria com este nome.' });
    }
    return next(error);
  }
});

export default router;
