'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityLookupFlow } from './EntityLookupFlow';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import { cn } from '@/lib/utils';

interface EntityLookupTreeProps {
  response: lookUpResponse;
  caseId?: number | null;
  onSuspectChildren?: () => Promise<void>;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  onViewEntity?: (node: EntityLookupNode) => void;
  /** When true, Suspect Children controls stay hidden after a successful run. */
  suspectChildrenDone?: boolean;
}

function MetaChip({
  label,
  value,
  className,
  onClick,
}: {
  label: string;
  value: string;
  className?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const Comp = interactive ? 'button' : 'div';

  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'min-w-0 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-left',
        interactive && 'transition-colors hover:border-border hover:bg-muted/50',
        className
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-medium leading-tight">{value || '—'}</p>
    </Comp>
  );
}

export function EntityLookupTree({
  response,
  caseId,
  onSuspectChildren,
  onConfirmFault,
  onViewEntity,
  suspectChildrenDone = false,
}: EntityLookupTreeProps) {
  const { can } = useAuth();
  const canSuspectChildren = can(P.suspect_children);
  const showSuspectChildren =
    Boolean(caseId) &&
    Boolean(onSuspectChildren) &&
    canSuspectChildren &&
    !suspectChildrenDone;

  const openMatched = () => {
    if (!onViewEntity) return;
    onViewEntity({
      entity_type: response.matched_entity_type,
      entity_id: response.matched_entity_id,
      label: response.matched_label,
      children: [],
      entity_name: response.matched_label,
      entity_PartNumber: response.matched_entity_PartNumber,
      entity_SerialNumber: response.matched_entity_serialNumber,
    });
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-2 rounded-xl border border-border/70 bg-muted/20 p-2">
        <MetaChip
          label="Customer"
          value={response.customer_name}
          className="min-w-[7.5rem] flex-1"
        />
        <MetaChip
          label="Project"
          value={response.project_name}
          className="min-w-[7.5rem] flex-1"
        />
        <MetaChip
          label="Order"
          value={response.order_ref}
          className="min-w-[7.5rem] flex-1"
        />
        <div
          className={cn(
            'min-w-[10rem] flex-[1.4] rounded-md border border-amber-300/70 bg-amber-50/70 px-2.5 py-1.5 dark:border-amber-700/60 dark:bg-amber-950/30',
            onViewEntity && 'cursor-pointer transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/50'
          )}
          role={onViewEntity ? 'button' : undefined}
          tabIndex={onViewEntity ? 0 : undefined}
          onClick={onViewEntity ? openMatched : undefined}
          onKeyDown={(event) => {
            if (!onViewEntity) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openMatched();
          }}
          title={onViewEntity ? 'Open stocking details' : undefined}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Matched
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight">
              {response.matched_label}
            </p>
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px] uppercase">
              {response.matched_entity_type}
            </Badge>
          </div>
        </div>
      </div>

      <EntityLookupFlow
        response={response}
        caseId={caseId}
        onConfirmFault={onConfirmFault}
        onViewEntity={onViewEntity}
      />

      {showSuspectChildren ? (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onSuspectChildren}>
            Suspect Children for Case #{caseId}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
