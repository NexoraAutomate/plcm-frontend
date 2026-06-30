import { cn } from '@/lib/utils';

interface EntityCountCellProps {
  count: number;
  label?: string;
  className?: string;
}

export function EntityCountCell({ count, label, className }: EntityCountCellProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[2rem] items-center justify-center rounded-md bg-muted px-2 py-0.5 text-sm font-medium tabular-nums text-foreground',
        className
      )}
      title={label}
    >
      {count}
    </span>
  );
}
