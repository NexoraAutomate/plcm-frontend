import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CardTitleWithIcon({
  icon: Icon,
  children,
  className,
  iconClassName,
  style,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <CardTitle className={cn('flex items-center gap-2 text-base', className)} style={style}>
      <Icon
        className={cn('size-4 shrink-0 text-muted-foreground', iconClassName)}
        aria-hidden
      />
      <span>{children}</span>
    </CardTitle>
  );
}
