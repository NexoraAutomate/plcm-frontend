'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityLookupFlow } from './EntityLookupFlow';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface EntityLookupTreeProps {
  response: lookUpResponse;
  caseId?: number | null;
  onSuspectChildren?: () => Promise<void>;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  onViewEntity?: (node: EntityLookupNode) => void;
  /** When true, Suspect Children controls stay hidden after a successful run. */
  suspectChildrenDone?: boolean;
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

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer
          </p>
          <p className="mt-1 text-sm font-medium">{response.customer_name}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </p>
          <p className="mt-1 text-sm font-medium">{response.project_name}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Order
          </p>
          <p className="mt-1 text-sm font-medium">{response.order_ref}</p>
        </div>
        <div
          className={
            onViewEntity
              ? 'cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40'
              : 'rounded-lg border bg-background p-3'
          }
          role={onViewEntity ? 'button' : undefined}
          tabIndex={onViewEntity ? 0 : undefined}
          onClick={() => {
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
          }}
          onKeyDown={(event) => {
            if (!onViewEntity) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onViewEntity({
              entity_type: response.matched_entity_type,
              entity_id: response.matched_entity_id,
              label: response.matched_label,
              children: [],
              entity_name: response.matched_label,
              entity_PartNumber: response.matched_entity_PartNumber,
              entity_SerialNumber: response.matched_entity_serialNumber,
            });
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matched Entity
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{response.matched_label}</p>
            <Badge variant="outline" className="text-[10px] uppercase">
              {response.matched_entity_type}
            </Badge>
          </div>
          {onViewEntity ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Click to open stocking details
            </p>
          ) : null}
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
          <Button variant="secondary" onClick={onSuspectChildren}>
            Suspect Children for Case #{caseId}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
