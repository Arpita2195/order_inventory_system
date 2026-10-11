const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-only-secret-that-is-never-used-in-production' : '');
if (Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 bytes in backend/.env');
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stockflow_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  }
};
