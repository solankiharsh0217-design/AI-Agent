import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AgentList } from '@/components/AgentList';
import { PageContainer, PageHeader } from '@/components/ui';
import { NewAgentButton } from '@/components/NewAgentButton';

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        description="Create and manage the AI agents that power your channels."
        actions={<NewAgentButton />}
      />
      <AgentList />
    </PageContainer>
  );
}
