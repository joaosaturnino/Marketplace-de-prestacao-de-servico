import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool(config.db);

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function testDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
