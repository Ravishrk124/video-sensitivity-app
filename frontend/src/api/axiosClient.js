// frontend/src/api/axiosClient.js
import axios from 'axios';

/**
 * Resolve API base from env, then window.location.origin, then 127.0.0.1 dev fallback.
 * Returns value without trailing slash.
 */
export function getApiBase() {
  const env = import.meta.env.VITE_API_BASE;
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : null;
  const raw = env || origin || 'http://127.0.0.1:4000';
  return String(raw).replace(/\/$/, '');
}

// canonical API base used by axios client (points to .../api)
export const API_BASE = getApiBase();
export const API = API_BASE + '/api';

// canonical socket url (fall back to API_BASE if not provided)
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || API_BASE).replace(/\/$/, '');

const client = axios.create({
  baseURL: API,
  timeout: 120000,
  withCredentials: true,
});

client.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
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