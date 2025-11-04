// frontend/src/api/axiosClient.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const API = API_BASE.replace(/\/$/, '') + '/api';

const client = axios.create({
  baseURL: API,
  timeout: 120000,
});

// Attach token automatically for convenience (works in browser only)
client.interceptors.request.use((config) => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) { /* ignore in non-browser env */ }
  return config;
}, (err) => Promise.reject(err));

export function authHeaders() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

export default client;