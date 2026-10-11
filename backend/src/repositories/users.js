const { pool } = require('../config/db');
const { createPaginatedResult } = require('../utils/pagination');

const findByEmail = async (email, executor = pool) => {
  const [rows] = await executor.query('SELECT * FROM app_users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
};

const findById = async (id, executor = pool) => {
  const [rows] = await executor.query(
    'SELECT id, email, display_name, role, is_active, token_version, created_at FROM app_users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
};

const createUser = async (executor, { email, displayName, passwordHash, role }) => {
  const [result] = await executor.query(
    'INSERT INTO app_users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
    [email, displayName, passwordHash, role]
  );
  return result.insertId;
};

const listUsers = async ({ search = '', role = 'all', status = 'all', page, limit }) => {
  const conditions = [];
  const values = [];
  if (search) {
    conditions.push('(email LIKE ? OR display_name LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (role !== 'all') {
    conditions.push('role = ?');
    values.push(role);
  }
  if (status === 'active') {
    conditions.push('is_active = 1');
  } else if (status === 'inactive') {
    conditions.push('is_active = 0');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM app_users ${where}`, values);
  const [rows] = await pool.query(
    `SELECT id, email, display_name, role, is_active, created_at, updated_at
     FROM app_users ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, (page - 1) * limit]
  );
  return createPaginatedResult(rows, Number(countRows[0].total), { page, limit });
};

const updateUser = async (executor, id, { role, isActive, passwordHash }) => {
  const updates = [];
  const values = [];
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }
  if (passwordHash !== undefined) {
    updates.push('password_hash = ?');
    values.push(passwordHash);
    updates.push('token_version = token_version + 1');
  }
  if (!updates.length) return;
  values.push(id);
  await executor.query(`UPDATE app_users SET ${updates.join(', ')} WHERE id = ?`, values);
};

const countActiveAdmins = async (executor = pool) => {
  const [rows] = await executor.query(
    "SELECT COUNT(*) AS total FROM app_users WHERE role = 'ADMIN' AND is_active = 1"
  );
  return Number(rows[0].total);
};

const incrementTokenVersion = async (id) => {
  await pool.query('UPDATE app_users SET token_version = token_version + 1 WHERE id = ?', [id]);
};

module.exports = {
  findByEmail,
  findById,
  createUser,
  listUsers,
  updateUser,
  countActiveAdmins,
  incrementTokenVersion
};
