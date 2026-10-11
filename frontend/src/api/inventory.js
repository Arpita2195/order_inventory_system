import api, { getCached } from './client';

export const getInventory = (params = {}) => getCached('/inventory', params);
export const getLowStock = () => getCached('/inventory/low-stock');
export const restockProduct = (productId, payload) =>
  api.post(`/inventory/${productId}/restock`, payload).then((res) => res.data.data);
export const adjustProduct = (productId, payload) =>
  api.post(`/inventory/${productId}/adjust`, payload).then((res) => res.data.data);
export const getProductHistory = (productId) =>
  getCached(`/inventory/${productId}/history`);
