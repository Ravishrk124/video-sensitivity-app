import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Login(){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [err,setErr]=useState('');const nav=useNavigate();const { login } = useAuth();
  async function onSubmit(e){ e.preventDefault(); try{ await login(email,password); nav('/'); }catch(err){ setErr(err.response?.data?.message || 'Login failed'); } }
  return (<div className='container'><div className='card' style={{maxWidth:400,margin:'40px auto'}}><h2>Login</h2><form onSubmit={onSubmit}><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /><label>Password</label><input type='password' value={password} onChange={e=>setPassword(e.target.value)} /><div style={{height:12}} className='small'>{err}</div><div style={{marginTop:12}}><button type='submit'>Login</button> <Link to='/register' style={{marginLeft:8}}>Register</Link></div></form></div></div>);
}
