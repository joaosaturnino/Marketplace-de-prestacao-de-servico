import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

async function getRequestAccess(requestId, user) {
  const rows = await query(
    `SELECT id, client_id, provider_id
    FROM service_requests
    WHERE id = ?
    LIMIT 1`,
    [requestId]
  );
  const request = rows[0];

  if (!request) return null;
  if (user.role === 'ADMIN' || request.client_id === user.id || request.provider_id === user.id) {
    return request;
  }

  return false;
}

router.get('/:requestId', authenticate, async (req, res, next) => {
  try {
    const request = await getRequestAccess(req.params.requestId, req.user);

    if (request === null) {
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (request === false) {
      return res.status(403).json({ message: 'Voce nao tem acesso a esta conversa.' });
    }

    const rows = await query(
      `SELECT
        m.id,
        m.request_id,
        m.sender_id,
        m.message,
        m.created_at,
        u.name AS sender_name,
        u.role AS sender_role
      FROM service_request_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.request_id = ?
      ORDER BY m.created_at ASC, m.id ASC`,
      [req.params.requestId]
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post('/:requestId', authenticate, async (req, res, next) => {
  try {
    const text = String(req.body.message || '').trim();

    if (!text) {
      return res.status(400).json({ message: 'Digite uma mensagem.' });
    }

    const request = await getRequestAccess(req.params.requestId, req.user);

    if (request === null) {
      return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
    }

    if (request === false) {
      return res.status(403).json({ message: 'Voce nao tem acesso a esta conversa.' });
    }

    const result = await query(
      `INSERT INTO service_request_messages (request_id, sender_id, message)
      VALUES (?, ?, ?)`,
      [req.params.requestId, req.user.id, text]
    );

    const rows = await query(
      `SELECT
        m.id,
        m.request_id,
        m.sender_id,
        m.message,
        m.created_at,
        u.name AS sender_name,
        u.role AS sender_role
      FROM service_request_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

export default router;
