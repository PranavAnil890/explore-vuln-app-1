import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { jwtDecode } from 'jwt-decode';
import Explore from './pages/Explore';
import Login from './pages/Login';
import Register from './pages/Register';
import AddPlace from './pages/AddPlace';
import PlaceDetail from './pages/PlaceDetail';
import Profile from './pages/Profile';
import api from './api';

function ErrorFallback({ error }) {
  return <p style={{ color: 'red', padding: 24 }}>Something went wrong: {error.message}</p>;
}

function AuthStatus() {
  const token = localStorage.getItem('token');
  if (!token) return <span style={{ marginLeft: 'auto', color: '#888' }}>Not logged in</span>;
  try {
    const { id } = jwtDecode(token);
    return <span style={{ marginLeft: 'auto', color: '#2a2' }}>Logged in (id: {id})</span>;
  } catch {
    return <span style={{ marginLeft: 'auto', color: '#888' }}>Not logged in</span>;
  }
}

export default function App() {
  const [backendUp, setBackendUp] = useState(null);

  useEffect(() => {
    api.get('/health')
      .then((res) => setBackendUp(res.data.db === 'connected'))
      .catch(() => setBackendUp(false));
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        {backendUp === false && (
          <div style={{ background: '#fdd', padding: 8, textAlign: 'center' }}>
            Backend unreachable or database not connected - check the server is running.
          </div>
        )}
        <nav style={{ display: 'flex', gap: 16, padding: 16, borderBottom: '1px solid #ddd', alignItems: 'center' }}>
          <Link to="/">Explore</Link>
          <Link to="/add">Add Place</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <AuthStatus />
        </nav>
        <div style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/add" element={<AddPlace />} />
            <Route path="/place/:id" element={<PlaceDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
