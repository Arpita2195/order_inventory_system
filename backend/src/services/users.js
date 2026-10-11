const bcrypt = require('bcryptjs');
const { withTransaction } = require('../config/db');
const userRepo = require('../repositories/users');
const { createUserSchema, updateUserSchema } = require('../utils/validators');
const { publicUser } = require('./auth');

const buildError = (status, code, message) => Object.assign(new Error(message), { status, code });

const listUsers = async (query) => userRepo.listUsers(query);

const createUser = async (payload) => {
  const parsed = createUserSchema.parse(payload);
  const email = parsed.email.toLowerCase();
  if (await userRepo.findByEmail(email)) {
    throw buildError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  try {
    return await withTransaction(async (connection) => {
      const id = await userRepo.createUser(connection, {
        email,
        displayName: parsed.displayName,
        passwordHash,
        role: parsed.role
      });
      return { id: Number(id), email, displayName: parsed.displayName, role: parsed.role, isActive: true };
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw buildError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }
    throw error;
  }
};

const updateUser = async (id, payload, actorId) => {
  const parsed = updateUserSchema.parse(payload);
  if (Number(id) === Number(actorId) && (parsed.isActive === false || parsed.role === 'STAFF')) {
    throw buildError(409, 'CANNOT_CHANGE_OWN_ACCESS', 'You cannot deactivate or demote your own Admin account');
  }
  const passwordHash = parsed.password ? await bcrypt.hash(parsed.password, 12) : undefined;

  return withTransaction(async (connection) => {
    await connection.query('SELECT id FROM auth_setup_lock WHERE id = 1 FOR UPDATE');
    const user = await userRepo.findById(id, connection);
    if (!user) throw buildError(404, 'USER_NOT_FOUND', 'User not found');

    const losesAdminAccess = user.role === 'ADMIN'
      && user.is_active
      && (parsed.role === 'STAFF' || parsed.isActive === false);
    if (losesAdminAccess && await userRepo.countActiveAdmins(connection) <= 1) {
      throw buildError(409, 'LAST_ACTIVE_ADMIN', 'At least one active Admin account must remain');
    }

    await userRepo.updateUser(connection, id, {
      role: parsed.role,
      isActive: parsed.isActive,
      passwordHash
    });
    const updated = await userRepo.findById(id, connection);
    return publicUser(updated);
  });
};

module.exports = { listUsers, createUser, updateUser };
