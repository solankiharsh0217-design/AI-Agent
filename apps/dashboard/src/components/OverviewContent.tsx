'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui';
import {
  AgentsIcon, WidgetsIcon, KnowledgeIcon, ConversationsIcon,
  AnalyticsIcon, PhoneIcon, ArrowRightIcon,
} from '@/components/icons';

const QUICK_LINKS = [
  { href: '/agents', label: 'Agents', desc: 'Build and publish AI agents', Icon: AgentsIcon },
  { href: '/knowledge', label: 'Knowledge', desc: 'Upload docs for grounded answers', Icon: KnowledgeIcon },
  { href: '/widgets', label: 'Widgets', desc: 'Embed chat & voice on your site', Icon: WidgetsIcon },
  { href: '/conversations', label: 'Conversations', desc: 'Review chats and calls', Icon: ConversationsIcon },
  { href: '/analytics', label: 'Analytics', desc: 'Usage, cost, and performance', Icon: AnalyticsIcon },
  { href: '/phone', label: 'Phone', desc: 'Connect phone numbers', Icon: PhoneIcon },
];

export function OverviewContent() {
  const [stats, setStats] = useState<{ agents: number; widgets: number; conversations: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [agents, widgets, convos] = await Promise.all([
          api.agents.list().catch(() => []),
          api.widgets.list().catch(() => []),
          api.conversations.list({ page: 1, limit: 1 }).catch(() => ({ meta: { total: 0 } })),
        ]);
        if (!cancelled) {
          setStats({
            agents: Array.isArray(agents) ? agents.length : 0,
            widgets: Array.isArray(widgets) ? widgets.length : 0,
            conversations: (convos as any)?.meta?.total ?? 0,
          });
        }
      } catch {
        if (!cancelled) setStats({ agents: 0, widgets: 0, conversations: 0 });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Agents" value={stats ? stats.agents : '—'} icon={<AgentsIcon width={18} height={18} />} />
        <StatCard label="Widgets" value={stats ? stats.widgets : '—'} icon={<WidgetsIcon width={18} height={18} />} />
        <StatCard label="Conversations" value={stats ? stats.conversations : '—'} icon={<ConversationsIcon width={18} height={18} />} />
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, desc, Icon }) => (
            <Link key={href} href={href} className="card group flex items-start gap-4 p-5 transition-shadow hover:shadow-md">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon width={20} height={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold text-slate-900">
                  {label}
                  <ArrowRightIcon width={14} height={14} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
