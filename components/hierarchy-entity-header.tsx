'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  name: string;
  description?: string | null;
  backHref: string;
  projectName?: string | null;
  systemName?: string | null;
  sdlsNumber?: number | null;
};

export function HierarchyEntityHeader({
  name,
  description,
  backHref,
  projectName,
  systemName,
  sdlsNumber,
}: Props) {
  return (
    <div className="flex items-start gap-4">
      <Link href={backHref}>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          aria-label={`Back from ${name}`}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </Link>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project: {projectName || '—'}
          {systemName ? ` · System: ${systemName}` : ''}
          {` · SDLS-${sdlsNumber ?? '—'}`}
        </p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
