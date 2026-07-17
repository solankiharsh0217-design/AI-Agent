'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setClerkTokenGetter } from '@/lib/api';
import { PostHogProvider } from '@/lib/posthog';
import { AppShell } from '@/components/AppShell';

function ClerkTokenSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    // Register Clerk's getToken so every API request fetches a fresh, unexpired token.
    // Clerk caches and refreshes internally, so this is cheap.
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <PostHogProvider>
        <ClerkTokenSync />
        <AppShell>{children}</AppShell>
      </PostHogProvider>
    </ClerkProvider>
  );
}
