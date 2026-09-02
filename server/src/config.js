import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3333),
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:4173,http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '2409',
    database: process.env.DB_NAME || 'prestacao_servicos',
    waitForConnections: true,
    connectionLimit: 10
  }
};
