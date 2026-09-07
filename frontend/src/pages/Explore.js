import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../api';

export default function Explore() {
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/places')
      .then((res) => setPlaces(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load places'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Explore Places</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Failed to load places: {error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {places.map((p) => (
          <div key={p._id} style={{ border: '1px solid #ccc', padding: 12 }}>
            <h3>{p.title}</h3>
            {/* FIX: sanitized with DOMPurify (all tags stripped server-side too)
                before rendering as HTML - closes the stored XSS. */}
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.description, { ALLOWED_TAGS: [] }) }} />
            <Link to={`/place/${p._id}`}>View</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
