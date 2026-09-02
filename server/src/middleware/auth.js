import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticacao nao informado.' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Token invalido ou expirado.' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Voce nao tem permissao para esta acao.' });
    }

    return next();
  };
}
