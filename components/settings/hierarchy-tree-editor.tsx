'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Maximize2, Minimize2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  HIERARCHY_ENTITY_LEVELS,
  suggestAbbreviation,
  type HierarchyEntityLevel,
} from '@/lib/app-definitions';
import type { Hierarchy } from '@/lib/models';

const IndentedTree = dynamic(
  () => import('@ant-design/graphs').then((m) => m.IndentedTree),
  { ssr: false, loading: () => <p className="p-4 text-sm text-muted-foreground">Loading tree…</p> }
);

const CHILD_LEVEL: Record<HierarchyEntityLevel, HierarchyEntityLevel | null> = {
  system: 'subsystem',
  subsystem: 'module',
  module: 'unit',
  unit: 'component',
  component: null,
};

const PARENT_LEVEL: Record<HierarchyEntityLevel, HierarchyEntityLevel | null> = {
  system: null,
  subsystem: 'system',
  module: 'subsystem',
  unit: 'module',
  component: 'unit',
};

type DraftNode = {
  draftId: string;
  hierarchy_type: HierarchyEntityLevel;
  parent_id: number | null;
  name: string;
  abbreviation: string;
};

type NodeMeta = {
  label: string;
  hierarchyId: number | null;
  draftId: string | null;
  isDraft: boolean;
  hierarchyType: HierarchyEntityLevel | 'root';
  name: string;
  abbreviation: string;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  childType: HierarchyEntityLevel | null;
};

type TreeNodeData = {
  id: string;
  children?: TreeNodeData[];
  data: NodeMeta;
};

type NodeFormState = {
  mode: 'create' | 'edit';
  /** Real hierarchy id when editing saved node */
  id?: number;
  /** Draft id when finishing a placeholder node */
  draftId?: string;
  name: string;
  abbreviation: string;
  hierarchy_type: HierarchyEntityLevel;
  parent_id: number | null;
};

type GraphLike = {
  /** G6 sets this true after destroy(); never use the instance after that */
  destroyed?: boolean;
  fitView?: (options?: unknown) => void | Promise<void>;
  getZoom?: () => number;
  zoomTo?: (ratio: number, animation?: boolean | object, origin?: unknown) => void | Promise<void>;
  translateTo?: (
    point: [number, number] | { x: number; y: number },
    animation?: boolean | object
  ) => void | Promise<void>;
  translateBy?: (
    offset: [number, number] | { x: number; y: number },
    animation?: boolean | object
  ) => void | Promise<void>;
  getPosition?: () => [number, number] | { x: number; y: number };
  getElementPosition?: (id: string) => [number, number] | { x: number; y: number } | null;
  getViewportByCanvas?: (
    point: [number, number] | { x: number; y: number }
  ) => [number, number] | { x: number; y: number };
};

function isGraphAlive(graph: GraphLike | null | undefined): graph is GraphLike {
  return Boolean(graph && !graph.destroyed);
}

/** Keep pan/zoom fixed after re-layout; optionally pin a node under the same screen point. */
type ViewportLock = {
  zoom: number;
  position: [number, number] | null;
  anchorNodeId?: string;
  anchorViewport?: [number, number];
};

