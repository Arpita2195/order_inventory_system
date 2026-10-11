import api from './client';

export const getDashboardSummary = () => api.get('/dashboard/summary').then((res) => res.data.data);
