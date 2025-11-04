// frontend/src/lib/socketClient.js
import { io } from 'socket.io-client';

let socket = null;

/**
 * getSocket() - Creates and returns a shared socket.io client instance.
 */
export function getSocket() {
  if (typeof window === 'undefined') return null;

  if (socket && (socket.connected || socket.disconnected)) return socket;

  const raw = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const SOCKET_URL = raw.replace(/\/$/, '');

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: { token: localStorage.getItem('token') || undefined },
  });

  socket.on('connect', () => console.debug('[socket] connected', socket.id));
  socket.on('connect_error', (err) => console.warn('[socket] connect_error', err?.message || err));

  return socket;
}

/**
 * closeSocket() - Disconnects and clears the shared socket instance.
 */
export function closeSocket() {
  if (!socket) return;
  try { socket.disconnect(); } catch {}
  socket = null;
}