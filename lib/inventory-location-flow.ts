import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';
import type {
  InventoryLocationTree,
  LocationTreeNodeData,
} from '@/lib/inventory-location-tree';
import {
  LOCATION_NODE_HEIGHT,
  LOCATION_NODE_WIDTH,
} from '@/lib/inventory-location-tree';

/**
 * XYFlow + dagre layout for storage location trees.
 * Kept separate so normalize/CRUD helpers do not pull heavy viz into inventory forms.
 */
export function buildLocationFlowGraph(
  tree: InventoryLocationTree,
  options?: { readOnly?: boolean }
): { nodes: Node<LocationTreeNodeData>[]; edges: Edge[] } {
  const nodes: Node<LocationTreeNodeData>[] = [];
  const edges: Edge[] = [];
  const readOnly = Boolean(options?.readOnly);

  for (const room of tree) {
    nodes.push({
      id: room.id,
      type: 'location',
      position: { x: 0, y: 0 },
      style: { width: LOCATION_NODE_WIDTH, height: LOCATION_NODE_HEIGHT },
      data: {
        level: 'room',
        name: room.name,
        roomId: room.id,
        canAddChild: true,
        readOnly,
      },
    });

    for (const cabinet of room.cabinets) {
      nodes.push({
        id: cabinet.id,
        type: 'location',
        position: { x: 0, y: 0 },
        style: { width: LOCATION_NODE_WIDTH, height: LOCATION_NODE_HEIGHT },
        data: {
          level: 'cabinet',
          name: cabinet.name,
          roomId: room.id,
          cabinetId: cabinet.id,
          canAddChild: true,
          readOnly,
        },
      });
      edges.push({
        id: `${room.id}-${cabinet.id}`,
        source: room.id,
        target: cabinet.id,
        type: 'smoothstep',
      });

      for (const rack of cabinet.racks) {
        nodes.push({
          id: rack.id,
          type: 'location',
          position: { x: 0, y: 0 },
          style: { width: LOCATION_NODE_WIDTH, height: LOCATION_NODE_HEIGHT },
          data: {
            level: 'rack',
            name: rack.name,
            roomId: room.id,
            cabinetId: cabinet.id,
            rackId: rack.id,
            canAddChild: false,
            readOnly,
          },
        });
        edges.push({
          id: `${cabinet.id}-${rack.id}`,
          source: cabinet.id,
          target: rack.id,
          type: 'smoothstep',
        });
      }
    }
  }

  return layoutLocationGraph(nodes, edges);
}

function layoutLocationGraph(
  nodes: Node<LocationTreeNodeData>[],
  edges: Edge[]
): { nodes: Node<LocationTreeNodeData>[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 64 });

  for (const node of nodes) {
    g.setNode(node.id, { width: LOCATION_NODE_WIDTH, height: LOCATION_NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const laidOut = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      position: {
        x: pos.x - LOCATION_NODE_WIDTH / 2,
        y: pos.y - LOCATION_NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: laidOut, edges };
}
