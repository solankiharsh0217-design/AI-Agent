'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, EmptyState, LoadingState } from '@/components/ui';
import { WidgetsIcon } from '@/components/icons';

interface Widget {
  id: string;
  name: string;
  agentId: string;
  status: string;
  domains: string[];
  createdAt: string;
}

export function WidgetsList() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWidgets() {
      try {
        const data = await api.widgets.list();
        if (!cancelled) setWidgets(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load widgets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadWidgets();
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this widget?')) return;
    try {
      await api.widgets.delete(id);
      setWidgets(widgets.filter((w) => w.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete widget');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <div className="card p-4 text-sm text-red-600">{error}</div>;

  if (widgets.length === 0) {
    return (
      <EmptyState
        icon={<WidgetsIcon />}
        title="No widgets yet"
        description="Create a widget to embed chat and voice on your website."
        actionLabel="Create Widget"
        actionHref="/widgets/new"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {widgets.map((widget) => (
        <div key={widget.id} className="card flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/widgets/${widget.id}`} className="min-w-0">
              <h3 className="truncate font-semibold text-slate-900 hover:text-indigo-600">{widget.name}</h3>
            </Link>
            <Badge tone={widget.status === 'active' ? 'green' : 'gray'}>{widget.status}</Badge>
          </div>
          <div className="mt-3 flex-1 space-y-1 text-xs text-slate-500">
            <div>
              <span className="text-slate-400">Domains: </span>
              {widget.domains?.length > 0 ? widget.domains.join(', ') : 'None configured'}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
            <Link href={`/widgets/${widget.id}`} className="btn-secondary btn-sm">Configure</Link>
            <button onClick={() => handleDelete(widget.id)} className="btn-ghost btn-sm ml-auto text-red-600 hover:bg-red-50">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
