'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, Pin, PinOff } from 'lucide-react';
import { ConfigEntityTypeTree } from '@/components/settings/config-tree/config-entity-type-tree';
import type { TemplateNameItem } from '@/lib/hierarchy-template-names';
import type { TemplateNodeLevel } from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

export const ENTITY_DND_MIME = 'application/plcm-config-entity';

export type EntityDragPayload = {
  level: TemplateNodeLevel;
  name: string;
  abbreviation: string;
  entityId: number;
};

const COLLAPSED_W = 44;
const EXPANDED_W = 288; // w-72
const SPRING = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.85 };

type Props = {
  entities: TemplateNameItem[];
  levelLabel: (level: string) => string;
  disabled?: boolean;
  /** Child level to enable when a canvas parent is selected. */
  focusChildLevel?: TemplateNodeLevel | null;
  /** Hide system folder when a system already exists. */
  hideSystemLevel?: boolean;
  contextLabel?: string;
};

export function ConfigTreeEntitySidebar({
  entities,
  levelLabel,
  disabled,
  focusChildLevel = null,
  hideSystemLevel,
  contextLabel,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = pinned || hovered || dragging;
  const hiddenLevels = hideSystemLevel ? (['system'] as TemplateNodeLevel[]) : undefined;

  useEffect(() => {
    if (!dragging) return;
    const end = () => setDragging(false);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, [dragging]);

  return (
    <motion.aside
      className={cn(
        'relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-r',
        'bg-gradient-to-br from-white/95 via-slate-50/90 to-teal-50/50',
        'backdrop-blur-xl dark:from-slate-950/95 dark:via-slate-900/90 dark:to-teal-950/40',
        'border-teal-500/15',
        disabled && 'pointer-events-none opacity-50'
      )}
      initial={false}
      animate={{ width: open ? EXPANDED_W : COLLAPSED_W }}
      transition={SPRING}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHovered(false);
        }
      }}
      aria-label="Entity list"
      aria-expanded={open}
    >
      {/* Collapsed rail cue — pin stays clickable */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex w-11 flex-col items-center gap-3 pt-3',
          'transition-opacity duration-200',
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
        aria-hidden={open}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300">
          <PanelLeft className="size-4" />
        </span>
        <span
          className="pointer-events-none text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800/70 dark:text-teal-200/80"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Entity list
        </span>
        <button
          type="button"
          title="Pin entity list open"
          aria-pressed={pinned}
          className={cn(
            'mt-auto mb-3 flex size-7 items-center justify-center rounded-md',
            'text-teal-700 transition-colors hover:bg-teal-500/15 dark:text-teal-300',
            pinned && 'bg-teal-500/20 text-teal-800 dark:text-teal-100'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setPinned(true);
          }}
        >
          <Pin className="size-3.5" />
        </button>
      </div>

      {/* Expanded content (always mounted so drag state stays warm) */}
      <div
        className={cn(
          'flex h-full w-72 flex-col transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <div className="flex items-start gap-2 border-b border-teal-500/10 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">Entity list</p>
            <p className="text-[11px] text-muted-foreground">
              {contextLabel ||
                'Select a node on the canvas, then drag entities onto it. The same entity can be added more than once.'}
            </p>
          </div>
          <button
            type="button"
            title={pinned ? 'Unpin entity list' : 'Pin entity list open'}
            aria-pressed={pinned}
            className={cn(
              'nodrag nopan mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
              'text-muted-foreground transition-colors hover:bg-teal-500/15 hover:text-teal-800',
              'dark:hover:text-teal-200',
              pinned && 'bg-teal-500/15 text-teal-700 dark:text-teal-200'
            )}
            onClick={() => setPinned((v) => !v)}
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </button>
        </div>
        <div className="min-h-0 flex-1 p-2">
          {!focusChildLevel ? (
            <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              {contextLabel ||
                (hideSystemLevel
                  ? 'Select a System, Subsystem, Module, or Unit on the canvas to add children.'
                  : 'Drag a System onto the canvas to start.')}
            </div>
          ) : (
            <ConfigEntityTypeTree
              className="h-full"
              entities={entities}
              levelLabel={levelLabel}
              selectableLevel={focusChildLevel}
              hiddenLevels={hiddenLevels}
              draggable
              defaultExpandedLevels={[focusChildLevel]}
              emptyHint={
                focusChildLevel === 'system'
                  ? 'Add a System first.'
                  : 'No entities in Entity List for this level.'
              }
              onDragStart={(event, item) => {
                setDragging(true);
                const payload: EntityDragPayload = {
                  level: item.level,
                  name: item.name,
                  abbreviation: item.abbreviation,
                  entityId: item.entityId,
                };
                const json = JSON.stringify(payload);
                event.dataTransfer.setData(ENTITY_DND_MIME, json);
                event.dataTransfer.setData('application/json', json);
                event.dataTransfer.setData('text/plain', item.name);
                event.dataTransfer.effectAllowed = 'copy';
              }}
            />
          )}
        </div>
      </div>
    </motion.aside>
  );
}
