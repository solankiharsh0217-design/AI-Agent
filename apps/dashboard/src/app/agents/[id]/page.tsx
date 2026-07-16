'use client';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'pa-IN', label: 'Punjabi' },
];

interface VoiceConfig {
  enabled: boolean;
  language: string;
  voiceId: string;
  greeting: string;
}

function defaultVoice(cfg: any): VoiceConfig {
  const v = cfg?.voice || {};
  return {
    enabled: v.enabled ?? false,
    language: v.language || 'en-IN',
    voiceId: v.voiceId || '',
    greeting: cfg?.greeting || v.greeting || '',
  };
}

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    config: {
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '',
      voice: { enabled: false, language: 'en-IN', voiceId: '', greeting: '' } as VoiceConfig,
    },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadAgent(); loadChannels(); });
  }, [params.id]);

  function toFormData(data: any) {
    return {
      name: data.name,
      description: data.description || '',
      config: {
        model: data.config?.model || 'llama-3.1-70b-versatile',
        temperature: data.config?.temperature ?? 0.7,
        maxTokens: data.config?.maxTokens ?? 2048,
        systemPrompt: data.config?.systemPrompt || '',
        voice: defaultVoice(data.config),
      },
    };
  }

  async function loadAgent() {
    try {
      setLoading(true);
      const data = await api.agents.get(params.id);
      setAgent(data);
      setFormData(toFormData(data));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannels() {
    try {
      const [w, n] = await Promise.all([
        api.widgets.list().catch(() => []),
        api.phone.listNumbers().catch(() => []),
      ]);
      setWidgets((w || []).filter((x: any) => x.agentId === params.id));
      setNumbers((n || []).filter((x: any) => x.agentId === params.id));
    } catch {
      /* non-fatal */
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const voice = formData.config.voice;
      await api.agents.update(params.id, {
        name: formData.name,
        description: formData.description,
        config: {
          ...formData.config,
          // Mirror greeting at top-level too so the phone pipeline can read either.
          greeting: voice.greeting,
        },
      });
      setEditing(false);
      await loadAgent();
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleVoiceChange(key: keyof VoiceConfig, value: any) {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, voice: { ...prev.config.voice, [key]: value } },
    }));
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
                onClick={() => { setEditing(false); setFormData(toFormData(agent)); }}
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

          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                id="voice-enabled"
                type="checkbox"
                checked={formData.config.voice.enabled}
                onChange={e => handleVoiceChange('enabled', e.target.checked)}
              />
              <label htmlFor="voice-enabled" className="text-lg font-semibold">Voice (phone calls)</label>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Used when this agent answers assigned phone numbers. Callers are transcribed, the agent replies, and the reply is spoken back.
            </p>
            {formData.config.voice.enabled && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Language</label>
                    <select
                      value={formData.config.voice.language}
                      onChange={e => handleVoiceChange('language', e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Voice ID <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      value={formData.config.voice.voiceId}
                      onChange={e => handleVoiceChange('voiceId', e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="e.g. meera (blank = default)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Greeting <span className="text-gray-400">(spoken when the call connects)</span></label>
                  <textarea
                    value={formData.config.voice.greeting}
                    onChange={e => handleVoiceChange('greeting', e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                    rows={2}
                    placeholder="Hello! Thanks for calling. How can I help you today?"
                  />
                </div>
              </div>
            )}
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
          <div>
            <span className="font-medium">Voice:</span>{' '}
            {agent.config?.voice?.enabled ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                Enabled · {LANGUAGES.find(l => l.code === (agent.config?.voice?.language))?.label || agent.config?.voice?.language}
              </span>
            ) : (
              <span className="text-gray-500">Disabled</span>
            )}
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3">Linked channels</h2>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Web widgets ({widgets.length})</h3>
                <Link href="/widgets/new" className="text-sm text-blue-600 hover:underline">+ New widget</Link>
              </div>
              {widgets.length === 0 ? (
                <p className="text-sm text-gray-500">No widgets connected to this agent yet.</p>
              ) : (
                <ul className="divide-y border rounded">
                  {widgets.map(w => (
                    <li key={w.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">
                        {w.name}
                        {w.config?.voice?.enabled && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">voice</span>
                        )}
                      </span>
                      <Link href={`/widgets/${w.id}`} className="text-sm text-blue-600 hover:underline">Configure</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Phone numbers ({numbers.length})</h3>
                <Link href="/phone" className="text-sm text-blue-600 hover:underline">Manage numbers</Link>
              </div>
              {numbers.length === 0 ? (
                <p className="text-sm text-gray-500">No phone numbers assigned to this agent yet.</p>
              ) : (
                <ul className="divide-y border rounded">
                  {numbers.map(n => (
                    <li key={n.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-mono">{n.phoneNumber}</span>
                      <span className="text-xs text-gray-500">{n.friendlyName || n.provider || 'assigned'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
