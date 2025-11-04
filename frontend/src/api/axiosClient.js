// frontend/src/api/axiosClient.js
import axios from 'axios';

export function getApiBase() {
  const raw = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  return raw.replace(/\/$/, '');
}

const API_BASE = getApiBase();
const API = API_BASE + '/api';

const client = axios.create({
  baseURL: API,
  timeout: 120000,
});

client.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {}
    return config;
  },
  (err) => Promise.reject(err)
);

export function authHeaders() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

export default client;