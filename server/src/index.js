import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { testDatabaseConnection } from './db.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import messageRoutes from './routes/messages.js';
import planRoutes from './routes/plans.js';
import payoutRoutes from './routes/payouts.js';
import profileRoutes from './routes/profile.js';
import requestRoutes from './routes/requests.js';
import reviewRoutes from './routes/reviews.js';
import serviceRoutes from './routes/services.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.clientUrls, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (_req, res, next) => {
  try {
    await testDatabaseConnection();
    res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Rota nao encontrada: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload muito grande.' });
  }
  return res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(config.port, () => {
  console.log(`API rodando na porta ${config.port}`);
});
