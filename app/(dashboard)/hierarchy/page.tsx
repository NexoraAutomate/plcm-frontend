'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/page-loader';

export default function HierarchyRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=definitions&section=configurations');
  }, [router]);
  return <PageLoader />;
}
