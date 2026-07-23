'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';
import { FormError } from '@/components/ui';

const WIDGET_APP_URL = process.env.NEXT_PUBLIC_WIDGET_URL || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
];

const DEFAULTS = {
  theme: { mode: 'system', primaryColor: '#3B82F6', secondaryColor: '#64748B', backgroundColor: '#FFFFFF', surfaceColor: '#F8FAFC', textColor: '#1E293B', borderRadius: 12, fontFamily: 'system-ui, -apple-system, sans-serif', customCSS: '' },
  branding: { logo: '', companyName: '', tagline: '', poweredBy: true },
  features: { chat: true, voice: false, voiceInput: false, attachments: false, markdown: true, copyMessages: true, typingIndicator: true, suggestedPrompts: true },
  behavior: { position: 'bottom-right', offsetX: 20, offsetY: 20, autoOpen: false, autoOpenDelay: 5000, showOnMobile: true, persistSession: true, sessionDuration: 1800 },
  voice: { enabled: false, language: 'en-IN', voiceId: '', vadSensitivity: 0.5, showVisualizer: true, pushToTalk: false },
  chat: { placeholder: 'Type a message...', greeting: '', suggestedPrompts: '', maxMessageLength: 4000, streaming: true, enterToSend: true },
  status: 'active',
  domains: [] as string[],
};

function mergeConfig(serverConfig: any) {
  return {
    theme: { ...DEFAULTS.theme, ...(serverConfig?.theme || {}) },
    branding: { ...DEFAULTS.branding, ...(serverConfig?.branding || {}) },
    features: { ...DEFAULTS.features, ...(serverConfig?.features || {}) },
    behavior: { ...DEFAULTS.behavior, ...(serverConfig?.behavior || {}) },
    voice: { ...DEFAULTS.voice, ...(serverConfig?.voice || {}) },
    chat: { ...DEFAULTS.chat, ...(serverConfig?.chat || {}), suggestedPrompts: Array.isArray(serverConfig?.chat?.suggestedPrompts) ? serverConfig.chat.suggestedPrompts.join('\n') : (serverConfig?.chat?.suggestedPrompts || '') },
  };
}

