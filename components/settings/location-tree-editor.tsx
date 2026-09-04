'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  LocationTreeFlowNode,
  type LocationTreeNodeActions,
} from '@/components/settings/location-tree-flow-node';
import {
  LOCATION_LEVEL_LABEL,
  addChildLocation,
  addRootRoom,
  addSiblingLocation,
  buildLocationFlowGraph,
  deleteLocationNode,
  normalizeLocationTree,
  renameLocationNode,
  type InventoryLocationTree,
  type LocationLevel,
  type LocationTreeNodeData,
} from '@/lib/inventory-location-tree';

type Props = {
  value: InventoryLocationTree;
  onChange: (tree: InventoryLocationTree) => void;
  readOnly?: boolean;
};

type NameDialogState =
  | { mode: 'root-room' }
  | {
      mode: 'edit' | 'sibling' | 'child';
      nodeId: string;
      level: LocationLevel;
      currentName?: string;
    };

type AddChoiceState = {
  nodeId: string;
  level: 'room' | 'cabinet';
};

const LocationActionsContext = createContext<LocationTreeNodeActions | null>(null);

function BoundLocationNode(props: NodeProps<Node<LocationTreeNodeData>>) {
  const actions = useContext(LocationActionsContext);
  if (!actions) return null;
  return <LocationTreeFlowNode {...props} actions={actions} />;
}

const nodeTypes = { location: BoundLocationNode };

