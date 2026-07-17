'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Groq)' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B (Groq)' },
];

const PROVIDERS = [
  { value: 'groq', label: 'Groq' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
];

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

const RESPONSE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'json_object', label: 'JSON object' },
  { value: 'json_schema', label: 'JSON schema' },
];

export interface AgentFormConfig {
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  knowledgeBaseIds: string[];
  tools: { id: string; name: string; description: string; enabled: boolean; requireConfirmation: boolean }[];
  memoryConfig: { enabled: boolean; maxMessages: number; maxTokens: number };
  voiceConfig: {
    enabled: boolean;
    language: string;
    voiceId: string;
    speed: number;
    sttProvider?: string;
    ttsProvider?: string;
    vadEnabled?: boolean;
  } | null;
  responseFormat: { type: string; schema: string };
  guardrails: {
    enabled: boolean;
    piiDetection: boolean;
    profanityFilter: boolean;
    topicRestrictions: string;
    customRules: { name: string; pattern: string; action: string; message: string }[];
  };
}

export function defaultAgentFormConfig(): AgentFormConfig {
  return {
    model: 'llama-3.3-70b-versatile',
    provider: 'groq',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: '',
    knowledgeBaseIds: [],
    tools: [],
    memoryConfig: { enabled: true, maxMessages: 20, maxTokens: 4000 },
    voiceConfig: null,
    responseFormat: { type: 'text', schema: '' },
    guardrails: { enabled: true, piiDetection: true, profanityFilter: true, topicRestrictions: '', customRules: [] },
  };
}

export function configToForm(cfg: any): AgentFormConfig {
  const v = cfg?.voiceConfig || null;
  return {
    model: cfg?.model || 'llama-3.3-70b-versatile',
    provider: cfg?.provider || 'groq',
    temperature: cfg?.temperature ?? 0.7,
    maxTokens: cfg?.maxTokens ?? 2048,
    systemPrompt: cfg?.systemPrompt || '',
    knowledgeBaseIds: cfg?.knowledgeBaseIds || [],
    tools: (cfg?.tools || []).map((t: any) => ({
      id: t.id || crypto.randomUUID(),
      name: t.name || '',
      description: t.description || '',
      enabled: t.enabled ?? true,
      requireConfirmation: t.requireConfirmation ?? false,
    })),
    memoryConfig: {
      enabled: cfg?.memoryConfig?.enabled ?? true,
      maxMessages: cfg?.memoryConfig?.maxMessages ?? 20,
      maxTokens: cfg?.memoryConfig?.maxTokens ?? 4000,
    },
    voiceConfig: v
      ? {
          enabled: v.enabled ?? false,
          language: v.language || 'en-IN',
          voiceId: v.voiceId || '',
          speed: v.speed ?? 1.0,
          sttProvider: v.sttProvider || 'sarvam',
          ttsProvider: v.ttsProvider || 'sarvam',
          vadEnabled: v.vadEnabled ?? true,
        }
      : null,
    responseFormat: {
      type: cfg?.responseFormat?.type || 'text',
      schema: cfg?.responseFormat?.schema ? JSON.stringify(cfg.responseFormat.schema) : '',
    },
    guardrails: {
      enabled: cfg?.guardrails?.enabled ?? true,
      piiDetection: cfg?.guardrails?.piiDetection ?? true,
      profanityFilter: cfg?.guardrails?.profanityFilter ?? true,
      topicRestrictions: (cfg?.guardrails?.topicRestrictions || []).join(', '),
      customRules: (cfg?.guardrails?.customRules || []).map((r: any) => ({
        name: r.name || '',
        pattern: r.pattern || '',
        action: r.action || 'block',
        message: r.message || '',
      })),
    },
  };
}

export function formToConfig(form: AgentFormConfig): any {
  const config: any = {
    model: form.model,
    provider: form.provider,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    systemPrompt: form.systemPrompt,
    knowledgeBaseIds: form.knowledgeBaseIds,
    tools: form.tools
      .filter((t) => t.name.trim())
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        enabled: t.enabled,
        requireConfirmation: t.requireConfirmation,
      })),
    memoryConfig: form.memoryConfig,
    responseFormat: {
      type: form.responseFormat.type,
      schema: form.responseFormat.type === 'json_schema' && form.responseFormat.schema.trim()
        ? JSON.parse(form.responseFormat.schema)
        : null,
    },
    guardrails: {
      enabled: form.guardrails.enabled,
      piiDetection: form.guardrails.piiDetection,
      profanityFilter: form.guardrails.profanityFilter,
      topicRestrictions: form.guardrails.topicRestrictions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      customRules: form.guardrails.customRules
        .filter((r) => r.name.trim() && r.pattern.trim())
        .map((r) => ({ id: crypto.randomUUID(), name: r.name, pattern: r.pattern, action: r.action, message: r.message || null })),
    },
  };
  if (form.voiceConfig?.enabled) {
    config.voiceConfig = {
      enabled: true,
      language: form.voiceConfig.language,
      voiceId: form.voiceConfig.voiceId || null,
      speed: form.voiceConfig.speed,
      sttProvider: form.voiceConfig.sttProvider || 'sarvam',
      ttsProvider: form.voiceConfig.ttsProvider || 'sarvam',
      vadEnabled: form.voiceConfig.vadEnabled ?? true,
    };
  } else {
    config.voiceConfig = null;
  }
  return config;
}

