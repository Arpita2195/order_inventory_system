import api from './client';

export const getInventory = (params = {}) => api.get('/inventory', { params }).then((res) => res.data.data);
export const getLowStock = () => api.get('/inventory/low-stock').then((res) => res.data.data);
export const restockProduct = (productId, payload) =>
  api.post(`/inventory/${productId}/restock`, payload).then((res) => res.data.data);
export const adjustProduct = (productId, payload) =>
  api.post(`/inventory/${productId}/adjust`, payload).then((res) => res.data.data);
export const getProductHistory = (productId) =>
  api.get(`/inventory/${productId}/history`).then((res) => res.data.data);
