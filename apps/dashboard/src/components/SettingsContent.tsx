'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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

  async function handleSaveName() {
    try {
      // The API doesn't have a user update endpoint yet, so we'll just update local state
      // In a real app, you'd call an update endpoint here
      setUser(prev => prev ? { ...prev, name } : null);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Account Information</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          {editing ? (
            <div className="space-y-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user?.email ?? 'N/A'}</p>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveName}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => { setName(user?.name || ''); setEditing(false); }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.email ?? 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.name ?? 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.role ?? 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Tenant ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{user?.tenantId ?? 'N/A'}</dd>
              </div>
            </dl>
          )}
          {!editing && (
            <div className="mt-4">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Subscription & Billing</h3>
          <p className="mt-1 text-sm text-gray-500">Manage your subscription and view invoices on the Billing page.</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <a
            href="/billing"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Go to Billing
          </a>
        </div>
      </div>
    </div>
  );
}
