'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Widgets</h3>
        <a
          href="/widgets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create Widget
        </a>
      </div>
      <div className="border-t border-gray-200">
        {widgets.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No widgets yet. Create your first widget to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {widgets.map((widget) => (
              <li key={widget.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-600 truncate">{widget.name}</p>
                    <p className="text-sm text-gray-500">Agent: {widget.agentId}</p>
                    <p className="text-xs text-gray-400">
                      Domains: {widget.domains?.length > 0 ? widget.domains.join(', ') : 'None configured'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      widget.status === 'active' ? 'bg-green-100 text-green-800' :
                      widget.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {widget.status}
                    </span>
                    <a
                      href={`/widgets/${widget.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(widget.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
