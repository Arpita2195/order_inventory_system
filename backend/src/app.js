const express = require('express');
const cors = require('cors');
const { port } = require('./config/env');
const apiRouter = require('./routes');
const authRouter = require('./routes/auth');
const { authenticate } = require('./middlewares/authenticate');
const { pool } = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'degraded', database: 'disconnected', message: 'Database unavailable' });
  }
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1', authenticate, apiRouter);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Endpoint not found',
      details: []
    }
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  const status = Number(error.status) || 500;
  res.status(status).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Unexpected server error',
      details: Array.isArray(error.details) ? error.details : []
    }
  });
});

module.exports = { app, port };
