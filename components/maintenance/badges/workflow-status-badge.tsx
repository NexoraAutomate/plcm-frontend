'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WorkflowStatusMeta } from '@/lib/maintenance-workflow';

interface WorkflowStatusBadgeProps {
  meta: WorkflowStatusMeta;
  className?: string;
  showIcon?: boolean;
}

export function WorkflowStatusBadge({
  meta,
  className,
  showIcon = true,
}: WorkflowStatusBadgeProps) {
  const Icon = meta.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('text-xs font-medium gap-1', meta.colorClass, className)}
          >
            {showIcon && <Icon className="h-3 w-3 shrink-0" />}
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{meta.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
