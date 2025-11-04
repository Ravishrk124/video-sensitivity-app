// frontend/src/lib/socketClient.js
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../api/axiosClient';

let socket = null;

/**
 * getSocket() - Creates and returns a shared socket.io client instance.
 * Uses SOCKET_URL from axiosClient which already resolves VITE_SOCKET_URL / VITE_API_BASE / window origin.
 */
export function getSocket() {
  if (typeof window === 'undefined') return null;

  if (socket && (socket.connected || socket.disconnected)) return socket;

  const SOCKET = SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:4000');

  socket = io(SOCKET, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
    auth: { token: localStorage.getItem('token') || undefined },
  });

  socket.on('connect', () => console.debug('[socket] connected', socket.id));
  socket.on('connect_error', (err) => console.warn('[socket] connect_error', err?.message || err));

  return socket;
}

export function closeSocket() {
  if (!socket) return;
  try { socket.disconnect(); } catch (e) {}
  socket = null;
}