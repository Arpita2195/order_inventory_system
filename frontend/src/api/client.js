import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stockflow.accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('stockflow.accessToken');
      window.dispatchEvent(new Event('stockflow:unauthorized'));
    }
    const payload = error.response?.data?.error;
    const message = payload?.message || error.message || 'Request failed';
    return Promise.reject({
      ...error,
      message,
      details: payload?.details || []
    });
  }
);

export default api;
