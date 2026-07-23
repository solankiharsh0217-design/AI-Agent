'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import ChatWidget from '@/components/ChatWidget';

function WidgetContent() {
  const searchParams = useSearchParams();
  const widgetId = searchParams.get('widgetId') || '';
  const apiUrl = searchParams.get('apiUrl') || '';

  useEffect(() => {
    function handlePostMessage(event: MessageEvent) {
      const { type, payload } = event.data || {};
      if (!type) return;

      switch (type) {
        case 'chat:send':
          window.dispatchEvent(new CustomEvent('sdk:send', { detail: payload }));
          break;
        case 'widget:open':
          window.dispatchEvent(new CustomEvent('sdk:open'));
          break;
        case 'widget:close':
          window.dispatchEvent(new CustomEvent('sdk:close'));
          break;
      }

      // Reply so the SDK knows the widget is alive and can forward messages
      if (event.source && (event.source as Window).postMessage) {
        (event.source as Window).postMessage(
          { type: 'widget:ack', payload: { received: type } },
          { targetOrigin: '*' }
        );
      }
    }

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, []);

  if (!widgetId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Missing widgetId parameter</p>
      </div>
    );
  }

  if (!apiUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Missing apiUrl parameter</p>
      </div>
    );
  }

  return <ChatWidget widgetId={widgetId} apiUrl={apiUrl} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      }
    >
      <WidgetContent />
    </Suspense>
  );
}
