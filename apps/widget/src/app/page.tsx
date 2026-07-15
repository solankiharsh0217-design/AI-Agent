'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ChatWidget from '@/components/ChatWidget';

function WidgetContent() {
  const searchParams = useSearchParams();
  const widgetId = searchParams.get('widgetId') || '';
  const apiUrl = searchParams.get('apiUrl') || '';

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
