'use client';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';
import { FormError } from '@/components/ui';
import { AgentConfigForm, configToForm, defaultAgentFormConfig, formToConfig, AgentFormConfig } from '@/components/AgentConfigForm';

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
  { code: 'en-US', label: 'English (US)' },
];

function langLabel(code?: string) {
  return LANGUAGES.find((l) => l.code === code)?.label || code || '';
}

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [form, setForm] = useState<AgentFormConfig>(defaultAgentFormConfig());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((t) => {
      setClerkToken(t);
      loadAgent();
      loadChannels();
    });
  }, [params.id]);

  function toForm(data: any) {
    setName(data.name);
    setDescription(data.description || '');
    setForm(configToForm(data.config));
  }

  async function loadAgent() {
    try {
      setLoading(true);
      const data = await api.agents.get(params.id);
      setAgent(data);
      toForm(data);
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
    setSaveError(null);
    try {
      await api.agents.update(params.id, {
        name,
        description,
        config: formToConfig(form),
      });
      setEditing(false);
      await loadAgent();
    } catch (e: any) {
      setSaveError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.agents.publish(params.id);
      await loadAgent();
    } catch (e: any) {
      setSaveError(e?.message || 'Publish failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!agent) return <div className="p-8">Agent not found</div>;

  const v = agent.config?.voiceConfig;

  return (
    <div className="max-w-4xl mx-auto p-8">
      {saveError && <FormError message={saveError} />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{editing ? 'Edit Agent' : agent.name}</h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); toForm(agent); }} className="btn-secondary">
                Cancel
              </button>
            </>
          ) : (
            <>
              {agent.status !== 'published' && (
                <button onClick={handlePublish} disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              )}
              <button onClick={() => setEditing(true)} className="btn-primary">
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-6">
          <div>
            <label className="label">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea" rows={3} />
          </div>
          <AgentConfigForm form={form} setForm={setForm} />
        </div>
      ) : (
        <div className="space-y-4">
          <div><span className="font-medium">Status:</span> {agent.status}</div>
          {agent.description && <div><span className="font-medium">Description:</span> {agent.description}</div>}
          <div><span className="font-medium">Model:</span> {agent.config?.model}</div>
          <div><span className="font-medium">Provider:</span> {agent.config?.provider}</div>
          <div><span className="font-medium">Temperature:</span> {agent.config?.temperature}</div>
          <div><span className="font-medium">Max Tokens:</span> {agent.config?.maxTokens}</div>
          <div><span className="font-medium">Knowledge bases:</span> {(agent.config?.knowledgeBaseIds || []).length}</div>
          <div><span className="font-medium">Tools:</span> {(agent.config?.tools || []).length}</div>
          {agent.config?.systemPrompt && (
            <div>
              <span className="font-medium">System Prompt:</span>
              <pre className="mt-2 p-4 bg-slate-50 rounded whitespace-pre-wrap text-sm">{agent.config.systemPrompt}</pre>
            </div>
          )}
          <div>
            <span className="font-medium">Voice:</span>{' '}
            {v?.enabled ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                Enabled · {langLabel(v.language)} {v.voiceId ? `· ${v.voiceId}` : ''}
              </span>
            ) : (
              <span className="text-slate-500">Disabled</span>
            )}
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3">Linked channels</h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-700">Web widgets ({widgets.length})</h3>
                <Link href="/widgets/new" className="text-sm text-blue-600 hover:underline">+ New widget</Link>
              </div>
              {widgets.length === 0 ? (
                <p className="text-sm text-slate-500">No widgets connected to this agent yet.</p>
              ) : (
                <ul className="divide-y border rounded">
                  {widgets.map((w) => (
                    <li key={w.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">
                        {w.name}
                        {w.config?.voiceConfig?.enabled && (
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
                <h3 className="text-sm font-medium text-slate-700">Phone numbers ({numbers.length})</h3>
                <Link href="/phone" className="text-sm text-blue-600 hover:underline">Manage numbers</Link>
              </div>
              {numbers.length === 0 ? (
                <p className="text-sm text-slate-500">No phone numbers assigned to this agent yet.</p>
              ) : (
                <ul className="divide-y border rounded">
                  {numbers.map((n) => (
                    <li key={n.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-mono">{n.phoneNumber}</span>
                      <span className="text-xs text-slate-500">{n.friendlyName || n.provider || 'assigned'}</span>
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
