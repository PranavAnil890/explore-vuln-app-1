import axios from 'axios';

// FIX: base URL now comes from env config instead of being hardcoded, so it's
// easy to confirm/change without editing source, and to point at different
// environments.
const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
