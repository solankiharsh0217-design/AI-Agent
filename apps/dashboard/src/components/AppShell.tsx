'use client';

import { UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SidebarNav } from './Sidebar';
import { MenuIcon, CloseIcon } from './icons';

/** Routes that render without the dashboard chrome (auth screens). */
const BARE_PREFIXES = ['/sign-in', '/sign-up'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (BARE_PREFIXES.some(p => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-slate-200 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <CloseIcon width={18} height={18} />
            </button>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
