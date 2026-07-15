'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api, setClerkToken } from '@/lib/api';

interface Agent { id: string; name: string; }

export default function NewWidgetPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(t => setClerkToken(t));
    api.agents.list().then(setAgents).catch(() => {});
  }, []);

  async function handleCreate() {
    if (!name.trim() || !agentId) return;
    setSaving(true);
    try {
      const widget = await api.widgets.create({ name, agentId });
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
      <select value={agentId} onChange={e => setAgentId(e.target.value)}
        className="w-full p-3 border rounded mb-4">
        <option value="">Select an agent</option>
        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button onClick={handleCreate} disabled={saving || !name.trim() || !agentId}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Widget'}
      </button>
    </div>
  );
}
