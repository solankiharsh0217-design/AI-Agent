'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/LoadingSkeleton';
import { Badge, EmptyState } from '@/components/ui';
import { AgentsIcon } from '@/components/icons';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

function statusTone(status: string): 'green' | 'amber' | 'gray' {
  if (status === 'published') return 'green';
  if (status === 'draft') return 'amber';
  return 'gray';
}

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      try {
        const data = await api.agents.list();
        if (!cancelled) setAgents(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAgents();
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await api.agents.delete(id);
      setAgents(agents.filter(a => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  }

  async function handlePublish(id: string) {
    try {
      const updated = await api.agents.publish(id);
      setAgents(agents.map(a => a.id === id ? updated : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish agent');
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this agent?')) return;
    try {
      const updated = await api.agents.archive(id);
      setAgents(agents.map(a => a.id === id ? updated : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive agent');
    }
  }

  if (loading) return <CardSkeleton />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={<AgentsIcon />}
        title="No agents yet"
        description="Create your first agent to start answering questions across chat, voice, and phone."
        actionLabel="Create Agent"
        actionHref="/agents/new"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <div key={agent.id} className="card flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/agents/${agent.id}`} className="min-w-0">
              <h3 className="truncate font-semibold text-slate-900 hover:text-indigo-600">{agent.name}</h3>
            </Link>
            <Badge tone={statusTone(agent.status)}>{agent.status}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">
            {agent.description || 'No description'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <Link href={`/agents/${agent.id}`} className="btn-secondary btn-sm">Edit</Link>
            {agent.status !== 'published' && agent.status !== 'archived' && (
              <button onClick={() => handlePublish(agent.id)} className="btn-ghost btn-sm text-indigo-600 hover:bg-indigo-50">Publish</button>
            )}
            {agent.status === 'published' && (
              <button onClick={() => handleArchive(agent.id)} className="btn-ghost btn-sm">Archive</button>
            )}
            <button onClick={() => handleDelete(agent.id)} className="btn-ghost btn-sm ml-auto text-red-600 hover:bg-red-50">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
