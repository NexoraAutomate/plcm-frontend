'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

export interface ReportQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function ReportQRCode({ value, size = 96, className }: ReportQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={cn('animate-pulse rounded bg-muted', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Report verification QR code"
      width={size}
      height={size}
      className={cn('rounded border border-border bg-white p-1', className)}
    />
  );
}

export async function qrDataUrl(value: string, size = 128): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
