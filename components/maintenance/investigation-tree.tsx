'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, BugPlay, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FaultyEntityStatus, FaultType, type FaultyEntity, type MaintenanceAction } from '@/lib/models';
import type { InvestigationTreeNode, TreeVisualContext } from '@/lib/maintenance-tree';
import { buildTreeVisualContext } from '@/lib/maintenance-tree';
import { FaultyEntityStatusBadge } from '@/components/maintenance/badges';

interface InvestigationTreeProps {
  nodes: InvestigationTreeNode[];
  entities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  caseStatus?: string;
  onSelect?: (node: InvestigationTreeNode) => void;
  onNoFaultFound?: (node: InvestigationTreeNode) => void;
  onFaultTypeChange?: (nodeId: number, faultType: string) => void;
}

function PulseIndicator({ pingClass, dotClass }: { pingClass: string; dotClass: string }) {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${pingClass}`} />
      <span className={`relative inline-flex size-2 rounded-full ${dotClass}`} />
    </span>
  );
}

function TreeNode({
  node,
  depth = 0,
  visual,
  entities,
  actions,
  onSelect,
  onFaultTypeChange,
}: {
  node: InvestigationTreeNode;
  depth?: number;
  visual: TreeVisualContext;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
  onSelect?: (node: InvestigationTreeNode) => void;
  onFaultTypeChange?: (nodeId: number, faultType: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(depth < 2);
  const entity = entities.find((e) => e.id === node.id);

  const showRedPing = visual.redPingIds.has(node.id);
  const showAmberPing = visual.amberPingIds.has(node.id);
  const showSpin = visual.spinIds.has(node.id);
  const isConfirmedFaulty = node.status === FaultyEntityStatus.CONFIRMED_FAULTY;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50 ${
          showRedPing
            ? 'border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20'
            : showAmberPing
              ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20'
              : showSpin
                ? 'border-blue-300 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20'
                : 'border-border bg-background'
        }`}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <div className="h-8 w-8 shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {showSpin && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
          )}
          {showRedPing && <PulseIndicator pingClass="bg-red-700" dotClass="bg-red-500" />}
          {!showRedPing && showAmberPing && (
            <PulseIndicator pingClass="bg-amber-500" dotClass="bg-amber-400" />
          )}

          <div className="min-w-0">
            <p
              className={`truncate text-sm font-medium ${
                showRedPing ? 'text-red-800 dark:text-red-300' : showAmberPing ? 'text-amber-800 dark:text-amber-300' : ''
              }`}
            >
              {node.display_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {node.entity_type} · {node.part_number}
            </p>
          </div>

          {entity ? (
            <FaultyEntityStatusBadge
              entity={entity}
              allEntities={entities}
              actions={actions}
              className="shrink-0"
            />
          ) : null}
        </div>

        {isConfirmedFaulty && (
          <div className="flex shrink-0 items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Fault Type:</label>
            <Select
              value={node.fault_type || ''}
              onValueChange={(value) => onFaultTypeChange?.(node.id, value)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="Select fault type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FaultType.ELECTRICAL}>Electrical</SelectItem>
                <SelectItem value={FaultType.MECHANICAL}>Mechanical</SelectItem>
                <SelectItem value={FaultType.ENVIRONMENTAL}>Environmental</SelectItem>
                <SelectItem value={FaultType.HARDWARE}>Hardware</SelectItem>
                <SelectItem value={FaultType.MANUFACTURING_DEFECT}>Manufacturing Defect</SelectItem>
                <SelectItem value={FaultType.PHYSICAL_DAMAGE}>Physical Damage</SelectItem>
                <SelectItem value={FaultType.SOFTWARE}>Software</SelectItem>
                <SelectItem value={FaultType.UNCLASSIFIED}>Unclassified</SelectItem>
                <SelectItem value={FaultType.WEAR}>Wear</SelectItem>
                <SelectItem value={FaultType.OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="View entity details"
            onClick={() => onSelect?.(node)}
          >
            <BugPlay className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasChildren && open && (
        <div className="ml-6 space-y-1 border-l border-border pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              visual={visual}
              entities={entities}
              actions={actions}
              onSelect={onSelect}
              onFaultTypeChange={onFaultTypeChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InvestigationTree({
  nodes,
  entities = [],
  actions = [],
  caseStatus,
  onSelect,
  onFaultTypeChange,
}: InvestigationTreeProps) {
  const visual = useMemo(
    () => buildTreeVisualContext(nodes, caseStatus, entities, actions),
    [nodes, caseStatus, entities, actions]
  );

  if (!nodes || nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hierarchy data available for this case.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          visual={visual}
          entities={entities}
          actions={actions}
          onSelect={onSelect}
          onFaultTypeChange={onFaultTypeChange}
        />
      ))}
    </div>
  );
}
