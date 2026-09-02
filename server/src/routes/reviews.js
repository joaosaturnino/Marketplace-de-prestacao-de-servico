import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/mine', authenticate, authorize('CLIENTE', 'PRESTADOR', 'ADMIN'), async (req, res, next) => {
  try {
    const filters = [];
    const params = [];

    if (req.user.role === 'CLIENTE') {
      filters.push('r.client_id = ?');
      params.push(req.user.id);
    }

    if (req.user.role === 'PRESTADOR') {
      filters.push('r.provider_id = ?');
      params.push(req.user.id);
    }

    const rows = await query(
      `SELECT
        r.id,
        r.request_id,
        r.rating,
        r.comment,
        r.created_at,
        s.title AS service_title,
        client.name AS client_name,
        provider.name AS provider_name
      FROM reviews r
      JOIN service_requests sr ON sr.id = r.request_id
      JOIN services s ON s.id = sr.service_id
      JOIN users client ON client.id = r.client_id
      JOIN users provider ON provider.id = r.provider_id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY r.created_at DESC`,
      params
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticate, authorize('CLIENTE'), async (req, res, next) => {
  const { requestId, rating, comment } = req.body;
  const parsedRating = Number(rating);

  if (!requestId || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ message: 'Informe a solicitacao e uma nota de 1 a 5.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.execute(
      `SELECT
        sr.id,
        sr.client_id,
        sr.provider_id,
        sr.status,
        p.status AS payment_status
      FROM service_requests sr
      LEFT JOIN payments p ON p.request_id = sr.id
      WHERE sr.id = ? AND sr.client_id = ?
      LIMIT 1`,
      [requestId, req.user.id]
    );
    const request = requests[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (request.status !== 'CONCLUIDO' || request.payment_status !== 'PAGO') {
      await connection.rollback();
      return res.status(409).json({ message: 'Avaliacao disponivel apenas apos servico concluido e pago.' });
    }

    await connection.execute(
      `INSERT INTO reviews (request_id, client_id, provider_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)`,
      [request.id, req.user.id, request.provider_id, parsedRating, comment || null]
    );

    await connection.execute(
      `UPDATE provider_profiles pp
      SET rating = (
        SELECT ROUND(AVG(r.rating), 2)
        FROM reviews r
        WHERE r.provider_id = ?
      )
      WHERE pp.user_id = ?`,
      [request.provider_id, request.provider_id]
    );

    await connection.commit();
    return res.status(201).json({ message: 'Avaliacao registrada com sucesso.' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Esta solicitacao ja foi avaliada.' });
    }
    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
