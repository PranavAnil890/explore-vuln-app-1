import React, { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not logged in.');
      return;
    }
    let payload;
    try {
      payload = jwtDecode(token);
    } catch (e) {
      setError('Invalid session, please log in again.');
      return;
    }
    // FIX: the UI now only ever requests the logged-in user's own id - the
    // backend also enforces this independently (defense in depth), but the
    // free-text "look up any id" field is gone since it only ever encouraged
    // probing other users' data.
    api.get(`/users/${payload.id}`)
      .then((res) => setUser(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load profile'));
  }, []);

  return (
    <div>
      <h1>My Profile</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {user && <pre>{JSON.stringify(user, null, 2)}</pre>}
    </div>
  );
}
