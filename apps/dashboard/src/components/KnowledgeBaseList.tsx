'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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
    try {
      const kb = await api.knowledge.create({ name: newName, description: newDescription });
      setKnowledgeBases([kb, ...knowledgeBases]);
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge base');
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

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Knowledge Bases</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create Knowledge Base
        </button>
      </div>

      {showCreate && (
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="My Knowledge Base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200">
        {knowledgeBases.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No knowledge bases yet. Create your first knowledge base to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {knowledgeBases.map((kb) => (
              <li key={kb.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-600 truncate">{kb.name}</p>
                    <p className="text-sm text-gray-500 truncate">{kb.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {kb.documentCount} documents, {kb.chunkCount} chunks
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`/knowledge/${kb.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Manage
                    </a>
                    <button
                      onClick={() => handleDelete(kb.id)}
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