export default function WidgetDetailPage({ params }: { params: { id: string } }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [widget, setWidget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<any>(mergeConfig({}));
  const [status, setStatus] = useState('active');
  const [domains, setDomains] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const missingEnv = !WIDGET_APP_URL || !API_URL;

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.push('/sign-in'); return; }
    getToken().then((t) => { setClerkToken(t); loadWidget(); });
  }, [params.id, isLoaded, isSignedIn]);

  async function loadWidget() {
    try {
      const data = await api.widgets.get(params.id);
      setWidget(data);
      setName(data.name);
      setConfig(mergeConfig(data.config));
      setStatus(data.status || 'active');
      setDomains(data.domains || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payloadConfig = {
        ...config,
        chat: { ...config.chat, suggestedPrompts: config.chat.suggestedPrompts.split('\n').map((s: string) => s.trim()).filter(Boolean) },
      };
      await api.widgets.update(params.id, { name, config: payloadConfig, status, domains });
      setEditing(false);
      await loadWidget();
    } catch (e: any) {
      setSaveError(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function patch(section: string, p: any) {
    setConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], ...p } }));
  }

  function getEmbedCode() {
    if (!WIDGET_APP_URL || !API_URL) return 'Set NEXT_PUBLIC_WIDGET_URL and NEXT_PUBLIC_API_URL environment variables to generate the embed code.';
    return `<script src="${WIDGET_APP_URL}/embed.js" data-widget-id="${widget.id}" data-api-url="${API_URL}"></script>`;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!widget) return <div className="p-8">Not found</div>;
  if (missingEnv && !editing) return <div className="max-w-6xl mx-auto p-8"><div className="bg-yellow-50 border border-yellow-200 rounded-md p-4"><p className="text-sm text-yellow-700">Missing environment variables NEXT_PUBLIC_WIDGET_URL and/or NEXT_PUBLIC_API_URL. Embed code will be incomplete. Set these in your deployment environment.</p></div></div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      {saveError && <FormError message={saveError} />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{editing ? 'Edit Widget' : widget.name}</h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setName(widget.name); setConfig(mergeConfig(widget.config)); setStatus(widget.status || 'active'); setDomains(widget.domains || []); }} className="btn-secondary">Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary">Edit</button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-8">
          <div>
            <label className="label">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="select">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Allowed Domains</h2>
            <p className="text-sm text-slate-500">Origins allowed to embed the widget and call the API (CORS). Domain only, e.g. <code>example.com</code> or <code>*.example.com</code>. Leave empty to allow only via a signed token.</p>
            <div className="space-y-2">
              {domains.map((domain, index) => (
                <div key={index} className="flex gap-2">
                  <input type="text" value={domain} onChange={(e) => { const d = [...domains]; d[index] = e.target.value; setDomains(d); }} placeholder="example.com" className="input flex-1" />
                  <button type="button" onClick={() => setDomains(domains.filter((_, i) => i !== index))} className="text-red-600 text-sm">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setDomains([...domains, ''])} className="text-blue-600 text-sm">+ Add Domain</button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Chat</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">Greeting</label><input type="text" value={config.chat.greeting} onChange={(e) => patch('chat', { greeting: e.target.value })} className="input" /></div>
              <div><label className="label">Placeholder</label><input type="text" value={config.chat.placeholder} onChange={(e) => patch('chat', { placeholder: e.target.value })} className="input" /></div>
              <div><label className="label">Max Message Length</label><input type="number" value={config.chat.maxMessageLength} onChange={(e) => patch('chat', { maxMessageLength: parseInt(e.target.value) })} className="input" /></div>
              <div><label className="label">Suggested Prompts (one per line)</label><textarea value={config.chat.suggestedPrompts} onChange={(e) => patch('chat', { suggestedPrompts: e.target.value })} className="textarea" rows={3} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.chat.streaming} onChange={(e) => patch('chat', { streaming: e.target.checked })} /> Streaming</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.chat.enterToSend} onChange={(e) => patch('chat', { enterToSend: e.target.checked })} /> Enter to send</label>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Voice</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.voice.enabled} onChange={(e) => patch('voice', { enabled: e.target.checked })} /> Enable voice (mic button)</label>
            {config.voice.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="label">Language</label><select value={config.voice.language} onChange={(e) => patch('voice', { language: e.target.value })} className="select">{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
                <div><label className="label">Voice ID (optional)</label><input type="text" value={config.voice.voiceId} onChange={(e) => patch('voice', { voiceId: e.target.value })} placeholder="e.g. meera" className="input" /></div>
                <div><label className="label">VAD Sensitivity</label><input type="number" step="0.1" min="0" max="1" value={config.voice.vadSensitivity} onChange={(e) => patch('voice', { vadSensitivity: parseFloat(e.target.value) })} className="input" /></div>
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.voice.showVisualizer} onChange={(e) => patch('voice', { showVisualizer: e.target.checked })} /> Show visualizer</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.voice.pushToTalk} onChange={(e) => patch('voice', { pushToTalk: e.target.checked })} /> Push to talk</label>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Features</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(DEFAULTS.features).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={config.features[key]} onChange={(e) => patch('features', { [key]: e.target.checked })} />
                  <span className="capitalize">{key === 'voiceInput' ? 'Voice input (mic to type)' : key}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Theme</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div><label className="label">Mode</label><select value={config.theme.mode} onChange={(e) => patch('theme', { mode: e.target.value })} className="select"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
              <div><label className="label">Primary</label><input type="color" value={config.theme.primaryColor} onChange={(e) => patch('theme', { primaryColor: e.target.value })} className="input h-10" /></div>
              <div><label className="label">Secondary</label><input type="color" value={config.theme.secondaryColor} onChange={(e) => patch('theme', { secondaryColor: e.target.value })} className="input h-10" /></div>
              <div><label className="label">Background</label><input type="color" value={config.theme.backgroundColor} onChange={(e) => patch('theme', { backgroundColor: e.target.value })} className="input h-10" /></div>
              <div><label className="label">Surface</label><input type="color" value={config.theme.surfaceColor} onChange={(e) => patch('theme', { surfaceColor: e.target.value })} className="input h-10" /></div>
              <div><label className="label">Text</label><input type="color" value={config.theme.textColor} onChange={(e) => patch('theme', { textColor: e.target.value })} className="input h-10" /></div>
              <div><label className="label">Border Radius</label><input type="number" value={config.theme.borderRadius} onChange={(e) => patch('theme', { borderRadius: parseInt(e.target.value) })} className="input" /></div>
              <div className="md:col-span-2"><label className="label">Font Family</label><input type="text" value={config.theme.fontFamily} onChange={(e) => patch('theme', { fontFamily: e.target.value })} className="input" /></div>
              <div className="md:col-span-3"><label className="label">Custom CSS (optional)</label><textarea value={config.theme.customCSS} onChange={(e) => patch('theme', { customCSS: e.target.value })} className="textarea font-mono text-xs" rows={3} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Branding</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">Company Name</label><input type="text" value={config.branding.companyName} onChange={(e) => patch('branding', { companyName: e.target.value })} className="input" /></div>
              <div><label className="label">Logo URL</label><input type="text" value={config.branding.logo} onChange={(e) => patch('branding', { logo: e.target.value })} className="input" /></div>
              <div className="md:col-span-2"><label className="label">Tagline</label><input type="text" value={config.branding.tagline} onChange={(e) => patch('branding', { tagline: e.target.value })} className="input" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.branding.poweredBy} onChange={(e) => patch('branding', { poweredBy: e.target.checked })} /> Show &quot;Powered by&quot;</label>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Behavior</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">Position</label><select value={config.behavior.position} onChange={(e) => patch('behavior', { position: e.target.value })} className="select">{POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div><label className="label">Auto-open Delay (ms)</label><input type="number" value={config.behavior.autoOpenDelay} onChange={(e) => patch('behavior', { autoOpenDelay: parseInt(e.target.value) })} className="input" /></div>
              <div><label className="label">Offset X</label><input type="number" value={config.behavior.offsetX} onChange={(e) => patch('behavior', { offsetX: parseInt(e.target.value) })} className="input" /></div>
              <div><label className="label">Offset Y</label><input type="number" value={config.behavior.offsetY} onChange={(e) => patch('behavior', { offsetY: parseInt(e.target.value) })} className="input" /></div>
              <div><label className="label">Session Duration (s)</label><input type="number" value={config.behavior.sessionDuration} onChange={(e) => patch('behavior', { sessionDuration: parseInt(e.target.value) })} className="input" /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.behavior.autoOpen} onChange={(e) => patch('behavior', { autoOpen: e.target.checked })} /> Auto-open</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.behavior.showOnMobile} onChange={(e) => patch('behavior', { showOnMobile: e.target.checked })} /> Show on mobile</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.behavior.persistSession} onChange={(e) => patch('behavior', { persistSession: e.target.checked })} /> Persist session</label>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card card-p">
            <h2 className="text-lg font-semibold mb-3">Widget Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-slate-500">Status:</span> <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${widget.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{widget.status}</span></div>
              <div><span className="font-medium text-slate-500">Agent ID:</span> <span className="ml-2 font-mono text-xs">{widget.agentId}</span></div>
              <div><span className="font-medium text-slate-500">Widget ID:</span> <span className="ml-2 font-mono text-xs">{widget.id}</span></div>
            </div>
          </div>

          <div className="card card-p">
            <h2 className="text-lg font-semibold mb-3">Embed Code</h2>
            <p className="text-sm text-slate-500 mb-3">Add this to your website&apos;s HTML to embed the chat widget.</p>
            <div className="relative">
              <pre className="p-4 bg-slate-50 rounded text-sm overflow-x-auto border">{getEmbedCode()}</pre>
              <button onClick={copyEmbed} className="absolute top-2 right-2 px-3 py-1 text-xs bg-white border rounded shadow hover:bg-slate-50">{copied ? 'Copied!' : 'Copy'}</button>
            </div>
          </div>

          {domains.length > 0 && (
            <div className="card card-p">
              <h2 className="text-lg font-semibold mb-3">Allowed Domains</h2>
              <div className="flex flex-wrap gap-2">{domains.map((d: string) => <span key={d} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{d}</span>)}</div>
            </div>
          )}

          <div className="card card-p">
            <h2 className="text-lg font-semibold mb-3">Configuration</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium text-slate-500">Voice:</span> <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${config.voice.enabled ? 'badge-green' : 'badge-gray'}`}>{config.voice.enabled ? `Enabled · ${config.voice.language}` : 'Disabled'}</span></div>
              <div><span className="font-medium text-slate-500">Features:</span> {Object.entries(config.features).filter(([, v]) => v).map(([k]) => <span key={k} className="ml-1 px-2 py-0.5 bg-slate-100 rounded-full text-xs">{k}</span>)}</div>
              <div><span className="font-medium text-slate-500">Position:</span> <span className="ml-2">{config.behavior.position}</span></div>
              {config.branding.companyName && <div><span className="font-medium text-slate-500">Company:</span> <span className="ml-2">{config.branding.companyName}</span></div>}
              {config.chat.greeting && <div><span className="font-medium text-slate-500">Greeting:</span> <span className="ml-2">{config.chat.greeting}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
