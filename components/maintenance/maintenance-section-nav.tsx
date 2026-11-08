'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  {
    href: '/maintenance',
    label: 'Cases',
    match: (pathname: string) =>
      pathname === '/maintenance' || pathname.startsWith('/maintenance/cases'),
  },
  {
    href: '/maintenance/lookup',
    label: 'Lookup',
    match: (pathname: string) => pathname.startsWith('/maintenance/lookup'),
  },
  {
    href: '/maintenance/warranty-claims',
    label: 'Warranty claims',
    match: (pathname: string) => pathname.startsWith('/maintenance/warranty-claims'),
  },
] as const;

export function MaintenanceSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Maintenance sections"
      className="flex flex-wrap gap-1 rounded-full border border-border/80 bg-background p-1"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--pill-tabs-accent,#10A37F)] text-white'
                : 'text-foreground hover:bg-muted'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
