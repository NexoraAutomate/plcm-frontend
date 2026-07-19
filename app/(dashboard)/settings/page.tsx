'use client';

import { Suspense } from 'react';
import { SettingsPage } from '@/components/settings/settings-page';
import { PageLoader } from '@/components/page-loader';

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SettingsPage />
    </Suspense>
  );
}
