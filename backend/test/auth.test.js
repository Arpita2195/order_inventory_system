const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticate, clearLoginAttempts, rateLimitLogin, requireRole } = require('../src/middlewares/authenticate');
const userRepo = require('../src/repositories/users');
const authService = require('../src/services/auth');
const { userListQuerySchema } = require('../src/utils/validators');
const { createPaginatedResult } = require('../src/utils/pagination');

const createResponse = () => {
  const result = { status: null, body: null, headers: {}, nextCalled: false };
  const response = {
    status(status) {
      result.status = status;
      return this;
    },
    set(name, value) {
      result.headers[name] = value;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  return { result, response };
};

test('requires a Bearer token on protected API requests', async () => {
  const { result, response } = createResponse();
  await authenticate({ get: () => undefined }, response, () => { result.nextCalled = true; });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(result.nextCalled, false);
});

test('restricts user-management routes to Admin accounts', () => {
  const { result, response } = createResponse();
  requireRole('ADMIN')({ user: { id: 7, role: 'STAFF' } }, response, () => { result.nextCalled = true; });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, 'FORBIDDEN');
  assert.equal(result.nextCalled, false);
});

test('accepts an Admin for Admin-only routes', () => {
  const { result, response } = createResponse();
  requireRole('ADMIN')({ user: { id: 7, role: 'ADMIN' } }, response, () => { result.nextCalled = true; });
  assert.equal(result.nextCalled, true);
});

test('limits repeated login requests and reports a retry interval', () => {
  const req = { ip: 'test-auth-rate-limit' };
  clearLoginAttempts(req);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { result, response } = createResponse();
    rateLimitLogin(req, response, () => { result.nextCalled = true; });
    assert.equal(result.nextCalled, true);
  }

  const { result, response } = createResponse();
  rateLimitLogin(req, response, () => { result.nextCalled = true; });
  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, 'LOGIN_RATE_LIMITED');
  assert.ok(Number(result.headers['Retry-After']) > 0);
  clearLoginAttempts(req);
});

test('signs JWTs and rejects revoked or inactive account sessions', async () => {
  const originalFindById = userRepo.findById;
  let tokenVersion = 0;
  let isActive = true;
  userRepo.findById = async (id) => ({
    id: Number(id),
    email: 'test@example.com',
    display_name: 'Test Admin',
    role: 'ADMIN',
    is_active: isActive,
    token_version: tokenVersion
  });
  try {
    const token = authService.createAccessToken({ id: 31, token_version: 0 });
    const user = await authService.authenticateToken(token);
    assert.equal(user.id, 31);
    assert.equal(user.role, 'ADMIN');

    tokenVersion = 1;
    await assert.rejects(authService.authenticateToken(token), (error) => error.status === 401);

    tokenVersion = 0;
    isActive = false;
    await assert.rejects(authService.authenticateToken(token), (error) => error.status === 401);
  } finally {
    userRepo.findById = originalFindById;
  }
});

test('validates server-side user filters and pagination limits', () => {
  assert.deepEqual(userListQuerySchema.parse({}), {
    page: 1,
    limit: 10,
    search: '',
    role: 'all',
    status: 'all'
  });
  assert.equal(userListQuerySchema.safeParse({ limit: '101' }).success, false);
  assert.deepEqual(userListQuerySchema.parse({ page: '2', limit: '25', role: 'STAFF', status: 'active' }), {
    page: 2,
    limit: 25,
    search: '',
    role: 'STAFF',
    status: 'active'
  });
});

test('returns list records with pagination metadata', () => {
  assert.deepEqual(createPaginatedResult([{ id: 1 }], 11, { page: 2, limit: 10 }), {
    items: [{ id: 1 }],
    pagination: { page: 2, limit: 10, total: 11, totalPages: 2 }
  });
});
