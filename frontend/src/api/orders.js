import api from './client';

export const getOrders = (params = {}) =>
  api.get('/orders', { params }).then((res) => res.data.data);

export const getOrder = (id) =>
  api.get(`/orders/${id}`).then((res) => res.data.data);

export const createOrder = (payload) =>
  api.post('/orders', payload).then((res) => res.data.data);

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((res) => res.data.data);

export const cancelOrder = (id) =>
  api.post(`/orders/${id}/cancel`).then((res) => res.data.data);
