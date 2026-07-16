'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api, setClerkToken } from '@/lib/api';

interface Agent { id: string; name: string; }

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

export default function NewWidgetPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState(false);

  // 'chat' = text only, 'voice' = voice only, 'both' = text + voice
  const [mode, setMode] = useState<'chat' | 'voice' | 'both'>('chat');
  const [voiceLanguage, setVoiceLanguage] = useState('en-IN');
  const [voiceId, setVoiceId] = useState('');
  const [showVisualizer, setShowVisualizer] = useState(true);

  useEffect(() => {
    getToken().then(t => setClerkToken(t));
    api.agents.list().then(setAgents).catch(() => {});
  }, []);

  async function handleCreate() {
    if (!name.trim() || !agentId) return;
    setSaving(true);
    try {
      const voiceEnabled = mode === 'voice' || mode === 'both';
      const config = {
        features: { chat: mode !== 'voice', voice: voiceEnabled },
        voice: {
          enabled: voiceEnabled,
          language: voiceLanguage,
          voiceId: voiceId.trim() || null,
          showVisualizer,
        },
      };
      const widget = await api.widgets.create({ name, agentId, config });
      router.push(`/widgets/${widget.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const voiceEnabled = mode === 'voice' || mode === 'both';

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Create New Widget</h1>

      <label className="block text-sm font-medium mb-1">Name</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Widget name"
        className="w-full p-3 border rounded mb-4" />

      <label className="block text-sm font-medium mb-1">Agent</label>
      <select value={agentId} onChange={e => setAgentId(e.target.value)}
        className="w-full p-3 border rounded mb-6">
        <option value="">Select an agent</option>
        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <label className="block text-sm font-medium mb-2">Widget Type</label>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([
          { id: 'chat', title: 'Chat', desc: 'Text only' },
          { id: 'voice', title: 'Voice', desc: 'Speak & listen' },
          { id: 'both', title: 'Chat + Voice', desc: 'Both modes' },
        ] as const).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            className={`p-3 border rounded text-left transition-colors ${
              mode === opt.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium text-sm">{opt.title}</div>
            <div className="text-xs text-gray-500">{opt.desc}</div>
          </button>
        ))}
      </div>

      {voiceEnabled && (
        <div className="border-t pt-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Voice Settings</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)}
              className="w-full p-3 border rounded">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Voice ID <span className="text-gray-400">(optional)</span></label>
            <input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="e.g. meera (leave blank for default)"
              className="w-full p-3 border rounded" />
          </div>
          <div className="flex items-center gap-2">
            <input id="visualizer" type="checkbox" checked={showVisualizer} onChange={e => setShowVisualizer(e.target.checked)} />
            <label htmlFor="visualizer" className="text-sm">Show audio visualizer while speaking</label>
          </div>
        </div>
      )}

      <button onClick={handleCreate} disabled={saving || !name.trim() || !agentId}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50">
        {saving ? 'Creating...' : 'Create Widget'}
      </button>
    </div>
  );
}
