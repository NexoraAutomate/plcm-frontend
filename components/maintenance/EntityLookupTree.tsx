'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityLookupFlow } from './EntityLookupFlow';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';

interface EntityLookupTreeProps {
  response: lookUpResponse;
  caseId?: number | null;
  onSuspectChildren?: () => Promise<void>;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
}

export function EntityLookupTree({
  response,
  caseId,
  onSuspectChildren,
  onConfirmFault,
}: EntityLookupTreeProps) {
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
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matched Entity
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{response.matched_label}</p>
            <Badge variant="outline" className="text-[10px] uppercase">
              {response.matched_entity_type}
            </Badge>
          </div>
        </div>
      </div>

      <EntityLookupFlow
        response={response}
        caseId={caseId}
        onConfirmFault={onConfirmFault}
      />

      {caseId && onSuspectChildren ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onSuspectChildren}>
            Suspect Children for Case #{caseId}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
