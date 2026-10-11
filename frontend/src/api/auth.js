import api from './client';

export const login = (credentials) =>
  api.post('/auth/login', credentials).then((res) => res.data.data);

export const getCurrentUser = () =>
  api.get('/auth/me').then((res) => res.data.data);

export const logout = () =>
  api.post('/auth/logout').then((res) => res.data.data);
