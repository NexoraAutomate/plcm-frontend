'use client';

import { useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { isExternalPictureUrl } from '@/lib/picture-url';

interface EntityPictureProps {
  src?: string | null;
  ownerType?: string;
  ownerId?: number;
  alt?: string;
  className?: string;
}

export function EntityPicture({ src, ownerType, ownerId, alt = '', className }: EntityPictureProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    if (isExternalPictureUrl(src)) {
      setResolvedSrc(src);
      return;
    }

    if (!ownerType || !ownerId) {
      setResolvedSrc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    api.pictures
      .fetchBlob(ownerType, ownerId)
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, ownerType, ownerId]);

  if (!resolvedSrc) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={resolvedSrc} alt={alt} className={className} />
  );
}
