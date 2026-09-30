'use client';

import { Suspense, use } from 'react';
import { notFound } from 'next/navigation';
import { DefinitionsPanel } from '@/components/lazy/settings-panels';
import { PageLoader } from '@/components/page-loader';
import { PageDataRefreshProvider, PageRefreshButton } from '@/components/page-data-refresh';
import {
  DEFINITIONS_SECTION_META,
  isDefinitionsSectionId,
} from '@/components/settings/settings-tabs-config';

function DefinitionsSectionContent({ section }: { section: string }) {
  if (!isDefinitionsSectionId(section)) {
    notFound();
  }

  const meta = DEFINITIONS_SECTION_META[section];

  return (
    <PageDataRefreshProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{meta.label}</h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <PageRefreshButton />
        </div>
        <DefinitionsPanel section={section} />
      </div>
    </PageDataRefreshProvider>
  );
}

export default function DefinitionsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);

  return (
    <Suspense fallback={<PageLoader />}>
      <DefinitionsSectionContent section={section} />
    </Suspense>
  );
}
