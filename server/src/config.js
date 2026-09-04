import 'dotenv/config';

// export const config = {
//   port: Number(process.env.PORT || 3333),
//   clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:4173,http://localhost:5173,http://127.0.0.1:4173,http://127.0.0.1:5173,http://192.168.137.1:4173,http://192.168.137.1:5173')
//     .split(',')
//     .map((url) => url.trim())
//     .filter(Boolean),
//   jwtSecret: process.env.JWT_SECRET || 'dev-secret',
//   db: {
//     host: process.env.DB_HOST || 'localhost',
//     port: Number(process.env.DB_PORT || 3306),
//     user: process.env.DB_USER || 'root',
//     password: process.env.DB_PASSWORD || '2409',
//     database: process.env.DB_NAME || 'prestacao_servicos',
//     waitForConnections: true,
//     connectionLimit: 10
//   }
// };

export const config = {
  port: Number(process.env.PORT || 3333),
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:4173,http://localhost:5173,http://127.0.0.1:4173,http://127.0.0.1:5173,http://192.168.137.1:4173,http://192.168.137.1:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  db: {
    host: process.env.DB_HOST || '10.67.22.216',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'us_infonet_224_farmacia',
    password: process.env.DB_PASSWORD || 'frm590aai',
    database: process.env.DB_NAME || 'bd_tcc_infonet_224_farmacia',
    waitForConnections: true,
    connectionLimit: 10
  }
};