'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  buildEntityLookupWorkflowTree,
  collectMatchedWorkflowPathKeys,
  collectWorkflowPathKeys,
  entityNodeId,
  type EntityLookupWorkflowNode,
} from '@/lib/entity-lookup-flow';
import type { lookUpResponse } from '@/lib/models';
import { cn } from '@/lib/utils';

export interface WorkflowFocus {
  entityType: string;
  entityId: number;
}

interface EntityLookupWorkflowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  response: lookUpResponse | null;
  /** Node whose serial was clicked; its ancestor thread stays expanded. */
  focus?: WorkflowFocus | null;
  onViewEntity?: (node: EntityLookupWorkflowNode) => void;
}

function WorkflowNodeRow({
  node,
  depth,
  expandedKeys,
  onToggle,
  focusKey,
  matchedKey,
  onViewEntity,
}: {
  node: EntityLookupWorkflowNode;
  depth: number;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
  focusKey: string | null;
  matchedKey: string | null;
  onViewEntity?: (node: EntityLookupWorkflowNode) => void;
}) {
  const key = entityNodeId(node.entity_type, node.entity_id);
  const hasChildren = node.children.length > 0;
  const open = expandedKeys.has(key);
  const isFocus = focusKey === key;
  const isMatched = matchedKey === key;
  const isHardware =
    node.role === 'matched' ||
    node.role === 'hardware' ||
    node.role === 'descendant';

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2 py-1.5',
          isMatched || isFocus
            ? 'border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/30'
            : 'border-border/70 bg-background/80'
        )}
        style={{ marginLeft: depth * 12 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onToggle(key)}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <span className="inline-block h-7 w-7 shrink-0" />
        )}

        <button
          type="button"
          className={cn(
            'min-w-0 flex-1 text-left',
            isHardware && onViewEntity && 'hover:underline'
          )}
          disabled={!isHardware || !onViewEntity}
          onClick={() => {
            if (isHardware) onViewEntity?.(node);
          }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{node.entity_name}</p>
            <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase">
              {node.entity_type}
            </Badge>
            {isMatched ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
                Suspected
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {node.entity_PartNumber ? `PN ${node.entity_PartNumber}` : 'PN —'}
            {' · '}
            {node.entity_SerialNumber ? `SN ${node.entity_SerialNumber}` : 'SN —'}
          </p>
        </button>
      </div>

      {hasChildren && open
        ? node.children.map((child) => (
            <WorkflowNodeRow
              key={entityNodeId(child.entity_type, child.entity_id)}
              node={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              focusKey={focusKey}
              matchedKey={matchedKey}
              onViewEntity={onViewEntity}
            />
          ))
        : null}
    </div>
  );
}

export function EntityLookupWorkflowSheet({
  open,
  onOpenChange,
  response,
  focus = null,
  onViewEntity,
}: EntityLookupWorkflowSheetProps) {
  const tree = useMemo(
    () => (response ? buildEntityLookupWorkflowTree(response) : null),
    [response]
  );

  const matchedKey = useMemo(() => {
    if (!response) return null;
    return entityNodeId(response.matched_entity_type, response.matched_entity_id);
  }, [response]);

  const focusKey = useMemo(() => {
    if (!focus) return matchedKey;
    return entityNodeId(focus.entityType, focus.entityId);
  }, [focus, matchedKey]);

  const defaultExpanded = useMemo(() => {
    if (!tree) return new Set<string>();
    // Only the suspected (matched) thread starts expanded; siblings stay collapsed.
    const suspected = collectMatchedWorkflowPathKeys(tree);
    if (!focus) return suspected;

    const focusPath = collectWorkflowPathKeys(
      tree,
      focus.entityType,
      focus.entityId
    );
    const focusNodeKey = entityNodeId(focus.entityType, focus.entityId);

    // Clicked serial is under the matched entity — expand down to it.
    if (matchedKey && focusPath.has(matchedKey)) {
      return new Set([...suspected, ...focusPath]);
    }
    // Clicked serial is on the suspected spine already.
    if (suspected.has(focusNodeKey)) {
      return suspected;
    }
    return suspected;
  }, [tree, focus, matchedKey]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    if (!open) return;
    setExpandedKeys(new Set(defaultExpanded));
  }, [open, defaultExpanded]);

  const toggle = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">Entity Workflow</SheetTitle>
          <SheetDescription>
            Full hierarchy for this serial. Only the suspected thread starts expanded;
            other branches stay collapsed.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-3 pb-8">
            {!tree ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hierarchy available.
              </p>
            ) : (
              <WorkflowNodeRow
                node={tree}
                depth={0}
                expandedKeys={expandedKeys}
                onToggle={toggle}
                focusKey={focusKey}
                matchedKey={matchedKey}
                onViewEntity={onViewEntity}
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
