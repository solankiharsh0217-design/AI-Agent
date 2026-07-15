'use client';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { api, setClerkToken } from '@/lib/api';

export default function WidgetDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const [widget, setWidget] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(t => { setClerkToken(t); loadWidget(); });
  }, [params.id]);

  async function loadWidget() {
    try {
      const data = await api.widgets.get(params.id);
      setWidget(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!widget) return <div className="p-8">Not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">{widget.name}</h1>
      <div className="space-y-4">
        <div><span className="font-medium">Status:</span> {widget.status}</div>
        <div>
          <span className="font-medium">Embed Code:</span>
          <pre className="mt-2 p-4 bg-gray-50 rounded text-sm overflow-x-auto">
            {`<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/widget.js" data-widget-id="${widget.id}" data-api-url="${typeof window !== 'undefined' ? window.location.origin : ''}"></script>`}
          </pre>
        </div>
        {widget.config?.domains?.length > 0 && (
          <div><span className="font-medium">Allowed Domains:</span> {widget.config.domains.join(', ')}</div>
        )}
      </div>
    </div>
  );
}
