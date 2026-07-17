'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, EmptyState, LoadingState } from '@/components/ui';
import { ConversationsIcon } from '@/components/icons';

interface Conversation {
  id: string;
  agentId: string;
  channel: string;
  status: string;
  createdAt: string;
}

export function ConversationsList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadConversations() {
      setLoading(true);
      try {
        const response = await api.conversations.list({ page, limit: 20 });
        if (!cancelled) {
          // Replace (not append) so Previous/Next paginate correctly.
          setConversations(response.data);
          setTotalPages(response.meta.totalPages);
          setTotal(response.meta.total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadConversations();
    return () => { cancelled = true; };
  }, [page]);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await api.conversations.delete(id);
      setConversations(conversations.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }

  if (loading && conversations.length === 0) return <LoadingState />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<ConversationsIcon />}
        title="No conversations yet"
        description="Once people chat or call your agents, their conversations will appear here."
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-sm font-medium text-slate-500">{total} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Conversation</th>
              <th className="px-5 py-3">Channel</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Started</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {conversations.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/conversations/${c.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                    {c.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-5 py-3 capitalize text-slate-600">{c.channel}</td>
                <td className="px-5 py-3">
                  <Badge tone={c.status === 'active' ? 'green' : c.status === 'ended' ? 'gray' : 'amber'}>{c.status}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-500">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/conversations/${c.id}`} className="btn-ghost btn-sm text-indigo-600 hover:bg-indigo-50">View</Link>
                    <button onClick={() => handleDelete(c.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1 || loading} className="btn-secondary btn-sm">Previous</button>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