export type HierarchyTreeEditorProps = {
  hierarchies: Hierarchy[];
  abbrDraft: Record<number, string>;
  setAbbrDraft: Dispatch<SetStateAction<Record<number, string>>>;
  levelLabel: (level: string, plural?: boolean) => string;
  onCreate: (input: {
    name: string;
    hierarchy_type: HierarchyEntityLevel;
    parent_id?: number | null;
    abbreviation?: string;
  }) => Promise<Hierarchy | null>;
  onUpdate: (
    id: number,
    patch: {
      name?: string;
      abbreviation?: string;
      parent_id?: number | null;
      hierarchy_type?: string;
    }
  ) => Promise<Hierarchy | null>;
  onDelete: (id: number) => Promise<boolean>;
  previewHeight?: number;
};

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTreeData(
  hierarchies: Hierarchy[],
  drafts: DraftNode[],
  abbrDraft: Record<number, string>,
  levelLabel: (level: string, plural?: boolean) => string
): TreeNodeData {
  const byParent = new Map<number | 'root', Hierarchy[]>();
  for (const h of hierarchies) {
    const key = h.parent_id == null ? 'root' : h.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(h);
    byParent.set(key, list);
  }

  const draftsByParent = new Map<number | 'root', DraftNode[]>();
  for (const d of drafts) {
    const key = d.parent_id == null ? 'root' : d.parent_id;
    const list = draftsByParent.get(key) ?? [];
    list.push(d);
    draftsByParent.set(key, list);
  }

  const makeDraftNode = (d: DraftNode): TreeNodeData => {
    const childType = CHILD_LEVEL[d.hierarchy_type];
    return {
      id: d.draftId,
      data: {
        label: d.name,
        hierarchyId: null,
        draftId: d.draftId,
        isDraft: true,
        hierarchyType: d.hierarchy_type,
        name: d.name,
        abbreviation: d.abbreviation || '…',
        canAdd: false,
        canEdit: true,
        canDelete: true,
        childType,
      },
      children: [],
    };
  };

  const walk = (parentKey: number | 'root'): TreeNodeData[] => {
    const list = (byParent.get(parentKey) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const nodes: TreeNodeData[] = list.map((h) => {
      const level = h.hierarchy_type as HierarchyEntityLevel;
      const abbr = (abbrDraft[h.id] || h.abbreviation || suggestAbbreviation(h.name)).toUpperCase();
      const childType = CHILD_LEVEL[level];
      return {
        id: String(h.id),
        data: {
          label: `${h.name} [${abbr}]`,
          hierarchyId: h.id,
          draftId: null,
          isDraft: false,
          hierarchyType: level,
          name: h.name,
          abbreviation: abbr,
          canAdd: Boolean(childType),
          canEdit: true,
          canDelete: true,
          childType,
        },
        children: walk(h.id),
      };
    });
    // Append unsaved draft placeholders under this parent
    const parentDrafts = draftsByParent.get(parentKey) ?? [];
    for (const d of parentDrafts) nodes.push(makeDraftNode(d));
    return nodes;
  };

  return {
    id: 'root',
    data: {
      label: 'System Hierarchy',
      hierarchyId: null,
      draftId: null,
      isDraft: false,
      hierarchyType: 'root',
      name: 'System Hierarchy',
      abbreviation: '',
      canAdd: true,
      canEdit: false,
      canDelete: false,
      childType: 'system',
    },
    children: walk('root'),
  };
}

type GraphHandlers = {
  onAdd: (parentId: number | null, childType: HierarchyEntityLevel) => void;
  onOpenNode: (meta: NodeMeta) => void;
  onDeleteNode: (meta: NodeMeta) => void;
  levelLabel: (level: string) => string;
};

function HierarchyGraphNode({
  data,
  handlers,
}: {
  data: { id?: string; depth?: number; data?: NodeMeta; style?: { color?: string } };
  handlers: GraphHandlers;
}) {
  const meta = data.data;
  if (!meta) {
    return (
      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">{String(data.id)}</div>
    );
  }

  const depth = data.depth ?? 0;
  const isRoot = meta.hierarchyType === 'root';
  const isDraft = meta.isDraft;
  const branchColor = data.style?.color || '#6366f1';
  const filled = depth <= 1 && !isDraft;
  const ghostBtn =
    'flex h-4 w-4 items-center justify-center rounded-[3px] border border-current/25 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/20';
  const ghostBtnLight =
    'flex h-4 w-4 items-center justify-center rounded-[3px] border border-slate-300/80 bg-white/80 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white';

  return (
    <div
      className="group relative flex items-center gap-1 rounded-md border px-2 py-1 shadow-sm transition-shadow hover:shadow-md"
      style={{
        background: isDraft
          ? 'repeating-linear-gradient(-45deg, #fffbeb, #fffbeb 4px, #fef3c7 4px, #fef3c7 8px)'
          : filled
            ? isRoot
              ? '#f1f5f9'
              : branchColor
            : '#fff',
        borderColor: isDraft ? '#f59e0b' : filled ? 'transparent' : branchColor,
        borderStyle: isDraft ? 'dashed' : 'solid',
        boxShadow: isDraft ? '0 0 0 2px rgba(245, 158, 11, 0.25)' : undefined,
        color: filled && !isRoot && !isDraft ? '#fff' : '#0f172a',
        minWidth: 120,
        maxWidth: 240,
        paddingRight: 6,
      }}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          if (meta.canEdit) handlers.onOpenNode(meta);
        }}
        title={
          isDraft
            ? 'Click to enter details (not saved until completed)'
            : meta.canEdit
              ? 'Click to edit'
              : meta.label
        }
      >
        <div className="truncate text-[11px] font-semibold leading-tight">
          {meta.name}
          {isDraft ? (
            <span className="ml-1 text-[9px] font-normal text-amber-700">draft</span>
          ) : null}
        </div>
        <div
          className="truncate text-[9px] leading-tight opacity-80"
          style={{
            color:
              filled && !isRoot && !isDraft ? 'rgba(255,255,255,0.85)' : '#64748b',
          }}
        >
          {isRoot
            ? 'Hover · + to add placeholder'
            : isDraft
              ? `Unsaved ${handlers.levelLabel(meta.hierarchyType)} · click to fill`
              : `${meta.abbreviation} · ${handlers.levelLabel(meta.hierarchyType)}`}
        </div>
      </button>

      <div
        className="absolute -right-1 -top-1.5 z-10 flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {meta.canAdd && meta.childType ? (
          <button
            type="button"
            className={filled && !isRoot ? ghostBtn : ghostBtnLight}
            title={`Add ${handlers.levelLabel(meta.childType)}`}
            onClick={(e) => {
              e.stopPropagation();
              handlers.onAdd(meta.hierarchyId, meta.childType!);
            }}
          >
            <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
        ) : null}
        {meta.canEdit ? (
          <button
            type="button"
            className={filled && !isRoot && !isDraft ? ghostBtn : ghostBtnLight}
            title={isDraft ? 'Enter details' : 'Edit'}
            onClick={(e) => {
              e.stopPropagation();
              handlers.onOpenNode(meta);
            }}
          >
            <Pencil className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
        ) : null}
        {meta.canDelete ? (
          <button
            type="button"
            className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-red-400/50 bg-red-50 text-red-600 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-100"
            title={isDraft ? 'Discard draft' : 'Delete'}
            onClick={(e) => {
              e.stopPropagation();
              handlers.onDeleteNode(meta);
            }}
          >
            <Trash2 className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function measureNodeSize(meta?: NodeMeta): [number, number] {
  const labelLen = meta?.label?.length ?? 10;
  const width = Math.min(240, Math.max(120, labelLen * 6.5 + 28));
  return [width, 36];
}

function asXY(point: unknown): [number, number] | null {
  if (point == null) return null;
  if (Array.isArray(point) && point.length >= 2) {
    return [Number(point[0]), Number(point[1])];
  }
  if (typeof point === 'object' && point !== null && 'x' in point && 'y' in point) {
    const o = point as { x: unknown; y: unknown };
    return [Number(o.x), Number(o.y)];
  }
  return null;
}

function captureViewportLock(
  graph: GraphLike | null,
  anchorNodeId?: string | null
): ViewportLock | null {
  if (!isGraphAlive(graph) || !graph.getZoom) return null;
  try {
    const zoom = graph.getZoom() ?? 1;
    const position = asXY(graph.getPosition?.());
    let anchorViewport: [number, number] | undefined;
    if (anchorNodeId && graph.getElementPosition && graph.getViewportByCanvas) {
      const canvasPos = asXY(graph.getElementPosition(anchorNodeId));
      if (canvasPos) {
        const vp = asXY(graph.getViewportByCanvas(canvasPos));
        if (vp) anchorViewport = vp;
      }
    }
    return {
      zoom,
      position,
      anchorNodeId: anchorNodeId || undefined,
      anchorViewport,
    };
  } catch {
    return null;
  }
}

/** Re-apply pan/zoom so the tree does not jump after data-driven relayout. */
async function applyViewportLock(
  graph: GraphLike | null,
  lock: ViewportLock | null,
  stillValid?: () => boolean
) {
  if (!isGraphAlive(graph) || !lock) return;
  if (stillValid && !stillValid()) return;
  try {
    if (typeof lock.zoom === 'number' && graph.zoomTo) {
      await graph.zoomTo(lock.zoom, false);
    }
    if (!isGraphAlive(graph) || (stillValid && !stillValid())) return;

    // Prefer pin-to-parent: keeps the clicked node under the same screen point
    if (
      lock.anchorNodeId &&
      lock.anchorViewport &&
      graph.getElementPosition &&
      graph.getViewportByCanvas &&
      graph.translateBy
    ) {
      const canvasPos = asXY(graph.getElementPosition(lock.anchorNodeId));
      if (canvasPos) {
        const now = asXY(graph.getViewportByCanvas(canvasPos));
        if (now) {
          const dx = lock.anchorViewport[0] - now[0];
          const dy = lock.anchorViewport[1] - now[1];
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            await graph.translateBy([dx, dy], false);
          }
          return;
        }
      }
    }

    // Fallback: restore absolute graph translation
    if (lock.position && graph.translateTo) {
      await graph.translateTo(lock.position, false);
    }
  } catch {
    // Graph may have been torn down mid-async camera op — safe to ignore
  }
}

/** Cancelable delayed pin (avoids calling G6 after destroy / remount). */
function createViewportLockScheduler() {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;

  const cancel = () => {
    generation += 1;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const schedule = (graph: GraphLike | null, lock: ViewportLock | null) => {
    cancel();
    if (!isGraphAlive(graph) || !lock) return;
    const gen = generation;
    const stillValid = () => gen === generation && isGraphAlive(graph);

    void applyViewportLock(graph, lock, stillValid);
    // One short follow-up after paint — do not stack multiple long timeouts
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!stillValid()) return;
      void applyViewportLock(graph, lock, stillValid);
      timer = setTimeout(() => {
        timer = null;
        if (!stillValid()) return;
        void applyViewportLock(graph, lock, stillValid);
      }, 48);
    });
  };

  return { cancel, schedule };
}

