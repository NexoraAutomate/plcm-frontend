'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { motion } from 'framer-motion';
import {
  Columns2,
  Copy,
  Download,
  Eraser,
  GitBranch,
  Group,
  ListTree,
  Lock,
  LockOpen,
  MousePointer2,
  Plus,
  Rows2,
  Save,
  Ungroup,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  CONFIG_TREE_NODE_FIELD_OPTIONS,
  type ConfigTreeNodeFieldVisibility,
} from '@/lib/config-tree-node-fields';

type InteractionMode = 'selection' | 'eraser';
type LayoutDirection = 'TB' | 'LR';

export type ConfigTreeFileActions = {
  onDownload: () => void;
  downloadBusy?: boolean;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveTitle?: string;
  saving?: boolean;
  onDuplicate?: () => void;
  duplicateDisabled?: boolean;
};

export type ConfigTreeGroupActions = {
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  selectionCount: number;
};

export type ConfigTreeToolbarProps = {
  showFullHierarchy: boolean;
  canToggleHierarchy: boolean;
  onToggleHierarchy: () => void;
  locked: boolean;
  readOnly: boolean;
  onToggleLock: () => void;
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  direction: LayoutDirection;
  onDirectionChange: (direction: LayoutDirection) => void;
  showAddSystem: boolean;
  addSystemLabel: string;
  onAddSystem: () => void;
  fieldVisibility: ConfigTreeNodeFieldVisibility;
  onFieldVisibilityChange: (visibility: ConfigTreeNodeFieldVisibility) => void;
  fileActions?: ConfigTreeFileActions;
  groupActions?: ConfigTreeGroupActions;
};

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.85 };
const SOFT = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.7 };
/** Matches Tailwind `rounded-2xl` on the rail shell. */
const RAIL_RADIUS = 16;
const ACCENT_STROKE = 1.5;

/** Upper half: midpoint → up the left edge → around the top-left corner. */
function topAccentPath(
  height: number,
  radius = RAIL_RADIUS,
  inset = ACCENT_STROKE / 2
) {
  const r = Math.min(radius, Math.max(0, (height - inset * 2) / 2));
  const mid = height / 2;
  return [
    `M ${inset} ${mid}`,
    `L ${inset} ${r}`,
    `A ${r} ${r} 0 0 1 ${radius} ${inset}`,
  ].join(' ');
}

/** Lower half: midpoint → down the left edge → around the bottom-left corner. */
function bottomAccentPath(
  height: number,
  radius = RAIL_RADIUS,
  inset = ACCENT_STROKE / 2
) {
  const r = Math.min(radius, Math.max(0, (height - inset * 2) / 2));
  const mid = height / 2;
  return [
    `M ${inset} ${mid}`,
    `L ${inset} ${height - r}`,
    `A ${r} ${r} 0 0 0 ${radius} ${height - inset}`,
  ].join(' ');
}

function RailAccent({
  open,
  hostRef,
}: {
  open: boolean;
  hostRef: RefObject<HTMLDivElement | null>;
}) {
  const gradId = `rail-accent-${useId().replace(/:/g, '')}`;
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const sync = () => setHeight(el.clientHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef]);

  if (height < 8) return null;

  const strokeProps = {
    fill: 'none' as const,
    stroke: `url(#${gradId})`,
    strokeWidth: ACCENT_STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Draw from center outward so both corners reveal together */}
      <motion.path
        d={topAccentPath(height)}
        {...strokeProps}
        initial={false}
        animate={{
          pathLength: open ? 1 : 0.55,
          opacity: open ? 1 : 0.55,
        }}
        transition={SOFT}
      />
      <motion.path
        d={bottomAccentPath(height)}
        {...strokeProps}
        initial={false}
        animate={{
          pathLength: open ? 1 : 0.55,
          opacity: open ? 1 : 0.55,
        }}
        transition={SOFT}
      />
    </svg>
  );
}

function ToolButton({
  active,
  disabled,
  title,
  onClick,
  icon,
  label,
  open,
  index,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  open: boolean;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        'relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left outline-none',
        'disabled:pointer-events-none disabled:opacity-35',
        'focus-visible:ring-2 focus-visible:ring-teal-400/50',
        active
          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
          : 'text-slate-500 hover:bg-teal-500/10 hover:text-teal-800 dark:text-slate-400 dark:hover:bg-teal-400/10 dark:hover:text-teal-200'
      )}
    >
      {active ? (
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.22),transparent_60%)]" />
      ) : null}
      <motion.span
        className="relative z-10 flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
        animate={{ scale: active ? 1.08 : 1 }}
        transition={SOFT}
      >
        {icon}
      </motion.span>
      <motion.span
        className="relative z-10 truncate text-xs font-semibold tracking-wide"
        initial={false}
        animate={{
          opacity: open ? 1 : 0,
          x: open ? 0 : -14,
        }}
        transition={{ ...SOFT, delay: open ? index * 0.028 : 0 }}
      >
        {label}
      </motion.span>
    </motion.button>
  );
}