function LocationTreeEditorInner({ value, onChange, readOnly = false }: Props) {
  const tree = useMemo(() => normalizeLocationTree(value), [value]);
  const { fitView } = useReactFlow();
  const initial = useMemo(
    () => buildLocationFlowGraph(tree, { readOnly }),
    // Rebuild layout when tree content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(tree), readOnly]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [addChoice, setAddChoice] = useState<AddChoiceState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    nodeId: string;
    data: LocationTreeNodeData;
  } | null>(null);

  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
    const frame = requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));
    return () => cancelAnimationFrame(frame);
  }, [fitView, initial.edges, initial.nodes, setEdges, setNodes]);

  const findNodeData = useCallback(
    (nodeId: string): LocationTreeNodeData | null => {
      const node = nodes.find((item) => item.id === nodeId) as
        | Node<LocationTreeNodeData>
        | undefined;
      return node?.data ?? null;
    },
    [nodes]
  );

  const openNameDialog = useCallback((state: NameDialogState, initialName = '') => {
    setNameDialog(state);
    setNameValue(initialName);
  }, []);

  const actions = useMemo<LocationTreeNodeActions>(
    () => ({
      onAdd: (nodeId) => {
        const data = findNodeData(nodeId);
        if (!data || readOnly) return;
        if (data.level === 'rack') {
          openNameDialog({ mode: 'sibling', nodeId, level: 'rack' });
          return;
        }
        setAddChoice({ nodeId, level: data.level });
      },
      onEdit: (nodeId) => {
        const data = findNodeData(nodeId);
        if (!data || readOnly) return;
        openNameDialog(
          { mode: 'edit', nodeId, level: data.level, currentName: data.name },
          data.name
        );
      },
      onDelete: (nodeId) => {
        const data = findNodeData(nodeId);
        if (!data || readOnly) return;
        setDeleteTarget({ nodeId, data });
      },
    }),
    [findNodeData, openNameDialog, readOnly]
  );

  function applyTree(next: InventoryLocationTree) {
    onChange(normalizeLocationTree(next));
  }

  function confirmNameDialog() {
    if (!nameDialog) return;
    const trimmed = nameValue.trim();
    if (!trimmed) return;

    if (nameDialog.mode === 'root-room') {
      applyTree(addRootRoom(tree, trimmed));
      setNameDialog(null);
      return;
    }

    const data = findNodeData(nameDialog.nodeId);
    if (!data) {
      setNameDialog(null);
      return;
    }

    if (nameDialog.mode === 'edit') {
      applyTree(renameLocationNode(tree, data, trimmed));
    } else if (nameDialog.mode === 'sibling') {
      applyTree(addSiblingLocation(tree, data, trimmed));
    } else {
      applyTree(addChildLocation(tree, data, trimmed));
    }
    setNameDialog(null);
  }

  const dialogTitle = useMemo(() => {
    if (!nameDialog) return '';
    if (nameDialog.mode === 'root-room') return 'Add room';
    if (nameDialog.mode === 'edit') return `Edit ${LOCATION_LEVEL_LABEL[nameDialog.level]}`;
    if (nameDialog.mode === 'sibling') {
      return `Add sibling ${LOCATION_LEVEL_LABEL[nameDialog.level].toLowerCase()}`;
    }
    const childLabel = nameDialog.level === 'room' ? 'cabinet' : 'rack';
    return `Add child ${childLabel}`;
  }, [nameDialog]);

  return (
    <LocationActionsContext.Provider value={actions}>
      <div className="h-105 w-full overflow-hidden rounded-md border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          elementsSelectable
          fitView
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { strokeWidth: 1.5 } }}
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
          {!readOnly ? (
            <Panel position="top-left" className="m-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openNameDialog({ mode: 'root-room' })}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add room
              </Button>
            </Panel>
          ) : null}
          {tree.length === 0 ? (
            <Panel
              position="top-center"
              className="mt-16 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm"
            >
              No locations yet. Add a Room, then Cabinets under it, then Racks under each Cabinet.
            </Panel>
          ) : null}
        </ReactFlow>

        <Dialog open={addChoice != null} onOpenChange={(open) => !open && setAddChoice(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add location</DialogTitle>
              <DialogDescription>
                {addChoice?.level === 'room'
                  ? 'Add another Room at the same level, or a Cabinet under this Room.'
                  : 'Add another Cabinet at the same level, or a Rack under this Cabinet.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!addChoice) return;
                  openNameDialog({
                    mode: 'sibling',
                    nodeId: addChoice.nodeId,
                    level: addChoice.level,
                  });
                  setAddChoice(null);
                }}
              >
                Add sibling {addChoice?.level === 'room' ? 'Room' : 'Cabinet'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!addChoice) return;
                  openNameDialog({
                    mode: 'child',
                    nodeId: addChoice.nodeId,
                    level: addChoice.level,
                  });
                  setAddChoice(null);
                }}
              >
                Add child {addChoice?.level === 'room' ? 'Cabinet' : 'Rack'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={nameDialog != null} onOpenChange={(open) => !open && setNameDialog(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                Names must be unique among siblings under the same parent.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="location-node-name">Name</Label>
              <Input
                id="location-node-name"
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                placeholder={
                  nameDialog?.mode === 'root-room' || nameDialog?.level === 'room'
                    ? 'e.g. Room-1'
                    : nameDialog?.level === 'cabinet'
                      ? 'e.g. Cabinet-2'
                      : 'e.g. Rack-3'
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmNameDialog();
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNameDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={!nameValue.trim()} onClick={confirmNameDialog}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteTarget != null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete ${deleteTarget ? LOCATION_LEVEL_LABEL[deleteTarget.data.level] : 'location'}?`}
          description={
            deleteTarget?.data.level === 'room'
              ? `Delete "${deleteTarget.data.name}" and all of its cabinets and racks?`
              : deleteTarget?.data.level === 'cabinet'
                ? `Delete "${deleteTarget.data.name}" and all of its racks?`
                : `Delete "${deleteTarget?.data.name ?? ''}"?`
          }
          onConfirm={() => {
            if (!deleteTarget) return;
            applyTree(deleteLocationNode(tree, deleteTarget.data));
            setDeleteTarget(null);
          }}
        />
      </div>
    </LocationActionsContext.Provider>
  );
}

export function LocationTreeEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <LocationTreeEditorInner {...props} />
    </ReactFlowProvider>
  );
}
