import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SettingsContent } from '@/components/SettingsContent';
import { PageContainer, PageHeader } from '@/components/ui';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Manage your account, workspace, and preferences." />
      <SettingsContent />
    </PageContainer>
  );
}
