'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HierarchyNodeLegend } from '@/components/hierarchy-node-legend';
import { HIERARCHY_FLOW_NODE_TYPES } from '@/components/hierarchy/hierarchy-flow-node';
import {
  buildInventoryHierarchyTree,
  inventoryHierarchyTreeToFlow,
} from '@/lib/inventory-hierarchy-graph';
import { resolveInventoryInstanceSerial } from '@/lib/inventory-child-install';
import * as api from '@/lib/api';
import type { Inventory } from '@/lib/models';
import {
  DEFAULT_NODE_FIELD_VISIBILITY,
  type HierarchyNodeFieldVisibility,
  type HierarchyTreeNode,
} from '@/lib/system-hierarchy-graph';
import { PageLoader } from '@/components/page-loader';

interface InventoryHierarchyDialogProps {
  item: Inventory | null;
  instanceId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryHierarchyDialog({
  item,
  instanceId,
  open,
  onOpenChange,
}: InventoryHierarchyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<HierarchyTreeNode | null>(null);
  const [fieldVisibility, setFieldVisibility] = useState<HierarchyNodeFieldVisibility>(
    DEFAULT_NODE_FIELD_VISIBILITY
  );

  const serialLabel = useMemo(() => {
    if (!item) return undefined;
    return resolveInventoryInstanceSerial(item, instanceId ?? null);
  }, [item, instanceId]);

  useEffect(() => {
    if (!open || !item) {
      setTree(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const inventoryItem = item;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const freshRes = await api.inventory.get(inventoryItem.id);
        const fresh = freshRes.data ?? inventoryItem;
        const nextTree = await buildInventoryHierarchyTree(fresh, { instanceId });
        if (!cancelled) setTree(nextTree);
      } catch (err) {
        console.error('Failed to load inventory hierarchy:', err);
        if (!cancelled) {
          setTree(null);
          setError('Failed to load inventory hierarchy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, item, instanceId]);

  const { nodes, edges } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [] };
    const flow = inventoryHierarchyTreeToFlow(tree);
    return {
      nodes: flow.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          fieldVisibility,
        },
      })),
      edges: flow.edges,
    };
  }, [tree, fieldVisibility]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-w-[min(100vw-2rem,72rem)] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Inventory Hierarchy
            {item ? ` — ${item.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            {serialLabel
              ? `Composed stock for serial ${serialLabel} (${item?.inventory_type ?? 'item'}).`
              : `Composed stock hierarchy for this ${item?.inventory_type ?? 'inventory'} item.`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-lg border bg-muted/10">
          {loading ? (
            <PageLoader className="flex h-full w-full items-center justify-center" />
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No hierarchy data found for this inventory item.
            </div>
          ) : (
            <>
              <HierarchyNodeLegend
                visibility={fieldVisibility}
                onChange={setFieldVisibility}
              />
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={HIERARCHY_FLOW_NODE_TYPES}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  zoomOnScroll
                  proOptions={{ hideAttribution: true }}
                  className="h-full w-full"
                >
                  <Background gap={16} size={1} />
                  <Controls showInteractive={false} />
                  <MiniMap
                    nodeStrokeWidth={3}
                    pannable
                    zoomable
                    className="bg-background/80!"
                  />
                </ReactFlow>
              </ReactFlowProvider>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
