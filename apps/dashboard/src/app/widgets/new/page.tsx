'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function NewWidgetPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getToken().then(t => setClerkToken(t)); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const widget = await api.widgets.create({ name });
      router.push(`/widgets/${widget.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Create New Widget</h1>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Widget name"
        className="w-full p-3 border rounded mb-4" />
      <button onClick={handleCreate} disabled={saving || !name.trim()}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Widget'}
      </button>
    </div>
  );
}
