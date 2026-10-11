import axios from 'axios';

const GET_CACHE_TTL_MS = 15_000;
const GET_CACHE_MAX_ENTRIES = 100;
const getCache = new Map();
const pendingGets = new Map();
let cacheGeneration = 0;

export const invalidateGetCache = () => {
  cacheGeneration += 1;
  getCache.clear();
  pendingGets.clear();
};

export const getCached = (url, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  ).toString();
  const key = query ? `${url}?${query}` : url;
  const cached = getCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data);
  }

  if (cached) getCache.delete(key);
  if (pendingGets.has(key)) return pendingGets.get(key);

  const generation = cacheGeneration;
  const request = api.get(url, { params }).then((response) => {
    const data = response.data.data;
    if (generation === cacheGeneration) {
      getCache.set(key, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
      if (getCache.size > GET_CACHE_MAX_ENTRIES) {
        getCache.delete(getCache.keys().next().value);
      }
    }
    return data;
  }).finally(() => {
    if (pendingGets.get(key) === request) pendingGets.delete(key);
  });

  pendingGets.set(key, request);
  return request;
};

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
  (response) => {
    if (response.config.method !== 'get') invalidateGetCache();
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      invalidateGetCache();
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
