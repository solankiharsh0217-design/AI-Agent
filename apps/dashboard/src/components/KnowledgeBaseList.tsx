'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EmptyState, LoadingState } from '@/components/ui';
import { KnowledgeIcon, PlusIcon } from '@/components/icons';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  status: string;
  createdAt: string;
}

export function KnowledgeBaseList() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadKnowledgeBases() {
      try {
        const data = await api.knowledge.list();
        if (!cancelled) setKnowledgeBases(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load knowledge bases');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadKnowledgeBases();
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const kb = await api.knowledge.create({ name: newName, description: newDescription });
      setKnowledgeBases([kb, ...knowledgeBases]);
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge base');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this knowledge base?')) return;
    try {
      await api.knowledge.delete(id);
      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete knowledge base');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(v => !v)} className="btn-primary">
          <PlusIcon width={16} height={16} /> New Knowledge Base
        </button>
      </div>

      {showCreate && (
        <div className="card-p space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="input" placeholder="My Knowledge Base" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} className="textarea" placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary">
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {knowledgeBases.length === 0 ? (
        <EmptyState
          icon={<KnowledgeIcon />}
          title="No knowledge bases yet"
          description="Create a knowledge base and upload documents so your agents can answer from your own content."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <div key={kb.id} className="card flex flex-col p-5">
              <Link href={`/knowledge/${kb.id}`} className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900 hover:text-indigo-600">{kb.name}</h3>
              </Link>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{kb.description || 'No description'}</p>
              <p className="mt-3 text-xs text-slate-400">{kb.documentCount} documents · {kb.chunkCount} chunks</p>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <Link href={`/knowledge/${kb.id}`} className="btn-secondary btn-sm">Manage</Link>
                <button onClick={() => handleDelete(kb.id)} className="btn-ghost btn-sm ml-auto text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
