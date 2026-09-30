'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import {
  DEFINITIONS_SECTION_META,
  isDefinitionsSectionId,
  type DefinitionsSectionId,
} from '@/components/settings/settings-tabs-config';
import { PageLoader } from '@/components/page-loader';

function firstAccessibleSection(
  can: (permission: string | string[]) => boolean
): DefinitionsSectionId {
  if (
    can([
      P.manage_settings,
      P.edit_inventory,
      P.hierarchy_config_manage,
      P.create_hierarchy,
    ])
  ) {
    return 'labels';
  }
  if (can([P.view_hierarchy, P.create_hierarchy, P.manage_settings])) return 'entity-list';
  return 'configurations';
}

function DefinitionsIndexRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();

  useEffect(() => {
    const fromQuery = searchParams.get('section');
    const section = isDefinitionsSectionId(fromQuery)
      ? fromQuery
      : firstAccessibleSection(can);
    router.replace(DEFINITIONS_SECTION_META[section].href);
  }, [can, router, searchParams]);

  return <PageLoader />;
}

export default function DefinitionsIndexPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DefinitionsIndexRedirect />
    </Suspense>
  );
}
