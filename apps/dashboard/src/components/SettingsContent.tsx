'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export function SettingsContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const userData = await api.user.me();
        if (!cancelled) {
          setUser(userData);
          setName(userData.name || '');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveName() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.user.update({ name });
      setUser(prev => prev ? { ...prev, name: updated?.name ?? name } : null);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Account Information</h3>
        </div>
        <div className="px-6 py-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="label">Email</label>
                <p className="text-sm text-slate-900">{user?.email ?? 'N/A'}</p>
              </div>
              <div>
                <label className="label">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" />
              </div>
              {saveError && <div className="text-sm text-red-600">{saveError}</div>}
              <div className="flex gap-2">
                <button onClick={handleSaveName} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setName(user?.name || ''); setEditing(false); }} className="btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-sm text-slate-900">{user?.email ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-sm text-slate-900">{user?.name ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Role</dt>
                <dd className="mt-1 text-sm capitalize text-slate-900">{user?.role ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Tenant ID</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">{user?.tenantId ?? 'N/A'}</dd>
              </div>
            </dl>
          )}
          {!editing && (
            <div className="mt-5">
              <button onClick={() => setEditing(true)} className="btn-secondary">Edit Profile</button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Subscription &amp; Billing</h3>
          <p className="mt-1 text-sm text-slate-500">Manage your subscription and view invoices on the Billing page.</p>
        </div>
        <div className="px-6 py-5">
          <Link href="/billing" className="btn-primary">Go to Billing</Link>
        </div>
      </div>
    </div>
  );
}