const GRAPH_LAYOUT = {
  type: 'indented' as const,
  direction: 'LR' as const,
  getVGap: () => 14,
  getHeight: () => 36,
  animation: false as const,
};

const GRAPH_BEHAVIORS = ['drag-canvas', 'zoom-canvas', 'collapse-expand'];

function graphTransforms(prev: unknown[]) {
  const next = Array.isArray(prev) ? [...prev] : [];
  const collapseIdx = next.findIndex(
    (t) =>
      typeof t === 'object' &&
      t &&
      (t as { type?: string }).type === 'collapse-expand-react-node'
  );
  if (collapseIdx >= 0) {
    next[collapseIdx] = {
      ...(next[collapseIdx] as object),
      enable: true,
      trigger: 'icon',
    };
  }
  return next;
}

/** Handlers live on a module ref so node options stay referentially stable for Graphin. */
const sharedHandlersRef: { current: GraphHandlers } = {
  current: {
    onAdd: () => undefined,
    onOpenNode: () => undefined,
    onDeleteNode: () => undefined,
    levelLabel: (l) => l,
  },
};

const STABLE_NODE_OPTIONS = {
  type: 'react' as const,
  style: {
    component: (data: {
      id?: string;
      depth?: number;
      data?: NodeMeta;
      style?: { color?: string };
    }) => <HierarchyGraphNode data={data} handlers={sharedHandlersRef.current} />,
    size: (data: { data?: NodeMeta }) => measureNodeSize(data.data),
  },
  state: {
    active: { halo: false },
    selected: { halo: false },
  },
};

