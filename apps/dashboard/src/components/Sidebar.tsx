'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon, AgentsIcon, KnowledgeIcon, ConversationsIcon, WidgetsIcon,
  AnalyticsIcon, PhoneIcon, BillingIcon, SettingsIcon,
} from './icons';

const NAV = [
  { href: '/', label: 'Overview', Icon: HomeIcon },
  { href: '/agents', label: 'Agents', Icon: AgentsIcon },
  { href: '/knowledge', label: 'Knowledge', Icon: KnowledgeIcon },
  { href: '/conversations', label: 'Conversations', Icon: ConversationsIcon },
  { href: '/widgets', label: 'Widgets', Icon: WidgetsIcon },
  { href: '/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { href: '/phone', label: 'Phone', Icon: PhoneIcon },
  { href: '/billing', label: 'Billing', Icon: BillingIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">A</span>
        <span className="text-sm font-semibold text-slate-900">AI Agent Platform</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={active ? 'text-indigo-600' : 'text-slate-400'} width={18} height={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-400">v1.0</div>
    </div>
  );
}
