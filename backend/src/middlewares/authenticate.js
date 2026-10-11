const authService = require('../services/auth');
const { sendError } = require('../utils/response');
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const rateLimitLogin = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = loginAttempts.get(key);
  if (!previous || now - previous.startedAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (previous.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (now - previous.startedAt)) / 1000));
    res.set('Retry-After', String(retryAfter));
    return sendError(res, 'LOGIN_RATE_LIMITED', 'Too many sign-in attempts. Try again later.', [], 429);
  }
  previous.count += 1;
  return next();
};

const clearLoginAttempts = (req) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(key);
};

const authenticate = async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token, extra] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token || extra) {
    return sendError(res, 'AUTHENTICATION_REQUIRED', 'Sign in to continue', [], 401);
  }
  try {
    req.user = await authService.authenticateToken(token);
    return next();
  } catch (error) {
    if (Number(error.status) === 401) {
      return sendError(res, error.code, error.message, [], 401);
    }
    return next(error);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return sendError(res, 'AUTHENTICATION_REQUIRED', 'Sign in to continue', [], 401);
  if (!roles.includes(req.user.role)) {
    return sendError(res, 'FORBIDDEN', 'You do not have permission to perform this action', [], 403);
  }
  return next();
};

module.exports = { authenticate, requireRole, rateLimitLogin, clearLoginAttempts };
