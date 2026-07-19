'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/page-loader';

export default function UsersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=users');
  }, [router]);
  return <PageLoader />;
}
