import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ExistingProjectBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn('px-1.5 py-0 text-[10px] font-medium leading-4', className)}
    >
      Existing
    </Badge>
  );
}
