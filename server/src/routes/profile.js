import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function signUser(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

async function getProfile(user) {
  const users = await query(
    'SELECT id, name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1',
    [user.id]
  );
  const base = users[0];

  if (!base) return null;

  if (base.role === 'CLIENTE') {
    const profiles = await query(
      'SELECT phone, city, state, address FROM client_profiles WHERE user_id = ? LIMIT 1',
      [base.id]
    );
    return { ...base, profile: profiles[0] || {} };
  }

  if (base.role === 'PRESTADOR') {
    const profiles = await query(
      'SELECT phone, document, city, state, bio, rating, is_verified FROM provider_profiles WHERE user_id = ? LIMIT 1',
      [base.id]
    );
    return { ...base, profile: profiles[0] || {} };
  }

  return { ...base, profile: {} };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const profile = await getProfile(req.user);

    if (!profile) {
      return res.status(404).json({ message: 'Perfil nao encontrado.' });
    }

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
});

router.patch('/', authenticate, async (req, res, next) => {
  const { name, email, phone, city, state, address, document, bio } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Nome e email sao obrigatorios.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, req.user.id]
    );

    if (req.user.role === 'CLIENTE') {
      await connection.execute(
        `INSERT INTO client_profiles (user_id, phone, city, state, address)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE phone = VALUES(phone), city = VALUES(city), state = VALUES(state), address = VALUES(address)`,
        [req.user.id, phone || null, city || null, state || null, address || null]
      );
    }

    if (req.user.role === 'PRESTADOR') {
      await connection.execute(
        `INSERT INTO provider_profiles (user_id, phone, document, city, state, bio)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          phone = VALUES(phone),
          document = VALUES(document),
          city = VALUES(city),
          state = VALUES(state),
          bio = VALUES(bio)`,
        [req.user.id, phone || null, document || null, city || null, state || null, bio || null]
      );
    }

    await connection.commit();

    const user = { id: req.user.id, name, email, role: req.user.role };
    const profile = await getProfile(user);
    return res.json({ token: signUser(user), user, profile, message: 'Perfil atualizado com sucesso.' });
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ja existe um usuario com este email.' });
    }

    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
