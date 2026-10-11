import api from './client';

export const getUsers = (params = {}) =>
  api.get('/users', { params }).then((res) => res.data.data);

export const createUser = (payload) =>
  api.post('/users', payload).then((res) => res.data.data);

export const updateUser = (id, payload) =>
  api.patch(`/users/${id}`, payload).then((res) => res.data.data);
