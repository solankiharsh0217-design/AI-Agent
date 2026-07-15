import type { Metadata } from 'next';
import './globals.css';
import { ProvidersWrapper } from './providers-wrapper';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Agent Platform',
  description: 'Create and manage AI agents across multiple channels',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <ProvidersWrapper>{children}</ProvidersWrapper>
      </body>
    </html>
  );
}
