import api, { getCached } from './client';

export const getOrders = (params = {}) =>
  getCached('/orders', params);

export const getOrder = (id) =>
  getCached(`/orders/${id}`);

export const createOrder = (payload) =>
  api.post('/orders', payload).then((res) => res.data.data);

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((res) => res.data.data);

export const cancelOrder = (id) =>
  api.post(`/orders/${id}/cancel`).then((res) => res.data.data);
