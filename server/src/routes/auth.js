import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool, query } from '../db.js';

const router = Router();

function signUser(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res, next) => {
  const { name, email, password, role, phone, city, state, address, document, bio } = req.body;
  const allowedRoles = ['CLIENTE', 'PRESTADOR'];

  if (!name || !email || !password || !allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Informe nome, email, senha e tipo de cadastro valido.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    const userId = result.insertId;

    if (role === 'CLIENTE') {
      await connection.execute(
        'INSERT INTO client_profiles (user_id, phone, city, state, address) VALUES (?, ?, ?, ?, ?)',
        [userId, phone || null, city || null, state || null, address || null]
      );
    }

    if (role === 'PRESTADOR') {
      await connection.execute(
        'INSERT INTO provider_profiles (user_id, phone, document, city, state, bio) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, phone || null, document || null, city || null, state || null, bio || null]
      );
    }

    await connection.commit();

    const user = { id: userId, name, email, role };
    return res.status(201).json({ token: signUser(user), user });
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

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Informe email e senha.' });
    }

    const users = await query(
      'SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    if (user.status !== 'ATIVO') {
      return res.status(403).json({ message: 'Usuario bloqueado.' });
    }

    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    return res.json({ token: signUser(publicUser), user: publicUser });
  } catch (error) {
    return next(error);
  }
});

export default router;
