// frontend/src/api/axiosClient.js
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:4000').replace(/\/$/, '');
const API = API_BASE + '/api';

const client = axios.create({
  baseURL: API,
  timeout: 120000,
});

client.interceptors.request.use(config => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
}, err => Promise.reject(err));

export function authHeaders() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) { return {}; }
}

export function getApiBase() { return API_BASE; }
export default client;