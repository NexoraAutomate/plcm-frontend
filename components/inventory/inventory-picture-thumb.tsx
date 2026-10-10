'use client';

import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { EntityPicture } from '@/components/entity-picture';
import { cn } from '@/lib/utils';

type InventoryPictureThumbProps = {
  pendingFile?: File | null;
  pictureUrl?: string | null;
  ownerType?: string;
  ownerId?: number | null;
  alt?: string;
  /** Header uses a larger thumb; table uses a compact icon. */
  size?: 'sm' | 'md';
  /** When true, show a muted placeholder if no image is available. */
  showPlaceholder?: boolean;
  className?: string;
};

export function InventoryPictureThumb({
  pendingFile = null,
  pictureUrl = null,
  ownerType,
  ownerId,
  alt = '',
  size = 'md',
  showPlaceholder = false,
  className,
}: InventoryPictureThumbProps) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-11 w-11';
  const frameClass = cn(
    sizeClass,
    'shrink-0 rounded-none border object-cover bg-muted/40',
    className
  );

  if (localUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={localUrl} alt={alt} className={frameClass} />
    );
  }

  if (pictureUrl && ownerType && ownerId) {
    return (
      <div
        className={cn(
          frameClass,
          'relative flex items-center justify-center overflow-hidden p-0'
        )}
      >
        {showPlaceholder ? (
          <ImageIcon
            className={cn(
              'absolute text-muted-foreground',
              size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
            )}
            aria-hidden
          />
        ) : null}
        <EntityPicture
          src={pictureUrl}
          ownerType={ownerType}
          ownerId={ownerId}
          alt={alt}
          className="relative h-full w-full object-cover"
        />
      </div>
    );
  }

  if (!showPlaceholder) return null;

  return (
    <div
      className={cn(frameClass, 'flex items-center justify-center text-muted-foreground')}
      aria-hidden
    >
      <ImageIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
    </div>
  );
}
