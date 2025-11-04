import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Register(){
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [role,setRole]=useState('editor');const [err,setErr]=useState('');const nav=useNavigate();const { register } = useAuth();
  async function onSubmit(e){ e.preventDefault(); try{ await register(name,email,password,role); nav('/'); }catch(err){ setErr(err.response?.data?.message || 'Register failed'); } }
  return (<div className='container'><div className='card' style={{maxWidth:500,margin:'40px auto'}}><h2>Register</h2><form onSubmit={onSubmit}><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /><label>Password</label><input type='password' value={password} onChange={e=>setPassword(e.target.value)} /><label>Role</label><select value={role} onChange={e=>setRole(e.target.value)}><option value='viewer'>viewer</option><option value='editor'>editor</option><option value='admin'>admin</option></select><div style={{height:12}} className='small'>{err}</div><div style={{marginTop:12}}><button type='submit'>Register</button> <Link to='/login' style={{marginLeft:8}}>Login</Link></div></form></div></div>);
}
