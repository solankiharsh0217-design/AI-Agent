'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function KnowledgeBaseDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [kb, setKb] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadData(); });
  }, [params.id]);

  async function loadData() {
    try {
      const [kbData, docsData] = await Promise.all([
        api.knowledge.get(params.id),
        api.knowledge.listDocuments(params.id),
      ]);
      setKb(kbData);
      setDocuments(docsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!kb) return <div className="p-8">Not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">{kb.name}</h1>
      <div className="mb-6">
        <span className="text-sm text-gray-500">{documents.length} documents</span>
      </div>
      <div className="space-y-3">
        {documents.map(doc => (
          <div key={doc.id} className="p-4 border rounded">
            <div className="font-medium">{doc.filename}</div>
            <div className="text-sm text-gray-500">{doc.status} - {doc.chunkCount ?? 0} chunks</div>
          </div>
        ))}
      </div>
    </div>
  );
}
