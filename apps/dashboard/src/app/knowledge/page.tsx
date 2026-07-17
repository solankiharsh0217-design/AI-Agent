import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { KnowledgeBaseList } from '@/components/KnowledgeBaseList';
import { PageContainer, PageHeader } from '@/components/ui';

export default async function KnowledgePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Knowledge Base"
        description="Upload documents so your agents can answer from your own content."
      />
      <KnowledgeBaseList />
    </PageContainer>
  );
}
