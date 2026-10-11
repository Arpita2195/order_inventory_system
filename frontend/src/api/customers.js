import api from './client';

export const getCustomers = (params = {}) =>
  api.get('/customers', { params }).then((res) => res.data.data);

export const createCustomer = (payload) =>
  api.post('/customers', payload).then((res) => res.data.data);

export const updateCustomer = (id, payload) =>
  api.put(`/customers/${id}`, payload).then((res) => res.data.data);
