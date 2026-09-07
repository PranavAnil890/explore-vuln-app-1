import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../api';

export default function PlaceDetail() {
  const { id } = useParams();
  const [place, setPlace] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/places/${id}`)
      .then((res) => setPlace(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load place'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!place) return <p>Not found.</p>;

  return (
    <div>
      <h1>{place.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(place.description, { ALLOWED_TAGS: [] }) }} />
      <p>Category: {place.category}</p>
    </div>
  );
}
