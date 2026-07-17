import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AnalyticsContent } from '@/components/AnalyticsContent';
import { PageContainer, PageHeader } from '@/components/ui';

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="Usage, cost, and performance across your agents and channels."
      />
      <AnalyticsContent />
    </PageContainer>
  );
}
