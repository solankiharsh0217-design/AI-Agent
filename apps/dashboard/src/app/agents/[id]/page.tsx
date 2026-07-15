'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    config: {
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '',
    },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadAgent(); });
  }, [params.id]);

  async function loadAgent() {
    try {
      setLoading(true);
      const data = await api.agents.get(params.id);
      setAgent(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        config: {
          model: data.config?.model || 'llama-3.1-70b-versatile',
          temperature: data.config?.temperature ?? 0.7,
          maxTokens: data.config?.maxTokens ?? 2048,
          systemPrompt: data.config?.systemPrompt || '',
        },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.agents.update(params.id, {
        name: formData.name,
        description: formData.description,
        config: formData.config,
      });
      setEditing(false);
      await loadAgent();
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleConfigChange(key: string, value: any) {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!agent) return <div className="p-8">Agent not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{editing ? 'Edit Agent' : agent.name}</h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setFormData({ name: agent.name, description: agent.description || '', config: { model: agent.config?.model || 'llama-3.1-70b-versatile', temperature: agent.config?.temperature ?? 0.7, maxTokens: agent.config?.maxTokens ?? 2048, systemPrompt: agent.config?.systemPrompt || '' } }); }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              rows={3}
            />
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Configuration</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <select
                  value={formData.config.model}
                  onChange={e => handleConfigChange('model', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Groq)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Groq)</option>
                  <option value="mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                  <option value="gemma-7b-it">Gemma 7B (Groq)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.config.temperature}
                  onChange={e => handleConfigChange('temperature', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Tokens</label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={formData.config.maxTokens}
                  onChange={e => handleConfigChange('maxTokens', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">System Prompt</label>
              <textarea
                value={formData.config.systemPrompt}
                onChange={e => handleConfigChange('systemPrompt', e.target.value)}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows={6}
                placeholder="You are a helpful AI assistant..."
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div><span className="font-medium">Status:</span> {agent.status}</div>
          {agent.description && <div><span className="font-medium">Description:</span> {agent.description}</div>}
          <div><span className="font-medium">Model:</span> {agent.config?.model}</div>
          <div><span className="font-medium">Temperature:</span> {agent.config?.temperature}</div>
          <div><span className="font-medium">Max Tokens:</span> {agent.config?.maxTokens}</div>
          {agent.config?.systemPrompt && (
            <div>
              <span className="font-medium">System Prompt:</span>
              <pre className="mt-2 p-4 bg-gray-50 rounded whitespace-pre-wrap text-sm">{agent.config.systemPrompt}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