function HoverRail({
  children,
  ariaLabel,
  openWidth = 200,
  collapsedHeight,
  expandedHeight,
  header,
}: {
  children: (open: boolean) => ReactNode;
  ariaLabel: string;
  openWidth?: number;
  collapsedHeight?: number;
  expandedHeight?: number;
  header?: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const collapses = collapsedHeight != null && expandedHeight != null;

  return (
    <motion.div
      className="nodrag nopan relative"
      aria-label={ariaLabel}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      initial={false}
      animate={{
        width: open ? openWidth : 44,
        ...(collapses
          ? { height: open ? expandedHeight : collapsedHeight }
          : {}),
      }}
      transition={SPRING}
      style={{ overflow: 'hidden' }}
    >
      <div
        ref={shellRef}
        className={cn(
          'relative h-full rounded-2xl border border-teal-500/20',
          'bg-gradient-to-br from-white/95 via-slate-50/90 to-teal-50/70',
          'backdrop-blur-xl',
          'dark:border-teal-400/20 dark:from-slate-950/95 dark:via-slate-900/90 dark:to-teal-950/50'
        )}
        style={{ width: openWidth }}
      >
        <RailAccent open={open} hostRef={shellRef} />
        <div className="relative flex flex-col gap-0.5 p-1.5">
          {header?.(open)}
          {children(open)}
        </div>
      </div>
    </motion.div>
  );
}

/** Vertical top-left tools + node-field toggles; expands on hover/focus. */
export function ConfigTreeToolbar({
  showFullHierarchy,
  canToggleHierarchy,
  onToggleHierarchy,
  locked,
  readOnly,
  onToggleLock,
  mode,
  onModeChange,
  direction,
  onDirectionChange,
  showAddSystem,
  addSystemLabel,
  onAddSystem,
  fieldVisibility,
  onFieldVisibilityChange,
  fileActions,
  groupActions,
}: ConfigTreeToolbarProps) {
  const toggleField = (
    key: keyof ConfigTreeNodeFieldVisibility,
    checked: boolean
  ) => {
    onFieldVisibilityChange({ ...fieldVisibility, [key]: checked });
  };

  type ToolItem = {
    key: string;
    active?: boolean;
    disabled?: boolean;
    title: string;
    onClick: () => void;
    icon: ReactNode;
    label: string;
  };

  const tools: ToolItem[] = [
    {
      key: 'hierarchy',
      active: showFullHierarchy,
      disabled: !canToggleHierarchy,
      title: showFullHierarchy
        ? 'Show system nodes only'
        : 'Show full hierarchy',
      onClick: onToggleHierarchy,
      icon: <GitBranch />,
      label: showFullHierarchy ? 'System only' : 'Full hierarchy',
    },
    {
      key: 'lock',
      active: locked,
      disabled: readOnly,
      title: locked ? 'Unlock layout' : 'Lock layout',
      onClick: onToggleLock,
      icon: locked ? <Lock /> : <LockOpen />,
      label: locked ? 'Locked' : 'Lock',
    },
    {
      key: 'selection',
      active: mode === 'selection',
      disabled: locked || readOnly,
      title: 'Selection mode',
      onClick: () => onModeChange('selection'),
      icon: <MousePointer2 />,
      label: 'Selection',
    },
    {
      key: 'eraser',
      active: mode === 'eraser',
      disabled: locked || readOnly,
      title: 'Eraser mode',
      onClick: () => onModeChange('eraser'),
      icon: <Eraser />,
      label: 'Eraser',
    },
    {
      key: 'vertical',
      active: direction === 'TB',
      disabled: locked,
      title: 'Vertical layout',
      onClick: () => onDirectionChange('TB'),
      icon: <Rows2 />,
      label: 'Vertical',
    },
    {
      key: 'horizontal',
      active: direction === 'LR',
      disabled: locked,
      title: 'Horizontal layout',
      onClick: () => onDirectionChange('LR'),
      icon: <Columns2 />,
      label: 'Horizontal',
    },
  ];

  if (showAddSystem) {
    tools.push({
      key: 'add-system',
      title: `Add ${addSystemLabel}`,
      onClick: onAddSystem,
      icon: <Plus />,
      label: addSystemLabel,
    });
  }

  if (groupActions && !readOnly) {
    tools.push({
      key: 'group',
      disabled: !groupActions.canGroup,
      title:
        groupActions.selectionCount >= 2
          ? 'Group selected siblings'
          : 'Select 2+ siblings (Shift+click)',
      onClick: groupActions.onGroup,
      icon: <Group />,
      label: 'Group',
    });
    tools.push({
      key: 'ungroup',
      disabled: !groupActions.canUngroup,
      title: 'Ungroup selected siblings',
      onClick: groupActions.onUngroup,
      icon: <Ungroup />,
      label: 'Ungroup',
    });
  }

  const fileTools: ToolItem[] = [];
  if (fileActions) {
    fileTools.push({
      key: 'download',
      disabled: fileActions.downloadBusy,
      title: 'Download PDF',
      onClick: fileActions.onDownload,
      icon: <Download />,
      label: fileActions.downloadBusy ? 'Exporting…' : 'Download',
    });
    if (fileActions.onSave) {
      fileTools.push({
        key: 'save',
        disabled: fileActions.saveDisabled || fileActions.saving,
        title: fileActions.saveTitle ?? 'Save configuration',
        onClick: fileActions.onSave,
        icon: <Save />,
        label: fileActions.saving ? 'Saving…' : 'Save',
      });
    }
    if (fileActions.onDuplicate) {
      fileTools.push({
        key: 'duplicate',
        disabled: fileActions.duplicateDisabled || fileActions.saving,
        title: 'Duplicate configuration',
        onClick: fileActions.onDuplicate,
        icon: <Copy />,
        label: 'Duplicate',
      });
    }
  }

  return (
    <div className="nodrag nopan flex flex-col gap-2.5">
      <HoverRail ariaLabel="Diagram tools" openWidth={200}>
        {(open) =>
          tools.map((tool, index) => (
            <ToolButton
              key={tool.key}
              active={tool.active}
              disabled={tool.disabled}
              title={tool.title}
              onClick={tool.onClick}
              icon={tool.icon}
              label={tool.label}
              open={open}
              index={index}
            />
          ))
        }
      </HoverRail>

      {fileTools.length > 0 ? (
        <HoverRail ariaLabel="File actions" openWidth={200}>
          {(open) =>
            fileTools.map((tool, index) => (
              <ToolButton
                key={tool.key}
                active={tool.active}
                disabled={tool.disabled}
                title={tool.title}
                onClick={tool.onClick}
                icon={tool.icon}
                label={tool.label}
                open={open}
                index={index}
              />
            ))
          }
        </HoverRail>
      ) : null}

      <HoverRail
        ariaLabel="Node field selection"
        openWidth={210}
        collapsedHeight={44}
        expandedHeight={44 + 12 + CONFIG_TREE_NODE_FIELD_OPTIONS.length * 32}
        header={(open) => (
          <div
            className="flex h-9 items-center gap-2.5 px-2.5"
            title="Node fields"
          >
            <motion.span
              className="flex size-4 shrink-0 items-center justify-center text-teal-600 dark:text-teal-300"
              animate={{ rotate: open ? 0 : -8, scale: open ? 1 : 0.95 }}
              transition={SOFT}
            >
              <ListTree className="size-4" />
            </motion.span>
            <motion.span
              className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-teal-800/80 dark:text-teal-200/90"
              initial={false}
              animate={{ opacity: open ? 1 : 0, x: open ? 0 : -12 }}
              transition={SOFT}
            >
              Node fields
            </motion.span>
          </div>
        )}
      >
        {(open) => (
          <div className="space-y-1 px-1.5 pb-1.5">
            {CONFIG_TREE_NODE_FIELD_OPTIONS.map((field, index) => (
              <motion.div
                key={field.key}
                initial={false}
                animate={{
                  opacity: open ? 1 : 0,
                  x: open ? 0 : -12,
                }}
                transition={{ ...SOFT, delay: open ? 0.05 + index * 0.04 : 0 }}
                className="flex h-8 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-teal-500/10"
              >
                <Checkbox
                  id={`config-tree-field-${field.key}`}
                  checked={fieldVisibility[field.key]}
                  onCheckedChange={(checked) =>
                    toggleField(field.key, checked === true)
                  }
                  className="border-teal-500/40 data-[state=checked]:border-teal-500 data-[state=checked]:bg-teal-500"
                />
                <Label
                  htmlFor={`config-tree-field-${field.key}`}
                  className="cursor-pointer truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {field.label}
                </Label>
              </motion.div>
            ))}
          </div>
        )}
      </HoverRail>
    </div>
  );
}
