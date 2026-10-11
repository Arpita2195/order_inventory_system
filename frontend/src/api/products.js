import api from './client';

export const getProducts = (params = {}) =>
  api.get('/products', { params }).then((res) => res.data.data);

export const createProduct = (payload) =>
  api.post('/products', payload).then((res) => res.data.data);

export const updateProduct = (id, payload) =>
  api.put(`/products/${id}`, payload).then((res) => res.data.data);

export const toggleProductStatus = (id, isActive) =>
  api.patch(`/products/${id}/status`, { isActive }).then((res) => res.data.data);
