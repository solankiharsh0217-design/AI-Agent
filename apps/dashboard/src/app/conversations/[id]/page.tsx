'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadMessages(); });
  }, [params.id]);

  async function loadMessages() {
    try {
      const data = await api.conversations.getMessages(params.id);
      setMessages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Conversation</h1>
      <div className="space-y-4">
        {messages.map((msg: any) => (
          <div key={msg.id} className={`p-4 rounded ${msg.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'}`}>
            <div className="text-xs text-gray-500 mb-1">{msg.role} - {new Date(msg.createdAt).toLocaleString()}</div>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
