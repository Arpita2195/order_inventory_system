const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const userRepo = require('../repositories/users');
const { withTransaction } = require('../config/db');
const { loginSchema } = require('../utils/validators');

const authError = (status, code, message) => Object.assign(new Error(message), { status, code });

const publicUser = (user) => ({
  id: Number(user.id),
  email: user.email,
  displayName: user.display_name,
  role: user.role
});

const createAccessToken = (user) => jwt.sign(
  { tokenVersion: Number(user.token_version) },
  jwtSecret,
  { subject: String(user.id), expiresIn: jwtExpiresIn, algorithm: 'HS256' }
);

const login = async (payload) => {
  const { email, password } = loginSchema.parse(payload);
  const user = await userRepo.findByEmail(email.toLowerCase());
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw authError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return { user: publicUser(user), accessToken: createAccessToken(user) };
};

const authenticateToken = async (token) => {
  let claims;
  try {
    claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw authError(401, 'INVALID_TOKEN', 'Your session is invalid or has expired. Please sign in again.');
  }

  if (!claims || typeof claims.sub !== 'string' || !Number.isSafeInteger(claims.tokenVersion)) {
    throw authError(401, 'INVALID_TOKEN', 'Your session is invalid or has expired. Please sign in again.');
  }

  const user = await userRepo.findById(claims.sub);
  if (!user || !user.is_active || Number(user.token_version) !== claims.tokenVersion) {
    throw authError(401, 'INVALID_TOKEN', 'Your session is no longer active. Please sign in again.');
  }
  return publicUser(user);
};

const logout = async (userId) => userRepo.incrementTokenVersion(userId);

const createFirstAdmin = async ({ email, displayName, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const parsed = loginSchema.parse({ email: normalizedEmail, password });
  if (parsed.password.length < 12) {
    throw authError(400, 'VALIDATION_ERROR', 'Password must be at least 12 characters');
  }
  const trimmedName = String(displayName || '').trim();
  if (trimmedName.length < 2 || trimmedName.length > 120) {
    throw authError(400, 'VALIDATION_ERROR', 'Display name must be between 2 and 120 characters');
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  return withTransaction(async (connection) => {
    await connection.query('SELECT id FROM auth_setup_lock WHERE id = 1 FOR UPDATE');
    const adminCount = await userRepo.countActiveAdmins(connection);
    if (adminCount) {
      throw authError(409, 'ADMIN_ALREADY_EXISTS', 'An active Admin account already exists');
    }
    const existingUser = await userRepo.findByEmail(parsed.email, connection);
    if (existingUser) {
      throw authError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }
    const id = await userRepo.createUser(connection, {
      email: parsed.email,
      displayName: trimmedName,
      passwordHash,
      role: 'ADMIN'
    });
    return { id, email: parsed.email, displayName: trimmedName, role: 'ADMIN' };
  });
};

module.exports = { login, authenticateToken, logout, createAccessToken, createFirstAdmin, publicUser };
