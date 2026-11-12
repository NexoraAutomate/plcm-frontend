'use client';

import { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  FLOW_ROLE_BADGE_LABELS,
  FLOW_ROLE_COLORS,
  accentRole,
  displayRoles,
  type FlowRoleTint,
  type OnboardingFlowNodeData,
} from '@/lib/onboarding/diagrams';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { cn } from '@/lib/utils';

/** Invisible connection anchors — edges still attach; no visible dots. */
const hiddenHandleClass =
  '!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0';

function RoleBadges({
  roles,
  className,
  compact,
}: {
  roles?: FlowRoleTint[];
  className?: string;
  compact?: boolean;
}) {
  const visible = displayRoles(roles);
  if (!visible.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((role) => {
        const color = FLOW_ROLE_COLORS[role];
        return (
          <span
            key={role}
            className={cn(
              'inline-flex items-center rounded border font-semibold leading-none',
              compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'
            )}
            style={{
              color,
              borderColor: `${color}66`,
              backgroundColor: `${color}18`,
            }}
            title={FLOW_ROLE_BADGE_LABELS[role]}
          >
            {FLOW_ROLE_BADGE_LABELS[role]}
          </span>
        );
      })}
    </div>
  );
}

function NodeTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={280}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="nodrag nopan z-[100] max-w-[16rem] px-3 py-2 text-left text-xs leading-snug text-balance"
      >
        <HighlightRoleNames text={tip} />
      </TooltipContent>
    </Tooltip>
  );
}

function StepNode({ data, sourcePosition, targetPosition }: NodeProps) {
  const d = data as OnboardingFlowNodeData;
  const accent = FLOW_ROLE_COLORS[accentRole(d.roles)];
  return (
    <NodeTip tip={d.tip}>
      <div
        className="rounded-lg border bg-card px-3 py-2 text-left shadow-sm"
        style={{ borderLeftWidth: 4, borderLeftColor: accent, width: '100%', height: '100%' }}
      >
        <Handle
          id="target"
          type="target"
          position={targetPosition ?? Position.Top}
          className={hiddenHandleClass}
        />
        <Handle
          id="target-left"
          type="target"
          position={Position.Left}
          className={hiddenHandleClass}
        />
        <div className="flex min-h-full flex-col justify-center gap-1">
          <span className="text-xs font-medium leading-snug text-foreground">{d.label}</span>
          <RoleBadges roles={d.roles} />
        </div>
        <Handle
          id="source"
          type="source"
          position={sourcePosition ?? Position.Bottom}
          className={hiddenHandleClass}
        />
        <Handle
          id="source-left"
          type="source"
          position={Position.Left}
          className={hiddenHandleClass}
        />
        <Handle
          id="source-right"
          type="source"
          position={Position.Right}
          className={hiddenHandleClass}
        />
      </div>
    </NodeTip>
  );
}

function DecisionNode({ data }: NodeProps) {
  const d = data as OnboardingFlowNodeData;
  const accent = FLOW_ROLE_COLORS[accentRole(d.roles)];
  return (
    <NodeTip tip={d.tip}>
      <div className="relative h-full w-full">
        <Handle
          id="target-top"
          type="target"
          position={Position.Top}
          className={hiddenHandleClass}
        />
        <Handle
          id="target-left"
          type="target"
          position={Position.Left}
          className={hiddenHandleClass}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="aspect-square w-[66%] border-2 bg-card shadow-sm"
            style={{ borderColor: accent, transform: 'rotate(45deg)' }}
            aria-hidden
          />
        </div>
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1 px-2">
          <span className="text-center text-[10px] font-semibold leading-tight text-foreground">
            {d.label}
          </span>
          <RoleBadges roles={d.roles} compact />
        </div>
        <Handle
          id="source-left"
          type="source"
          position={Position.Left}
          className={hiddenHandleClass}
        />
        <Handle
          id="source-right"
          type="source"
          position={Position.Right}
          className={hiddenHandleClass}
        />
        <Handle
          id="source-bottom"
          type="source"
          position={Position.Bottom}
          className={hiddenHandleClass}
        />
      </div>
    </NodeTip>
  );
}

function GroupNode({ data, sourcePosition, targetPosition }: NodeProps) {
  const d = data as OnboardingFlowNodeData;
  const accent = FLOW_ROLE_COLORS[accentRole(d.roles)];
  const Chevron = d.expanded ? ChevronDown : ChevronRight;
  return (
    <NodeTip tip={d.tip}>
      <div
        className={cn(
          'flex h-full w-full cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed bg-muted/40 px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/70',
          d.expanded && 'border-solid bg-muted/60'
        )}
        style={{ borderColor: accent }}
        role="button"
        tabIndex={0}
      >
        <Handle
          id="target"
          type="target"
          position={targetPosition ?? Position.Top}
          className={hiddenHandleClass}
        />
        <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-snug text-foreground">{d.label}</span>
          <RoleBadges roles={d.roles} className="mt-1" />
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {d.expanded
              ? 'Expanded — click to collapse'
              : `${d.childCount ?? 0} steps — click to expand`}
          </span>
        </span>
        <Handle
          id="source"
          type="source"
          position={sourcePosition ?? Position.Bottom}
          className={hiddenHandleClass}
        />
      </div>
    </NodeTip>
  );
}

export const onboardingFlowNodeTypes = {
  onboardingStep: memo(StepNode),
  onboardingDecision: memo(DecisionNode),
  onboardingGroup: memo(GroupNode),
};
