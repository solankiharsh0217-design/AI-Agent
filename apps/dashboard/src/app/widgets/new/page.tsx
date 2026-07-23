'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageContainer, PageHeader, FormError } from '@/components/ui';

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
  { code: 'en-US', label: 'English (US)' },
];

const BASE_CONFIG = {
  theme: { mode: 'system', primaryColor: '#3B82F6', secondaryColor: '#64748B', backgroundColor: '#FFFFFF', surfaceColor: '#F8FAFC', textColor: '#1E293B', borderRadius: 12, fontFamily: 'system-ui, -apple-system, sans-serif', customCSS: null },
  branding: { logo: null, companyName: null, tagline: null, poweredBy: true },
  features: { chat: true, voice: false, voiceInput: false, attachments: false, markdown: true, copyMessages: true, typingIndicator: true, suggestedPrompts: true },
  behavior: { position: 'bottom-right', offsetX: 20, offsetY: 20, autoOpen: false, autoOpenDelay: 5000, showOnMobile: true, persistSession: true, sessionDuration: 1800 },
  voice: { enabled: false, language: 'en-IN', voiceId: null, vadSensitivity: 0.5, showVisualizer: true, pushToTalk: false },
  chat: { placeholder: 'Type a message...', greeting: null, suggestedPrompts: [], maxMessageLength: 4000, streaming: true, enterToSend: true },
};

export default function NewWidgetPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [domains, setDomains] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'chat' | 'voice' | 'both'>('chat');
  const [voiceLanguage, setVoiceLanguage] = useState('en-IN');
  const [voiceId, setVoiceId] = useState('');
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [voiceInput, setVoiceInput] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.push('/sign-in'); return; }
    if (isLoaded && isSignedIn) {
      api.agents.list().then(setAgents).catch(() => {});
    }
  }, [isLoaded, isSignedIn]);

  async function handleCreate() {
    if (!name.trim() || !agentId) {
      setError('Name and agent are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const voiceEnabled = mode === 'voice' || mode === 'both';
      const config = {
        ...BASE_CONFIG,
        features: { ...BASE_CONFIG.features, chat: mode !== 'voice', voice: voiceEnabled, voiceInput: voiceInput && !voiceEnabled },
        voice: { ...BASE_CONFIG.voice, enabled: voiceEnabled, language: voiceLanguage, voiceId: voiceId.trim() || null, showVisualizer },
        chat: { ...BASE_CONFIG.chat, greeting: greeting.trim() || null },
      };
      const cleanDomains = domains.map((d) => d.trim().replace(/^[a-z]+:\/\//i, '').replace(/[/?#].*$/, '')).filter(Boolean);
      const widget = await api.widgets.create({ name, agentId, config, domains: cleanDomains });
      router.push(`/widgets/${widget.id}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to create widget.');
    } finally {
      setSaving(false);
    }
  }

  const voiceEnabled = mode === 'voice' || mode === 'both';

  return (
    <PageContainer>
      <PageHeader title="Create Widget" description="Embeddable chat (and optional voice) widget for your site." />
      <div className="card card-p space-y-6">
        <FormError message={error} />
        <div>
          <label className="label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Widget name" className="input" />
        </div>
        <div>
          <label className="label">Agent</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="select">
            <option value="">Select an agent</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Widget Type</label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: 'chat', title: 'Chat', desc: 'Text only' },
              { id: 'voice', title: 'Voice', desc: 'Speak & listen' },
              { id: 'both', title: 'Chat + Voice', desc: 'Both modes' },
            ] as const).map((opt) => (
              <button key={opt.id} type="button" onClick={() => setMode(opt.id)}
                className={`p-3 border rounded text-left transition-colors ${mode === opt.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-300 hover:border-slate-400'}`}>
                <div className="font-medium text-sm">{opt.title}</div>
                <div className="text-xs text-slate-500">{opt.desc}</div>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={voiceInput} onChange={(e) => setVoiceInput(e.target.checked)} /> Enable mic-to-type (STT input only — reply stays as text, no voice playback)
          </label>
        </div>

        {voiceEnabled && (
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Voice Settings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">Language</label><select value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} className="select">{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
              <div><label className="label">Voice ID <span className="text-slate-400">(optional)</span></label><input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="e.g. meera" className="input" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input id="visualizer" type="checkbox" checked={showVisualizer} onChange={(e) => setShowVisualizer(e.target.checked)} /> Show audio visualizer while speaking</label>
          </div>
        )}

        <div className="border-t border-slate-200 pt-6">
          <label className="label">Greeting (optional)</label>
          <input value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Spoken/written when the chat opens" className="input" />
        </div>

        <div className="border-t border-slate-200 pt-6">
          <label className="label">Allowed Domains</label>
          <p className="text-sm text-slate-500 mb-3">Origins allowed to embed the widget and call the API (CORS). Domain only, e.g. <code>example.com</code> or <code>*.example.com</code>. You can change this later.</p>
          <div className="space-y-2">
            {domains.map((domain, index) => (
              <div key={index} className="flex gap-2">
                <input type="text" value={domain} onChange={(e) => { const next = [...domains]; next[index] = e.target.value; setDomains(next); }} placeholder="example.com" className="input flex-1" />
                <button type="button" onClick={() => setDomains(domains.length === 1 ? [''] : domains.filter((_, i) => i !== index))} className="text-red-600 text-sm">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setDomains([...domains, ''])} className="text-blue-600 text-sm">+ Add Domain</button>
          </div>
        </div>

        <button onClick={handleCreate} disabled={saving || !name.trim() || !agentId} className="btn-primary disabled:opacity-50">
          {saving ? 'Creating...' : 'Create Widget'}
        </button>
      </div>
    </PageContainer>
  );
}
