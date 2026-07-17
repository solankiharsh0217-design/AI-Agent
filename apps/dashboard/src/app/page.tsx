import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { OverviewContent } from '@/components/OverviewContent';
import { PageContainer, PageHeader } from '@/components/ui';

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description="Welcome back. Here's a snapshot of your workspace."
      />
      <OverviewContent />
    </PageContainer>
  );
}
