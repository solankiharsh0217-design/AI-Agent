'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setClerkToken } from '@/lib/api';

function ClerkTokenSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    let mounted = true;
    async function loadToken() {
      const token = await getToken();
      if (mounted) setClerkToken(token);
    }
    loadToken();
    const interval = setInterval(loadToken, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [getToken]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ClerkTokenSync />
      {children}
    </ClerkProvider>
  );
}
