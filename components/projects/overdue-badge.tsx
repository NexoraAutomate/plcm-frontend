import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'shrink-0 border-transparent bg-orange-100 px-1.5 py-0 text-[10px] font-semibold uppercase leading-4 tracking-wide text-orange-700',
        'dark:bg-orange-950 dark:text-orange-300',
        className
      )}
    >
      Overdue
    </Badge>
  );
}
