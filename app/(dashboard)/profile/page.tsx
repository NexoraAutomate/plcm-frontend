'use client';

import { Suspense } from 'react';
import { ProfilePage } from '@/components/profile/profile-page';

export default function ProfileRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading profile…</p>}>
      <ProfilePage />
    </Suspense>
  );
}
