'use client';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.push('/sign-in'); return; }
    if (isLoaded && isSignedIn) {
      loadData();
    }
  }, [params.id, isLoaded, isSignedIn]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [convData, msgData] = await Promise.all([
        api.conversations.get(params.id),
        api.conversations.getMessages(params.id),
      ]);
      setConversation(convData);
      setMessages(msgData.reverse());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | undefined) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  }

  function formatDuration(seconds: number | undefined): string {
    if (!seconds || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!conversation) return <div className="p-8">Conversation not found</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Conversation Metadata */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{conversation.id}</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            conversation.status === 'active' ? 'bg-green-100 text-green-800' :
            conversation.status === 'ended' ? 'bg-gray-100 text-gray-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {conversation.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Channel</p>
            <p className="font-medium capitalize">{conversation.channel}</p>
          </div>
          <div>
            <p className="text-gray-500">Agent</p>
            <p className="font-medium">{conversation.agentId}</p>
          </div>
          <div>
            <p className="text-gray-500">Started</p>
            <p className="font-medium">{formatDate(conversation.startedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Ended</p>
            <p className="font-medium">{formatDate(conversation.endedAt)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-500">Message Count</p>
            <p className="font-medium">{conversation.messageCount ?? messages.length}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-500">Total Tokens</p>
            <p className="font-medium">{conversation.totalTokens?.toLocaleString() ?? '0'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-gray-500">Total Cost</p>
            <p className="font-medium">${(conversation.totalCostUsd ?? 0).toFixed(4)}</p>
          </div>
        </div>

        {conversation.summary && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <p className="text-sm font-medium text-gray-700">Summary</p>
            <p className="mt-1 text-sm text-gray-600">{conversation.summary}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No messages in this conversation</div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} className={`p-4 rounded ${msg.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'}`}>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span className="font-medium capitalize">{msg.role}</span>
                <span>•</span>
                <span>{formatDate(msg.createdAt || msg.timestamp)}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
