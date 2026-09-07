import React, { useState } from 'react';
import api from '../api';

export default function AddPlace() {
  const [form, setForm] = useState({ title: '', description: '', category: '', imageUrl: '', isPrivate: false });
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/places', form);
      setMsg('Place added.');
      setForm({ title: '', description: '', category: '', imageUrl: '', isPrivate: false });
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div>
      <h1>Add a Place</h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        <label>
          <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} /> Private
        </label>
        <button type="submit">Add</button>
      </form>
      <p>{msg}</p>
    </div>
  );
}
