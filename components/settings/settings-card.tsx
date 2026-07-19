'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  contentClassName?: string;
}

export function SettingsCard({
  title,
  description,
  children,
  className,
  headerAction,
  contentClassName,
}: SettingsCardProps) {
  return (
    <Card className={cn('shadow-sm', className)}>
      {(title || description || headerAction) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div className="space-y-1">
            {title ? <CardTitle className="text-base font-semibold">{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerAction}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !description && !headerAction && 'pt-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
