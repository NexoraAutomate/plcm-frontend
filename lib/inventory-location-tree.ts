import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';

export type LocationLevel = 'room' | 'cabinet' | 'rack';

export type LocationRack = {
  id: string;
  name: string;
};

export type LocationCabinet = {
  id: string;
  name: string;
  racks: LocationRack[];
};

export type LocationRoom = {
  id: string;
  name: string;
  cabinets: LocationCabinet[];
};

export type InventoryLocationTree = LocationRoom[];

export type LocationTreeNodeData = {
  level: LocationLevel;
  name: string;
  roomId: string;
  cabinetId?: string;
  rackId?: string;
  canAddChild: boolean;
  readOnly?: boolean;
};

export const LOCATION_NODE_WIDTH = 180;
export const LOCATION_NODE_HEIGHT = 72;

export function newLocationId(prefix = 'loc'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeLocationTree(raw: unknown): InventoryLocationTree {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((room) => {
      if (!room || typeof room !== 'object') return null;
      const r = room as Record<string, unknown>;
      const name = String(r.name || '').trim();
      if (!name) return null;
      const cabinetsRaw = Array.isArray(r.cabinets) ? r.cabinets : [];
      const cabinets = cabinetsRaw
        .map((cabinet) => {
          if (!cabinet || typeof cabinet !== 'object') return null;
          const c = cabinet as Record<string, unknown>;
          const cabinetName = String(c.name || '').trim();
          if (!cabinetName) return null;
          const racksRaw = Array.isArray(c.racks) ? c.racks : [];
          const racks = racksRaw
            .map((rack) => {
              if (!rack || typeof rack !== 'object') return null;
              const rk = rack as Record<string, unknown>;
              const rackName = String(rk.name || '').trim();
              if (!rackName) return null;
              return {
                id: String(rk.id || '').trim() || newLocationId('rack'),
                name: rackName,
              } satisfies LocationRack;
            })
            .filter((item): item is LocationRack => item != null);
          return {
            id: String(c.id || '').trim() || newLocationId('cab'),
            name: cabinetName,
            racks,
          } satisfies LocationCabinet;
        })
        .filter((item): item is LocationCabinet => item != null);
      return {
        id: String(r.id || '').trim() || newLocationId('room'),
        name,
        cabinets,
      } satisfies LocationRoom;
    })
    .filter((item): item is LocationRoom => item != null);
}

export function findRoom(
  tree: InventoryLocationTree,
  roomId: string
): LocationRoom | undefined {
  return tree.find((room) => room.id === roomId);
}

export function findCabinet(
  tree: InventoryLocationTree,
  roomId: string,
  cabinetId: string
): LocationCabinet | undefined {
  return findRoom(tree, roomId)?.cabinets.find((cabinet) => cabinet.id === cabinetId);
}

export function cabinetsForRoom(
  tree: InventoryLocationTree,
  roomName: string
): LocationCabinet[] {
  const room = tree.find((item) => item.name === roomName);
  return room?.cabinets ?? [];
}

export function racksForCabinet(
  tree: InventoryLocationTree,
  roomName: string,
  cabinetName: string
): LocationRack[] {
  const cabinet = cabinetsForRoom(tree, roomName).find((item) => item.name === cabinetName);
  return cabinet?.racks ?? [];
}

export function cloneTree(tree: InventoryLocationTree): InventoryLocationTree {
  return structuredClone(tree);
}

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

export function renameLocationNode(
  tree: InventoryLocationTree,
  data: LocationTreeNodeData,
  nextName: string
): InventoryLocationTree {
  const name = nextName.trim();
  if (!name) return tree;
  const next = cloneTree(tree);
  const room = findRoom(next, data.roomId);
  if (!room) return tree;

  if (data.level === 'room') {
    room.name = name;
    return next;
  }
  const cabinet = room.cabinets.find((item) => item.id === data.cabinetId);
  if (!cabinet) return tree;
  if (data.level === 'cabinet') {
    cabinet.name = name;
    return next;
  }
  const rack = cabinet.racks.find((item) => item.id === data.rackId);
  if (!rack) return tree;
  rack.name = name;
  return next;
}

export function deleteLocationNode(
  tree: InventoryLocationTree,
  data: LocationTreeNodeData
): InventoryLocationTree {
  const next = cloneTree(tree);
  if (data.level === 'room') {
    return next.filter((room) => room.id !== data.roomId);
  }
  const room = findRoom(next, data.roomId);
  if (!room) return tree;
  if (data.level === 'cabinet') {
    room.cabinets = room.cabinets.filter((cabinet) => cabinet.id !== data.cabinetId);
    return next;
  }
  const cabinet = room.cabinets.find((item) => item.id === data.cabinetId);
  if (!cabinet) return tree;
  cabinet.racks = cabinet.racks.filter((rack) => rack.id !== data.rackId);
  return next;
}

export function addSiblingLocation(
  tree: InventoryLocationTree,
  data: LocationTreeNodeData,
  name: string
): InventoryLocationTree {
  const trimmed = name.trim();
  if (!trimmed) return tree;
  const next = cloneTree(tree);

  if (data.level === 'room') {
    next.push({ id: newLocationId('room'), name: trimmed, cabinets: [] });
    return next;
  }

  const room = findRoom(next, data.roomId);
  if (!room) return tree;

  if (data.level === 'cabinet') {
    room.cabinets.push({ id: newLocationId('cab'), name: trimmed, racks: [] });
    return next;
  }

  const cabinet = room.cabinets.find((item) => item.id === data.cabinetId);
  if (!cabinet) return tree;
  cabinet.racks.push({ id: newLocationId('rack'), name: trimmed });
  return next;
}

export function addChildLocation(
  tree: InventoryLocationTree,
  data: LocationTreeNodeData,
  name: string
): InventoryLocationTree {
  const trimmed = name.trim();
  if (!trimmed) return tree;
  const next = cloneTree(tree);
  const room = findRoom(next, data.roomId);
  if (!room) return tree;

  if (data.level === 'room') {
    room.cabinets.push({ id: newLocationId('cab'), name: trimmed, racks: [] });
    return next;
  }

  if (data.level === 'cabinet') {
    const cabinet = room.cabinets.find((item) => item.id === data.cabinetId);
    if (!cabinet) return tree;
    cabinet.racks.push({ id: newLocationId('rack'), name: trimmed });
    return next;
  }

  return tree;
}

export function addRootRoom(tree: InventoryLocationTree, name: string): InventoryLocationTree {
  const trimmed = name.trim();
  if (!trimmed) return tree;
  return [...cloneTree(tree), { id: newLocationId('room'), name: trimmed, cabinets: [] }];
}

export const LOCATION_LEVEL_LABEL: Record<LocationLevel, string> = {
  room: 'Room',
  cabinet: 'Cabinet',
  rack: 'Rack',
};
