'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function NewAgentPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('llama-3.1-70b-versatile');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getToken().then(t => setClerkToken(t)); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const agent = await api.agents.create({
        name,
        description,
        config: { model, temperature, maxTokens, systemPrompt },
      });
      router.push(`/agents/${agent.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Create New Agent</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Agent name"
            className="w-full p-3 border rounded" required />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?"
            className="w-full p-3 border rounded" rows={3} />
        </div>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-3">Configuration</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-3 border rounded">
                <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Groq)</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Groq)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                <option value="gemma-7b-it">Gemma 7B (Groq)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Temperature</label>
              <input type="number" step="0.1" min="0" max="2"
                value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full p-3 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input type="number" min="1" max="8192"
                value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))}
                className="w-full p-3 border rounded" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              className="w-full p-3 border rounded font-mono text-sm"
              rows={6} placeholder="You are a helpful AI assistant..." />
          </div>
        </div>
      </div>

      <button onClick={handleCreate} disabled={saving || !name.trim()}
        className="mt-6 bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Agent'}
      </button>
    </div>
  );
}
