import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AgentList } from '@/components/AgentList';
import { PageContainer, PageHeader } from '@/components/ui';
import { PlusIcon } from '@/components/icons';

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        description="Create and manage the AI agents that power your channels."
        actions={
          <Link href="/agents/new" className="btn-primary">
            <PlusIcon width={16} height={16} /> New Agent
          </Link>
        }
      />
      <AgentList />
    </PageContainer>
  );
}
