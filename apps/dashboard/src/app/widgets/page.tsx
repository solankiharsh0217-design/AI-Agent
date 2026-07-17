import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WidgetsList } from '@/components/WidgetsList';
import { PageContainer, PageHeader } from '@/components/ui';
import { PlusIcon } from '@/components/icons';

export default async function WidgetsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <PageContainer>
      <PageHeader
        title="Widgets"
        description="Embeddable chat and voice widgets for your website."
        actions={
          <Link href="/widgets/new" className="btn-primary">
            <PlusIcon width={16} height={16} /> New Widget
          </Link>
        }
      />
      <WidgetsList />
    </PageContainer>
  );
}
