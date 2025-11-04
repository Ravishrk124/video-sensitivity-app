// frontend/src/App.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Play from './pages/Play';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // canonical API base (env -> origin -> 127.0.0.1 dev fallback)
  const apiBase = (import.meta.env.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : null) || 'http://127.0.0.1:4000').replace(/\/$/, '');

  useEffect(() => {
    // if path is /play render Play
    if (typeof window !== 'undefined' && window.location && window.location.pathname === '/play') {
      // Play component will handle auth check
    }
  }, []);

  function saveAuth(tkn, userObj) {
    if (tkn) {
      try { localStorage.setItem('token', tkn); } catch (e) {}
      setToken(tkn);
    }
    if (userObj) {
      try { localStorage.setItem('user', JSON.stringify(userObj)); } catch (e) {}
      setUser(userObj);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const form = new FormData(e.target);
    const email = form.get('email');
    const password = form.get('password');

    try {
      const res = await axios.post(`${apiBase}/api/auth/login`, { email, password }, { withCredentials: true });
      saveAuth(res.data.token, res.data.user);
      setMessage('Login successful');
      window.history.replaceState({}, '', '/');
      setTimeout(() => setMessage(null), 1500);
    } catch (err) {
      setMessage(err?.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const form = new FormData(e.target);
    const email = form.get('email');
    const password = form.get('password');
    const role = form.get('role') || 'viewer';

    try {
      const res = await axios.post(`${apiBase}/api/auth/register`, { email, password, role }, { withCredentials: true });
      saveAuth(res.data.token, res.data.user);
      setMessage('Registered and logged in');
      window.history.replaceState({}, '', '/');
      setTimeout(() => setMessage(null), 1500);
    } catch (err) {
      setMessage(err?.response?.data?.message || err.message || 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    try { localStorage.removeItem('token'); } catch (e) {}
    try { localStorage.removeItem('user'); } catch (e) {}
    setUser(null);
    setToken(null);
    window.history.replaceState({}, '', '/');
    window.location.reload();
  }

  if (typeof window !== 'undefined' && window.location && window.location.pathname === '/play') {
    return <Play />;
  }

  if (!user) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
        <h2>Video Sensitivity App</h2>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setMode('login')} disabled={mode === 'login'}>Login</button>
          <button onClick={() => setMode('register')} disabled={mode === 'register'} style={{ marginLeft: 8 }}>Register</button>
        </div>

        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
          {message && <div style={{ marginBottom: 8, color: 'red' }}>{message}</div>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 8 }}>
                <input name="email" type="email" placeholder="Email" required style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <input name="password" type="password" placeholder="Password" required style={{ width: '100%' }} />
              </div>
              <div>
                <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: 8 }}>
                <input name="email" type="email" placeholder="Email" required style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <input name="password" type="password" placeholder="Password" required style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <select name="role" defaultValue="viewer" style={{ width: '100%' }}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register & Login'}</button>
              </div>
            </form>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
          Tip: you can use existing accounts: <br />
          admin@example.com / Admin@1234 <br />
          editor1@example.com / Editor@1234
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderBottom: '1px solid #eee' }}>
        <div style={{ fontWeight: 700 }}>Video Sensitivity App</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#333' }}>Signed in as: {user.email} ({user.role})</div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <Dashboard />
      </div>
    </div>
  );
}