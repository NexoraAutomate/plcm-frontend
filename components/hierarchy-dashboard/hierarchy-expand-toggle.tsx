'use client';

import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HierarchyExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function HierarchyExpandToggle({
  expanded,
  onToggle,
  className,
}: HierarchyExpandToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'nodrag nopan absolute top-3 left-3 z-20 h-8 gap-1.5 bg-background/95 text-xs shadow-sm backdrop-blur-sm',
        className
      )}
      onClick={onToggle}
      title={expanded ? 'Collapse to selected path' : 'Expand full project hierarchy'}
    >
      <GitBranch className="h-3.5 w-3.5" />
      {expanded ? 'Collapse to selection' : 'Show full hierarchy'}
    </Button>
  );
}