export function AgentConfigForm({
  form,
  setForm,
}: {
  form: AgentFormConfig;
  setForm: (updater: (prev: AgentFormConfig) => AgentFormConfig) => void;
}) {
  const [knowledgeBases, setKnowledgeBases] = useState<{ id: string; name: string }[]>([]);
  const [kbLoading, setKbLoading] = useState(true);

  // Load knowledge bases once for the multi-select.
  useState(() => {
    api.knowledge
      .list()
      .then((kbs) => setKnowledgeBases((kbs || []).map((k: any) => ({ id: k.id, name: k.name }))))
      .catch(() => {})
      .finally(() => setKbLoading(false));
  });

  const patch = (p: Partial<AgentFormConfig>) => setForm((prev) => ({ ...prev, ...p }));
  const patchVoice = (p: any) =>
    setForm((prev) => ({ ...prev, voiceConfig: { enabled: true, language: 'en-IN', voiceId: '', speed: 1, sttProvider: 'sarvam', ttsProvider: 'sarvam', vadEnabled: true, ...prev.voiceConfig, ...p } }));
  const patchMemory = (p: any) => setForm((prev) => ({ ...prev, memoryConfig: { ...prev.memoryConfig, ...p } }));
  const patchGuardrails = (p: any) => setForm((prev) => ({ ...prev, guardrails: { ...prev.guardrails, ...p } }));

  const toggleKb = (id: string) =>
    setForm((prev) => ({
      ...prev,
      knowledgeBaseIds: prev.knowledgeBaseIds.includes(id)
        ? prev.knowledgeBaseIds.filter((x) => x !== id)
        : [...prev.knowledgeBaseIds, id],
    }));

  const addTool = () =>
    setForm((prev) => ({ ...prev, tools: [...prev.tools, { id: crypto.randomUUID(), name: '', description: '', enabled: true, requireConfirmation: false }] }));
  const updateTool = (id: string, p: any) =>
    setForm((prev) => ({ ...prev, tools: prev.tools.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const removeTool = (id: string) => setForm((prev) => ({ ...prev, tools: prev.tools.filter((t) => t.id !== id) }));

  const addRule = () =>
    setForm((prev) => ({ ...prev, guardrails: { ...prev.guardrails, customRules: [...prev.guardrails.customRules, { name: '', pattern: '', action: 'block', message: '' }] } }));
  const updateRule = (i: number, p: any) =>
    setForm((prev) => ({
      ...prev,
      guardrails: { ...prev.guardrails, customRules: prev.guardrails.customRules.map((r, idx) => (idx === i ? { ...r, ...p } : r)) },
    }));
  const removeRule = (i: number) =>
    setForm((prev) => ({ ...prev, guardrails: { ...prev.guardrails, customRules: prev.guardrails.customRules.filter((_, idx) => idx !== i) } }));

  return (
    <div className="space-y-8">
      {/* Model & generation */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Model & Generation</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Provider</label>
            <select className="select" value={form.provider} onChange={(e) => patch({ provider: e.target.value })}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Model</label>
            <select className="select" value={form.model} onChange={(e) => patch({ model: e.target.value })}>
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Temperature</label>
            <input type="number" step="0.1" min="0" max="2" className="input" value={form.temperature} onChange={(e) => patch({ temperature: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Max Tokens</label>
            <input type="number" min="1" max="32768" className="input" value={form.maxTokens} onChange={(e) => patch({ maxTokens: parseInt(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">System Prompt</label>
          <textarea className="textarea font-mono text-sm" rows={6} value={form.systemPrompt} onChange={(e) => patch({ systemPrompt: e.target.value })} placeholder="You are a helpful AI assistant..." />
        </div>
      </section>

      {/* Knowledge */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Knowledge Bases</h2>
        {kbLoading ? (
          <p className="text-sm text-slate-400">Loading knowledge bases…</p>
        ) : knowledgeBases.length === 0 ? (
          <p className="text-sm text-slate-500">No knowledge bases yet. Create one under Knowledge.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {knowledgeBases.map((kb) => (
              <label key={kb.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={form.knowledgeBaseIds.includes(kb.id)} onChange={() => toggleKb(kb.id)} />
                <span>{kb.name}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Tools */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Tools</h2>
          <button type="button" onClick={addTool} className="btn-secondary btn-sm">+ Add tool</button>
        </div>
        {form.tools.length === 0 && <p className="text-sm text-slate-500">No tools configured.</p>}
        {form.tools.map((t) => (
          <div key={t.id} className="rounded-md border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className="input flex-1" placeholder="Tool name" value={t.name} onChange={(e) => updateTool(t.id, { name: e.target.value })} />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={t.enabled} onChange={(e) => updateTool(t.id, { enabled: e.target.checked })} /> Enabled
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={t.requireConfirmation} onChange={(e) => updateTool(t.id, { requireConfirmation: e.target.checked })} /> Confirm
              </label>
              <button type="button" onClick={() => removeTool(t.id)} className="text-red-600 text-xs">Remove</button>
            </div>
            <textarea className="textarea text-sm" rows={2} placeholder="Description" value={t.description} onChange={(e) => updateTool(t.id, { description: e.target.value })} />
          </div>
        ))}
      </section>

      {/* Memory */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Memory</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.memoryConfig.enabled} onChange={(e) => patchMemory({ enabled: e.target.checked })} /> Enable conversation memory
        </label>
        {form.memoryConfig.enabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Max Messages</label>
              <input type="number" className="input" value={form.memoryConfig.maxMessages} onChange={(e) => patchMemory({ maxMessages: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="label">Max Tokens</label>
              <input type="number" className="input" value={form.memoryConfig.maxTokens} onChange={(e) => patchMemory({ maxTokens: parseInt(e.target.value) })} />
            </div>
          </div>
        )}
      </section>

      {/* Voice */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <input id="voice-enabled" type="checkbox" checked={!!form.voiceConfig?.enabled} onChange={(e) => patch({ voiceConfig: e.target.checked ? (form.voiceConfig || { enabled: true, language: 'en-IN', voiceId: '', speed: 1, sttProvider: 'sarvam', ttsProvider: 'sarvam', vadEnabled: true }) : null })} />
          <label htmlFor="voice-enabled" className="text-lg font-semibold text-slate-900">Voice (phone & voice widgets)</label>
        </div>
        {form.voiceConfig?.enabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Language</label>
              <select className="select" value={form.voiceConfig.language} onChange={(e) => patchVoice({ language: e.target.value })}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Voice ID <span className="text-slate-400">(optional)</span></label>
              <input className="input" placeholder="e.g. meera (blank = default)" value={form.voiceConfig.voiceId} onChange={(e) => patchVoice({ voiceId: e.target.value })} />
            </div>
            <div>
              <label className="label">Speed</label>
              <input type="number" step="0.1" min="0.5" max="2" className="input" value={form.voiceConfig.speed} onChange={(e) => patchVoice({ speed: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="label">STT Provider</label>
              <select className="select" value={form.voiceConfig.sttProvider} onChange={(e) => patchVoice({ sttProvider: e.target.value })}>
                <option value="sarvam">Sarvam</option>
                <option value="deepgram">Deepgram</option>
              </select>
            </div>
            <div>
              <label className="label">TTS Provider</label>
              <select className="select" value={form.voiceConfig.ttsProvider} onChange={(e) => patchVoice({ ttsProvider: e.target.value })}>
                <option value="sarvam">Sarvam</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.voiceConfig.vadEnabled} onChange={(e) => patchVoice({ vadEnabled: e.target.checked })} /> Voice activity detection
            </label>
          </div>
        )}
      </section>

      {/* Response format */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Response Format</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Type</label>
            <select className="select" value={form.responseFormat.type} onChange={(e) => patch({ responseFormat: { ...form.responseFormat, type: e.target.value } })}>
              {RESPONSE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {form.responseFormat.type === 'json_schema' && (
            <div>
              <label className="label">JSON Schema</label>
              <textarea className="textarea font-mono text-xs" rows={4} placeholder='{"type":"object",...}' value={form.responseFormat.schema} onChange={(e) => patch({ responseFormat: { ...form.responseFormat, schema: e.target.value } })} />
            </div>
          )}
        </div>
      </section>

      {/* Guardrails */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Guardrails</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.guardrails.enabled} onChange={(e) => patchGuardrails({ enabled: e.target.checked })} /> Enable guardrails
        </label>
        {form.guardrails.enabled && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.guardrails.piiDetection} onChange={(e) => patchGuardrails({ piiDetection: e.target.checked })} /> PII detection</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.guardrails.profanityFilter} onChange={(e) => patchGuardrails({ profanityFilter: e.target.checked })} /> Profanity filter</label>
            <div>
              <label className="label">Topic restrictions (comma-separated)</label>
              <input className="input" placeholder="politics, religion" value={form.guardrails.topicRestrictions} onChange={(e) => patchGuardrails({ topicRestrictions: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Custom rules</span>
                <button type="button" onClick={addRule} className="btn-secondary btn-sm">+ Add rule</button>
              </div>
              {form.guardrails.customRules.map((r, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-4">
                  <input className="input" placeholder="Name" value={r.name} onChange={(e) => updateRule(i, { name: e.target.value })} />
                  <input className="input" placeholder="Pattern (regex)" value={r.pattern} onChange={(e) => updateRule(i, { pattern: e.target.value })} />
                  <select className="select" value={r.action} onChange={(e) => updateRule(i, { action: e.target.value })}>
                    <option value="block">Block</option>
                    <option value="flag">Flag</option>
                    <option value="rewrite">Rewrite</option>
                  </select>
                  <div className="flex gap-1">
                    <input className="input" placeholder="Message" value={r.message} onChange={(e) => updateRule(i, { message: e.target.value })} />
                    <button type="button" onClick={() => removeRule(i)} className="text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
