import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

let connection;

try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '2409',
    multipleStatements: true
  });

  const schema = await fs.readFile(path.join(rootDir, 'database', 'schema.sql'), 'utf8');
  const seed = await fs.readFile(path.join(rootDir, 'database', 'seed.sql'), 'utf8');

  await connection.query(schema);
  await runMigrations(connection, process.env.DB_NAME || 'prestacao_servicos');
  await connection.query(seed);
  await backfillProviderBalances(connection);
  console.log('Banco MySQL inicializado com sucesso.');
} catch (error) {
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('Acesso negado ao MySQL. Confira DB_USER e DB_PASSWORD em server/.env.');
    process.exitCode = 1;
  } else if (error.code === 'ECONNREFUSED') {
    console.error('Nao foi possivel conectar ao MySQL. Confira se o servidor esta rodando.');
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await connection?.end();
}

async function runMigrations(connection, databaseName) {
  await connection.query(`USE \`${databaseName}\``);

  await addColumnIfMissing(
    connection,
    databaseName,
    'plans',
    'target_role',
    "ALTER TABLE plans ADD COLUMN target_role ENUM('CLIENTE', 'PRESTADOR') NOT NULL DEFAULT 'PRESTADOR' AFTER description"
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'plans',
    'max_requests_per_month',
    'ALTER TABLE plans ADD COLUMN max_requests_per_month INT NULL AFTER max_services'
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'payments',
    'pix_code',
    'ALTER TABLE payments ADD COLUMN pix_code VARCHAR(80) NULL AFTER status'
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'payments',
    'pix_qr_payload',
    'ALTER TABLE payments ADD COLUMN pix_qr_payload TEXT NULL AFTER pix_code'
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'payments',
    'card_brand',
    'ALTER TABLE payments ADD COLUMN card_brand VARCHAR(40) NULL AFTER pix_qr_payload'
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'payments',
    'card_last4',
    'ALTER TABLE payments ADD COLUMN card_last4 VARCHAR(4) NULL AFTER card_brand'
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'payments',
    'provider_fee_status',
    "ALTER TABLE payments ADD COLUMN provider_fee_status ENUM('NAO_APLICA', 'DESCONTADA', 'PENDENTE') NOT NULL DEFAULT 'NAO_APLICA' AFTER card_last4"
  );
  await addColumnIfMissing(
    connection,
    databaseName,
    'financial_transactions',
    'provider_id',
    'ALTER TABLE financial_transactions ADD COLUMN provider_id INT NULL AFTER request_id'
  );

  await connection.query(
    "ALTER TABLE payments MODIFY COLUMN method ENUM('PIX', 'CARTAO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO') NOT NULL DEFAULT 'PIX'"
  );
  await connection.query("UPDATE payments SET method = 'CARTAO_CREDITO' WHERE method = 'CARTAO'");
  await connection.query(
    "ALTER TABLE payments MODIFY COLUMN method ENUM('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO') NOT NULL DEFAULT 'PIX'"
  );
  await connection.query(
    "ALTER TABLE financial_transactions MODIFY COLUMN type ENUM('ENTRADA', 'TAXA_PLATAFORMA', 'REPASSE_PRESTADOR', 'ESTORNO', 'TAXA_DINHEIRO_COBRADA', 'TAXA_DINHEIRO_PENDENTE', 'TAXA_DINHEIRO_COMPENSADA', 'SAQUE_PRESTADOR') NOT NULL"
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS service_request_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}

async function addColumnIfMissing(connection, databaseName, tableName, columnName, statement) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
    FROM information_schema.columns
    WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [databaseName, tableName, columnName]
  );

  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(statement);
  }
}

async function backfillProviderBalances(connection) {
  await connection.query(
    `INSERT INTO provider_balances (provider_id, available_amount, pending_fee_amount)
    SELECT
      sr.provider_id,
      COALESCE(SUM(CASE WHEN p.status = 'PAGO' AND p.method <> 'DINHEIRO' AND sr.status = 'CONCLUIDO' THEN sr.provider_amount ELSE 0 END), 0) -
        COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.provider_id = sr.provider_id), 0),
      0
    FROM service_requests sr
    JOIN payments p ON p.request_id = sr.id
    GROUP BY sr.provider_id
    ON DUPLICATE KEY UPDATE
      available_amount = GREATEST(provider_balances.available_amount, VALUES(available_amount))`
  );
}
