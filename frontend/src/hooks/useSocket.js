// frontend/src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { getSocket, closeSocket } from '../lib/socketClient';

export default function useSocket(handlerMap = {}, options = {}) {
  const { autoCloseOnUnmount = false } = options;
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    if (!s) return;

    // Attach event listeners
    Object.entries(handlerMap).forEach(([evt, handler]) => {
      if (typeof handler === 'function') s.on(evt, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlerMap).forEach(([evt, handler]) => {
        if (typeof handler === 'function') s.off(evt, handler);
      });
      if (autoCloseOnUnmount) closeSocket();
    };
  }, []); // run once on mount

  return socketRef.current;
}