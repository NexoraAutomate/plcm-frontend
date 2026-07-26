'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';
import { isExternalPictureUrl } from '@/lib/picture-url';

function userInitials(fullName?: string | null, username?: string | null) {
  const source = fullName?.trim() || username?.trim() || '';
  if (!source) return 'U';
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

type UserAvatarProps = {
  userId: number;
  fullName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  /** Pixel size of the circle. */
  size?: number;
  className?: string;
  /** When true, click opens file picker and uploads. */
  editable?: boolean;
  /** Self upload uses /auth/avatar; admin uses /users/{id}/avatar. */
  uploadMode?: 'self' | 'admin';
  onUploaded?: (avatarUrl: string | null) => void;
};

export function UserAvatar({
  userId,
  fullName,
  username,
  avatarUrl,
  size = 32,
  className,
  editable = false,
  uploadMode = 'self',
  onUploaded,
}: UserAvatarProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cacheKey, setCacheKey] = useState(0);

  useEffect(() => {
    if (!avatarUrl) {
      setResolvedSrc(null);
      return;
    }
    if (isExternalPictureUrl(avatarUrl)) {
      setResolvedSrc(avatarUrl);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    api.users
      .fetchAvatarBlob(userId)
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
  }, [avatarUrl, userId, cacheKey]);

  async function handleFileChange(file: File | undefined) {
    if (!file || !editable) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const res =
        uploadMode === 'admin'
          ? await api.users.uploadAvatar(userId, file)
          : await api.auth.uploadAvatar(file);
      setCacheKey((k) => k + 1);
      onUploaded?.(res.data.avatar_url);
      toast.success('Profile picture updated');
    } catch {
      toast.error('Failed to upload picture');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const initials = userInitials(fullName, username);
  const circleStyle = { width: size, height: size, fontSize: Math.max(10, size * 0.32) };

  const content = (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground font-bold',
        className
      )}
      style={circleStyle}
    >
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt={fullName || username || 'User'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
      {editable ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Camera className="h-4 w-4 text-white" />
          )}
        </span>
      ) : null}
    </span>
  );

  if (!editable) return content;

  return (
    <>
      <button
        type="button"
        className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Change profile picture"
        aria-label="Change profile picture"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {content}
      </button>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handleFileChange(e.target.files?.[0])}
      />
    </>
  );
}