type HierarchyIndentedGraphProps = {
  shellKey: string;
  treeData: TreeNodeData;
  height: number;
  width?: number;
  onReady: (graph: GraphLike) => void;
};

/** Isolated so parent UI state (dialogs) does not force Graphin setOptions + re-render. */
const HierarchyIndentedGraph = memo(function HierarchyIndentedGraph({
  shellKey,
  treeData,
  height,
  width,
  onReady,
}: HierarchyIndentedGraphProps) {
  return (
    <IndentedTree
      key={shellKey}
      data={treeData}
      type="boxed"
      direction="right"
      defaultExpandLevel={4}
      height={height}
      width={width}
      nodeMinWidth={120}
      nodeMaxWidth={240}
      node={STABLE_NODE_OPTIONS}
      transforms={graphTransforms}
      layout={GRAPH_LAYOUT}
      animation={false}
      behaviors={GRAPH_BEHAVIORS}
      onReady={onReady}
    />
  );
});

export function HierarchyTreeEditor({
  hierarchies,
  abbrDraft,
  setAbbrDraft,
  levelLabel,
  onCreate,
  onUpdate,
  onDelete,
  previewHeight = 420,
}: HierarchyTreeEditorProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [form, setForm] = useState<NodeFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Hierarchy | null>(null);
  const [drafts, setDrafts] = useState<DraftNode[]>([]);
  const [viewport, setViewport] = useState({ w: 1280, h: 720 });

  const previewGraphRef = useRef<GraphLike | null>(null);
  const fullscreenGraphRef = useRef<GraphLike | null>(null);
  const viewportLockRef = useRef<ViewportLock | null>(null);
  const lockSchedulerRef = useRef(createViewportLockScheduler());
  const didInitialFsFit = useRef(false);
  const fullscreenShellKey = useRef(0);
  const fullscreenOpenRef = useRef(false);
  fullscreenOpenRef.current = fullscreenOpen;

  const hierarchyById = useMemo(() => {
    const map = new Map<number, Hierarchy>();
    for (const h of hierarchies) map.set(h.id, h);
    return map;
  }, [hierarchies]);

  const handlersRef = useRef<GraphHandlers>({
    onAdd: () => undefined,
    onOpenNode: () => undefined,
    onDeleteNode: () => undefined,
    levelLabel: (l) => l,
  });

  const activeGraph = () =>
    fullscreenOpen ? fullscreenGraphRef.current : previewGraphRef.current;

  /** Capture zoom/pan (and optional parent pin) before a tree mutation. */
  const lockViewport = useCallback(
    (anchorNodeId?: string | null) => {
      viewportLockRef.current = captureViewportLock(activeGraph(), anchorNodeId);
    },
    [fullscreenOpen]
  );

  const restoreLockedViewport = useCallback((graph: GraphLike | null) => {
    if (!isGraphAlive(graph) || !viewportLockRef.current) return;
    lockSchedulerRef.current.schedule(graph, viewportLockRef.current);
  }, []);

  const closeFullscreen = useCallback(() => {
    lockSchedulerRef.current.cancel();
    setFullscreenOpen(false);
    fullscreenGraphRef.current = null;
    didInitialFsFit.current = false;
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const scheduler = lockSchedulerRef.current;
    return () => {
      scheduler.cancel();
      previewGraphRef.current = null;
      fullscreenGraphRef.current = null;
    };
  }, []);

  const openFullscreen = useCallback(() => {
    fullscreenShellKey.current += 1;
    didInitialFsFit.current = false;
    if (typeof window !== 'undefined') {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    setFullscreenOpen(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!fullscreenOpen) return;

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenOpen(false);
        fullscreenGraphRef.current = null;
        didInitialFsFit.current = false;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (form || deleteTarget) return;
      event.preventDefault();
      closeFullscreen();
    };
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      // Size changes only — do not auto fitView (that zooms out the tree)
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [closeFullscreen, deleteTarget, form, fullscreenOpen]);

  useEffect(() => {
    if (!fullscreenOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreenOpen]);

  /** + only places a local placeholder box — nothing is saved until form submit */
  const placeDraft = useCallback(
    (opts: { parent_id: number | null; hierarchy_type: HierarchyEntityLevel }) => {
      // Pin the parent so re-layout does not yank the view away from the click
      const anchorId = opts.parent_id == null ? 'root' : String(opts.parent_id);
      lockViewport(anchorId);
      const placeholder = `New ${levelLabel(opts.hierarchy_type)}`;
      setDrafts((prev) => [
        ...prev,
        {
          draftId: newDraftId(),
          hierarchy_type: opts.hierarchy_type,
          parent_id: opts.parent_id,
          name: placeholder,
          abbreviation: '',
        },
      ]);
    },
    [levelLabel, lockViewport]
  );

  const openDraftForm = useCallback(
    (draftId: string) => {
      const d = drafts.find((x) => x.draftId === draftId);
      if (!d) return;
      setForm({
        mode: 'create',
        draftId: d.draftId,
        name: d.name.startsWith('New ') ? '' : d.name,
        abbreviation: d.abbreviation,
        hierarchy_type: d.hierarchy_type,
        parent_id: d.parent_id,
      });
    },
    [drafts]
  );

  const openEdit = useCallback(
    (hierarchyId: number) => {
      const node = hierarchyById.get(hierarchyId);
      if (!node) return;
      setForm({
        mode: 'edit',
        id: node.id,
        name: node.name,
        abbreviation:
          abbrDraft[node.id] || node.abbreviation || suggestAbbreviation(node.name),
        hierarchy_type: node.hierarchy_type as HierarchyEntityLevel,
        parent_id: node.parent_id ?? null,
      });
    },
    [abbrDraft, hierarchyById]
  );

  const discardDraft = useCallback(
    (draftId: string) => {
      const draft = drafts.find((d) => d.draftId === draftId);
      const anchorId =
        draft == null
          ? undefined
          : draft.parent_id == null
            ? 'root'
            : String(draft.parent_id);
      lockViewport(anchorId);
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
      setForm((f) => (f?.draftId === draftId ? null : f));
    },
    [drafts, lockViewport]
  );

  handlersRef.current = {
    onAdd: (parentId, childType) => {
      placeDraft({ parent_id: parentId, hierarchy_type: childType });
    },
    onOpenNode: (meta) => {
      if (meta.isDraft && meta.draftId) openDraftForm(meta.draftId);
      else if (meta.hierarchyId != null) openEdit(meta.hierarchyId);
    },
    onDeleteNode: (meta) => {
      if (meta.isDraft && meta.draftId) discardDraft(meta.draftId);
      else if (meta.hierarchyId != null) {
        const node = hierarchyById.get(meta.hierarchyId);
        if (node) setDeleteTarget(node);
      }
    },
    levelLabel: (level) => levelLabel(level),
  };
  sharedHandlersRef.current = handlersRef.current;

  const treeData = useMemo(
    () => buildTreeData(hierarchies, drafts, abbrDraft, levelLabel),
    [abbrDraft, drafts, hierarchies, levelLabel]
  );

  // Viewport is re-pinned only in onReady (after G6 render finishes).
  // Do not restore from a treeData effect — that races mid-render and hits destroyed graphs.

  const parentOptions = useMemo(() => {
    if (!form) return [];
    const needed = PARENT_LEVEL[form.hierarchy_type];
    if (!needed) return [];
    return hierarchies.filter((h) => h.hierarchy_type === needed);
  }, [form, hierarchies]);

  const onGraphReady = useCallback((graph: GraphLike, fullscreen: boolean) => {
    if (!isGraphAlive(graph)) return;

    if (fullscreen) {
      fullscreenGraphRef.current = graph;
      // First open only — fit once; later data updates keep the same view
      if (!didInitialFsFit.current) {
        didInitialFsFit.current = true;
        try {
          void Promise.resolve(graph.fitView?.()).then(() => {
            if (!isGraphAlive(graph)) return;
            viewportLockRef.current = captureViewportLock(graph, 'root');
          });
        } catch {
          // ignore
        }
      } else {
        restoreLockedViewport(graph);
      }
      return;
    }

    // While full screen is open the preview tree is unmounted; ignore stale callbacks
    if (fullscreenOpenRef.current) return;
    previewGraphRef.current = graph;
    if (viewportLockRef.current) restoreLockedViewport(graph);
  }, [restoreLockedViewport]);

  const onPreviewReady = useCallback(
    (graph: GraphLike) => onGraphReady(graph, false),
    [onGraphReady]
  );
  const onFullscreenReady = useCallback(
    (graph: GraphLike) => onGraphReady(graph, true),
    [onGraphReady]
  );

  async function submitForm() {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return;
    const abbreviation = (form.abbreviation || suggestAbbreviation(name)).trim().toUpperCase();
    setSaving(true);
    try {
      if (form.mode === 'create') {
        const anchorId =
          form.hierarchy_type === 'system' || form.parent_id == null
            ? 'root'
            : String(form.parent_id);
        lockViewport(anchorId);
        const created = await onCreate({
          name,
          hierarchy_type: form.hierarchy_type,
          parent_id: form.hierarchy_type === 'system' ? null : form.parent_id,
          abbreviation,
        });
        if (created && form.draftId) {
          setDrafts((prev) => prev.filter((d) => d.draftId !== form.draftId));
        }
      } else if (form.id != null) {
        lockViewport(String(form.id));
        await onUpdate(form.id, {
          name,
          abbreviation,
          parent_id: form.hierarchy_type === 'system' ? null : form.parent_id,
          hierarchy_type: form.hierarchy_type,
        });
        setAbbrDraft((prev) => ({ ...prev, [form.id!]: abbreviation }));
      }
      setForm(null);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const anchorId =
      deleteTarget.parent_id == null ? 'root' : String(deleteTarget.parent_id);
    lockViewport(anchorId);
    await onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  function renderGraph(height: number, fullscreen = false) {
    return (
      <HierarchyIndentedGraph
        shellKey={fullscreen ? `fs-shell-${fullscreenShellKey.current}` : 'preview-shell'}
        treeData={treeData}
        height={height}
        width={fullscreen ? viewport.w : undefined}
        onReady={fullscreen ? onFullscreenReady : onPreviewReady}
      />
    );
  }

  const fullscreenOverlay =
    fullscreenOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-40 flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label="Hierarchy graph full screen"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
              <div className="pointer-events-auto max-w-md rounded-md border border-border/80 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                + adds a draft box (not saved). Click the draft to fill details. Esc exits full
                screen.
              </div>
              <div className="pointer-events-auto flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 shadow-sm"
                  onClick={() => placeDraft({ parent_id: null, hierarchy_type: 'system' })}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {levelLabel('system')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 shadow-sm"
                  title="Reset zoom / position"
                  onClick={() => {
                    const graph = fullscreenGraphRef.current;
                    if (!isGraphAlive(graph)) return;
                    try {
                      void Promise.resolve(graph.fitView?.()).then(() => {
                        if (!isGraphAlive(graph)) return;
                        viewportLockRef.current = captureViewportLock(graph, 'root');
                      });
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Reset view
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 shadow-sm"
                  title="Exit full screen (Esc)"
                  onClick={closeFullscreen}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 shadow-sm"
                  title="Close (Esc)"
                  onClick={closeFullscreen}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {renderGraph(viewport.h, true)}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative h-full w-full">
        <div className="w-full overflow-hidden" style={{ height: previewHeight }}>
          {/* Unmount preview while full screen so G6 does not keep two instances alive */}
          {fullscreenOpen ? (
            <p className="p-4 text-sm text-muted-foreground">Open full screen…</p>
          ) : (
            renderGraph(previewHeight)
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-3 right-3 z-10 h-9 w-9 shadow-md"
          title="Full screen graph"
          onClick={openFullscreen}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {fullscreenOverlay}

      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          // Closing without Save: draft stays on the tree (unless user discards it)
          if (!open) setForm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form?.mode === 'create' ? 'Complete hierarchy entity' : 'Edit hierarchy entity'}
            </DialogTitle>
            <DialogDescription>
              {form
                ? form.mode === 'create'
                  ? `Fill details for this ${levelLabel(form.hierarchy_type)}. Nothing is saved until you click Save.`
                  : `Update ${form.name}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={form.hierarchy_type} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HIERARCHY_ENTITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {levelLabel(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.hierarchy_type !== 'system' ? (
                <div className="space-y-2">
                  <Label>Parent {levelLabel(PARENT_LEVEL[form.hierarchy_type] || 'system')}</Label>
                  <Select
                    value={form.parent_id != null ? String(form.parent_id) : ''}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((prev) => {
                      if (!prev) return prev;
                      const shouldAutoAbbr =
                        prev.mode === 'create' &&
                        (!prev.abbreviation ||
                          prev.abbreviation === suggestAbbreviation(prev.name));
                      return {
                        ...prev,
                        name,
                        abbreviation: shouldAutoAbbr
                          ? suggestAbbreviation(name)
                          : prev.abbreviation,
                      };
                    });
                  }}
                  placeholder="e.g. ACU"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Abbreviation ({'{entityAbbr}'})</Label>
                <Input
                  className="font-mono uppercase"
                  value={form.abbreviation}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, abbreviation: e.target.value.toUpperCase() } : prev
                    )
                  }
                  placeholder={suggestAbbreviation(form.name || 'AC')}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {form.mode === 'create' && form.draftId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mr-auto text-destructive"
                    onClick={() => {
                      if (form.draftId) discardDraft(form.draftId);
                    }}
                  >
                    Discard draft
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  {form.mode === 'create' ? 'Close without saving' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    saving ||
                    !form.name.trim() ||
                    (form.hierarchy_type !== 'system' && form.parent_id == null)
                  }
                  onClick={() => void submitForm()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete hierarchy item?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.name}” and all of its child hierarchy items? This cannot be undone.`
            : ''
        }
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </>
  );
}
