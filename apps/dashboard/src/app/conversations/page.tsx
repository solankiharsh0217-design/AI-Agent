import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ConversationsList } from '@/components/ConversationsList';
import { PageContainer, PageHeader } from '@/components/ui';

export default async function ConversationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Conversations"
        description="Review chats and calls handled by your agents."
      />
      <ConversationsList />
    </PageContainer>
  );
}
