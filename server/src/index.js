import cors from 'cors';
import express from 'express';
import { config } from './config.js';
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

app.use(cors({ origin: config.clientUrls }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
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
  res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(config.port, () => {
  console.log(`API rodando em http://localhost:${config.port}`);
});
