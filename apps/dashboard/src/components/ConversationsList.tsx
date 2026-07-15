'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

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
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadConversations() {
      try {
        const data = await api.conversations.list({ page, limit: 20 });
        if (!cancelled) {
          if (page === 1) {
            setConversations(data);
          } else {
            setConversations((prev) => [...prev, ...data]);
          }
          setHasMore(data.length === 20);
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

  if (loading && conversations.length === 0) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Conversations</h3>
      </div>
      <div className="border-t border-gray-200">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">No conversations yet.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-600 truncate">{conversation.id}</p>
                    <p className="text-sm text-gray-500">
                      Channel: {conversation.channel} | Agent: {conversation.agentId}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(conversation.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      conversation.status === 'active' ? 'bg-green-100 text-green-800' :
                      conversation.status === 'ended' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {conversation.status}
                    </span>
                    <a
                      href={`/conversations/${conversation.id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(conversation.id)}
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
        {hasMore && conversations.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(page + 1)}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
