const test = require('node:test');
const assert = require('node:assert/strict');
const { validateParams, validateQuery } = require('../src/middlewares/validate');
const {
  numericIdParamsSchema,
  productIdParamsSchema,
  productListQuerySchema,
  orderListQuerySchema
} = require('../src/utils/validators');

const runMiddleware = (middleware, request) => {
  const result = { status: null, body: null, nextCalled: false };
  const response = {
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  middleware(request, response, () => { result.nextCalled = true; });
  return result;
};

test('accepts positive safe integer resource IDs', () => {
  const result = runMiddleware(validateParams(numericIdParamsSchema), { params: { id: '42' } });
  assert.equal(result.nextCalled, true);
  assert.equal(result.status, null);
});

test('rejects malformed, non-positive, and unsafe IDs with a validation response', () => {
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
    const result = runMiddleware(validateParams(numericIdParamsSchema), { params: { id } });
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('validates inventory product IDs with the same positive-integer rule', () => {
  const result = runMiddleware(validateParams(productIdParamsSchema), { params: { productId: '7' } });
  assert.equal(result.nextCalled, true);
  const invalid = runMiddleware(validateParams(productIdParamsSchema), { params: { productId: '7x' } });
  assert.equal(invalid.status, 400);
});

test('accepts supported list filters and rejects unsupported filter values', () => {
  const validProductQuery = runMiddleware(validateQuery(productListQuerySchema), {
    query: { search: 'mouse', status: 'active' }
  });
  assert.equal(validProductQuery.nextCalled, true);

  const invalidOrderQuery = runMiddleware(validateQuery(orderListQuerySchema), {
    query: { status: 'unknown' }
  });
  assert.equal(invalidOrderQuery.nextCalled, false);
  assert.equal(invalidOrderQuery.status, 400);
  assert.equal(invalidOrderQuery.body.error.code, 'VALIDATION_ERROR');
});

const createOrderServiceHarness = (stock) => {
  const state = { orderWrites: 0, itemWrites: [], movements: [], stockWrites: [], rollbackCount: 0 };
  const fakeConnection = {
    async query(sql, params) {
      if (sql.includes('FROM products p') && sql.includes('FOR UPDATE')) {
        return [[...stock].filter((product) => params.includes(product.id))];
      }
      state.stockWrites.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
  };
  const modules = {
    '../src/config/db': {
      pool: {},
      async withTransaction(callback) {
        try {
          return await callback(fakeConnection);
        } catch (error) {
          state.rollbackCount += 1;
          throw error;
        }
      }
    },
    '../src/repositories/orders': {
      async createOrder() { state.orderWrites += 1; return 50; },
      async insertOrderItem(connection, orderId, item) { state.itemWrites.push({ orderId, ...item }); },
      async getOrderById(id) { return { id, status: 'PENDING', total_amount: 10 }; },
      async getOrderItems() { return state.itemWrites.map((item, index) => ({ id: index + 1, ...item })); }
    },
    '../src/repositories/customers': {
      async getCustomerById() { return { id: 9, name: 'Test Customer' }; }
    },
    '../src/repositories/inventory': {
      async addTransaction(connection, movement) { state.movements.push(movement); }
    }
  };
  const originals = new Map();
  for (const [modulePath, exports] of Object.entries(modules)) {
    const filename = require.resolve(modulePath);
    originals.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  delete require.cache[require.resolve('../src/services/orders')];
  const service = require('../src/services/orders');
  for (const [filename, original] of originals) {
    if (original) require.cache[filename] = original;
    else delete require.cache[filename];
  }
  return { service, state };
};

test('creates an order with merged duplicate items and matching stock movement', async () => {
  const { service, state } = createOrderServiceHarness([
    { id: 1, name: 'Widget', sku: 'W-1', price: 5, is_active: 1, quantity_on_hand: 2 }
  ]);
  const order = await service.createOrder({
    customerId: 9,
    items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }]
  });

  assert.equal(order.id, 50);
  assert.equal(state.orderWrites, 1);
  assert.equal(state.itemWrites.length, 1);
  assert.equal(state.itemWrites[0].quantity, 2);
  assert.equal(state.itemWrites[0].lineTotal, 10);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].changeQty, -2);
  assert.equal(state.rollbackCount, 0);
});

test('rejects insufficient stock before order or inventory writes', async () => {
  const { service, state } = createOrderServiceHarness([
    { id: 1, name: 'Widget', sku: 'W-1', price: 5, is_active: 1, quantity_on_hand: 1 }
  ]);

  await assert.rejects(
    service.createOrder({ customerId: 9, items: [{ productId: 1, quantity: 2 }] }),
    (error) => error.status === 409 && error.code === 'INSUFFICIENT_STOCK'
  );
  assert.equal(state.orderWrites, 0);
  assert.equal(state.itemWrites.length, 0);
  assert.equal(state.stockWrites.length, 0);
  assert.equal(state.movements.length, 0);
  assert.equal(state.rollbackCount, 1);
});
