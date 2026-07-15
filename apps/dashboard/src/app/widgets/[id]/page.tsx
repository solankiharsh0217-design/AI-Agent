'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

const WIDGET_APP_URL = 'https://widget-deploy-alpha.vercel.app';
const API_URL = 'https://api-worker.orbitcrew2026.workers.dev';

export default function WidgetDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [widget, setWidget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    config: {
      chat: { greeting: string; placeholder: string; suggestedPrompts: string[]; enterToSend: boolean };
      theme: { primaryColor: string; secondaryColor: string; textColor: string; surfaceColor: string };
      branding: { companyName: string; logo: string; tagline: string };
    };
    status: string;
    domains: string[];
  }>({
    name: '',
    config: {
      chat: { greeting: '', placeholder: '', suggestedPrompts: [], enterToSend: true },
      theme: { primaryColor: '#3B82F6', secondaryColor: '#e5e7eb', textColor: '#1E293B', surfaceColor: '#F8FAFC' },
      branding: { companyName: '', logo: '', tagline: '' },
    },
    status: 'active',
    domains: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadWidget(); });
  }, [params.id]);

  async function loadWidget() {
    try {
      const data = await api.widgets.get(params.id);
      setWidget(data);
      setFormData({
        name: data.name,
        config: data.config || formData.config,
        status: data.status || 'active',
        domains: data.domains || [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.widgets.update(params.id, {
        name: formData.name,
        config: formData.config,
        status: formData.status,
        domains: formData.domains,
      });
      setEditing(false);
      await loadWidget();
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function getEmbedCode() {
    return `<script src="${WIDGET_APP_URL}/embed.js" data-widget-id="${widget.id}" data-api-url="${API_URL}"></script>`;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!widget) return <div className="p-8">Not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{editing ? 'Edit Widget' : widget.name}</h1>
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
                onClick={() => { setEditing(false); setFormData({ name: widget.name, config: widget.config || formData.config, status: widget.status || 'active', domains: widget.domains || [] }); }}
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
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Allowed Domains</h2>
            <div className="space-y-2">
              {formData.domains.map((domain, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={domain}
                    onChange={e => {
                      const newDomains = [...formData.domains];
                      newDomains[index] = e.target.value;
                      setFormData(prev => ({ ...prev, domains: newDomains }));
                    }}
                    placeholder="example.com"
                    className="flex-1 px-3 py-2 border rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newDomains = formData.domains.filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, domains: newDomains }));
                    }}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, domains: [...prev.domains, ''] }))}
                className="px-3 py-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Domain
              </button>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Chat Configuration</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Greeting</label>
                <input
                  type="text"
                  value={formData.config.chat?.greeting || ''}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, greeting: e.target.value } } }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Placeholder</label>
                <input
                  type="text"
                  value={formData.config.chat?.placeholder || ''}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, placeholder: e.target.value } } }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Suggested Prompts (one per line)</label>
                <textarea
                  value={formData.config.chat?.suggestedPrompts?.join('\n') || ''}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, suggestedPrompts: e.target.value.split('\n').filter(s => s.trim()) } } }))}
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.config.chat?.enterToSend !== false}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, enterToSend: e.target.checked } } }))}
                />
                <label className="text-sm">Enter to send</label>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Theme & Branding</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Primary Color</label>
                <input
                  type="color"
                  value={formData.config.theme?.primaryColor || '#3B82F6'}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, theme: { ...prev.config.theme, primaryColor: e.target.value } } }))}
                  className="w-full h-10 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Secondary Color</label>
                <input
                  type="color"
                  value={formData.config.theme?.secondaryColor || '#e5e7eb'}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, theme: { ...prev.config.theme, secondaryColor: e.target.value } } }))}
                  className="w-full h-10 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Text Color</label>
                <input
                  type="color"
                  value={formData.config.theme?.textColor || '#1E293B'}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, theme: { ...prev.config.theme, textColor: e.target.value } } }))}
                  className="w-full h-10 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Surface Color</label>
                <input
                  type="color"
                  value={formData.config.theme?.surfaceColor || '#F8FAFC'}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, theme: { ...prev.config.theme, surfaceColor: e.target.value } } }))}
                  className="w-full h-10 border rounded"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.config.branding?.companyName || ''}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, branding: { ...prev.config.branding, companyName: e.target.value } } }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.config.branding?.tagline || ''}
                  onChange={e => setFormData(prev => ({ ...prev, config: { ...prev.config, branding: { ...prev.config.branding, tagline: e.target.value } } }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3">Widget Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">Status:</span> <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${widget.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{widget.status}</span></div>
              <div><span className="font-medium text-gray-500">Agent ID:</span> <span className="ml-2 font-mono text-xs">{widget.agentId}</span></div>
              <div><span className="font-medium text-gray-500">Widget ID:</span> <span className="ml-2 font-mono text-xs">{widget.id}</span></div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3">Embed Code</h2>
            <p className="text-sm text-gray-500 mb-3">Add this to your website&apos;s HTML to embed the chat widget.</p>
            <div className="relative">
              <pre className="p-4 bg-gray-50 rounded text-sm overflow-x-auto border">{getEmbedCode()}</pre>
              <button onClick={copyEmbed} className="absolute top-2 right-2 px-3 py-1 text-xs bg-white border rounded shadow hover:bg-gray-50">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {widget.domains && widget.domains.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">Allowed Domains</h2>
              <div className="flex flex-wrap gap-2">
                {widget.domains.map((d: string) => (
                  <span key={d} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{d}</span>
                ))}
              </div>
            </div>
          )}

          {widget.config && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">Configuration</h2>
              <div className="space-y-2 text-sm">
                {widget.config.chat?.greeting && <div><span className="font-medium text-gray-500">Greeting:</span> <span className="ml-2">{widget.config.chat.greeting}</span></div>}
                {widget.config.theme?.primaryColor && <div><span className="font-medium text-gray-500">Primary Color:</span> <span className="ml-2 inline-block w-4 h-4 rounded border" style={{ backgroundColor: widget.config.theme.primaryColor }}></span> {widget.config.theme.primaryColor}</div>}
                {widget.config.branding?.companyName && <div><span className="font-medium text-gray-500">Company:</span> <span className="ml-2">{widget.config.branding.companyName}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
