import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
const AuthContext = createContext();
export function AuthProvider({ children }){
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  useEffect(()=>{ const t = localStorage.getItem('token'); if (!t) { localStorage.removeItem('user'); setUser(null); } },[]);
  async function login(email,password){
    const res = await api.post('/auth/login',{ email,password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }
  async function register(name,email,password,role){
    const res = await api.post('/auth/register',{ name,email,password,role });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }
  function logout(){
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }
  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
