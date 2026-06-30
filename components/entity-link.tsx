'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ParentEntityLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function ParentEntityLink({ href, label, className }: ParentEntityLinkProps) {
  return (
    <Link
      href={href}
      className={cn('font-medium text-primary hover:underline', className)}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}
