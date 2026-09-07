import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (!isProduction ? 'dev-secret-change-me' : '');

if (!jwtSecret) {
  throw new Error('JWT_SECRET e obrigatorio em producao.');
}

export const config = {
  port: Number(process.env.PORT || 3333),
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:4173,http://localhost:5173,http://127.0.0.1:4173,http://127.0.0.1:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'prestacao_servicos',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true
  }
};
