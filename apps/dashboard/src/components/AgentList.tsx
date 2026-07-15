'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
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

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Agents</h3>
        <a
          href="/agents/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create Agent
        </a>
      </div>
      <div className="border-t border-gray-200">
        {agents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No agents yet. Create your first agent to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {agents.map((agent) => (
              <li key={agent.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-600 truncate">{agent.name}</p>
                    <p className="text-sm text-gray-500 truncate">{agent.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      agent.status === 'published' ? 'bg-green-100 text-green-800' :
                      agent.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {agent.status}
                    </span>
                    <button
                      onClick={() => handlePublish(agent.id)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Publish
                    </button>
                    <a
                      href={`/agents/${agent.id}`}
                      className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleDelete(agent.id)}
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
