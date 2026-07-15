'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadAgent(); });
  }, [params.id]);

  async function loadAgent() {
    try {
      setLoading(true);
      const data = await api.agents.get(params.id);
      setAgent(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!agent) return <div className="p-8">Agent not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">{agent.name}</h1>
      <div className="space-y-4">
        <div><span className="font-medium">Status:</span> {agent.status}</div>
        <div><span className="font-medium">Model:</span> {agent.config?.model}</div>
        <div><span className="font-medium">Temperature:</span> {agent.config?.temperature}</div>
        {agent.config?.systemPrompt && (
          <div>
            <span className="font-medium">System Prompt:</span>
            <pre className="mt-2 p-4 bg-gray-50 rounded whitespace-pre-wrap text-sm">{agent.config.systemPrompt}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
