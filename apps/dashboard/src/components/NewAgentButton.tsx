'use client';

import Link from 'next/link';
import { PlusIcon } from './icons';
import { usePermissions } from '@/hooks/usePermissions';

export function NewAgentButton() {
  const { can } = usePermissions();

  if (!can('create:agent')) return null;

  return (
    <Link href="/agents/new" className="btn-primary">
      <PlusIcon width={16} height={16} /> New Agent
    </Link>
  );
}
