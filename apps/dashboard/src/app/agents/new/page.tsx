'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api, setClerkToken } from '@/lib/api';
import { PageContainer, PageHeader, FormError } from '@/components/ui';
import { AgentConfigForm, defaultAgentFormConfig, formToConfig, AgentFormConfig } from '@/components/AgentConfigForm';

export default function NewAgentPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [form, setForm] = useState<AgentFormConfig>(defaultAgentFormConfig());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.push('/sign-in'); return; }
    getToken().then((t) => setClerkToken(t));
  }, [isLoaded, isSignedIn]);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const agent = await api.agents.create({
        name,
        description,
        config: formToConfig(form),
      });
      router.push(`/agents/${agent.id}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to create agent.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Create Agent" description="Configure a new AI agent." />
      <div className="card card-p space-y-6">
        <FormError message={error} />
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" rows={3} />
        </div>

        <AgentConfigForm form={form} setForm={setForm} />

        <div className="flex gap-3">
          <button onClick={handleCreate} disabled={saving || !name.trim()} className="btn-primary">
            {saving ? 'Creating…' : 'Create Agent'}
          </button>
          <button onClick={() => router.push('/agents')} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </PageContainer>
  );
}
