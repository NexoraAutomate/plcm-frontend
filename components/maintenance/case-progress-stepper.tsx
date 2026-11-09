'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
import {
  BadgeCheck,
  Check,
  FileSearch,
  Package,
  PackageCheck,
  Send,
  Truck,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CASE_WORKFLOW_ORDER,
  CASE_STATUS_META,
  MaintenanceCaseWorkflowStatus,
  mapCaseStatusFromApi,
} from '@/lib/maintenance-workflow';

/** Display spine for Track A (includes ME / reserve gates). */
export const TRACK_A_STEPPER_STEPS = [
  'replacement_requested',
  'pd_approved',
  'me_allocated',
  'inventory_reserved',
  'im_issued',
  'shipped',
  'ait',
  'patch_delivered',
] as const;

export type TrackAStepperStep = (typeof TRACK_A_STEPPER_STEPS)[number];

/** Case workflow after Open — rendered as Track B under the Open hub. */
export const TRACK_B_STEPPER_STEPS = CASE_WORKFLOW_ORDER.filter(
  (s) => s !== MaintenanceCaseWorkflowStatus.OPEN
);

export type TrackAProgress = {
  status: string | null;
  assignedMeId?: number | null;
  hasReservation?: boolean;
};

type TrackAStepMeta = {
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
};

export const TRACK_A_STEP_META: Record<TrackAStepperStep, TrackAStepMeta> = {
  replacement_requested: {
    label: 'Replacement requested',
    shortLabel: 'Requested',
    icon: Send,
  },
  pd_approved: {
    label: 'PD approved',
    shortLabel: 'PD approved',
    icon: BadgeCheck,
  },
  me_allocated: {
    label: 'ME allocated',
    shortLabel: 'ME allocated',
    icon: UserRound,
  },
  inventory_reserved: {
    label: 'Inventory reserved',
    shortLabel: 'Reserved',
    icon: Warehouse,
  },
  im_issued: {
    label: 'IM issued inventory',
    shortLabel: 'IM issued',
    icon: Package,
  },
  shipped: {
    label: 'Shipped',
    shortLabel: 'Shipped',
    icon: Truck,
  },
  ait: {
    label: 'AIT',
    shortLabel: 'AIT',
    icon: FileSearch,
  },
  patch_delivered: {
    label: 'Patch delivered',
    shortLabel: 'Patch delivered',
    icon: PackageCheck,
  },
};

interface CaseProgressStepperProps {
  displayStatus: MaintenanceCaseWorkflowStatus;
  skipToClosed?: boolean;
  skipFromStatus?: string | null;
  trackAProgress?: TrackAProgress | null;
  trackAStatus?: string | null;
  className?: string;
}

const GRID_COLS = 1 + TRACK_A_STEPPER_STEPS.length;

function resolveSkipFromIndex(skipFromStatus?: string | null): number {
  if (!skipFromStatus) return 0;
  const mapped = mapCaseStatusFromApi(skipFromStatus);
  const idx = CASE_WORKFLOW_ORDER.indexOf(mapped);
  return idx >= 0 ? idx : 0;
}

function resolveTrackAStepIndex(progress?: TrackAProgress | null): number {
  const status = (progress?.status || '').trim().toLowerCase();
  if (!status) return -1;
  if (status === 'pd_rejected') return -1;

  const hasMe = progress?.assignedMeId != null;
  const hasReservation = Boolean(progress?.hasReservation);

  if (status === 'replacement_requested') return 0;
  if (status === 'pd_approved') {
    if (!hasMe) return 1;
    if (!hasReservation) return 2;
    return 3;
  }
  if (status === 'im_issue_pending' || status === 'ait_rejected') return 4;
  if (status === 'shipped_replaced_badge') return 5;
  if (status === 'ait_in_progress') return 6;
  if (
    status === 'ait_approved' ||
    status === 'patch_delivered' ||
    status === 'track_a_closed'
  ) {
    return 7;
  }
  return -1;
}

type Accent = 'hub' | 'track-a' | 'track-b';

type Pt = { x: number; y: number };

/**
 * Branch arc: leave Open vertically, arrive horizontally into the left side of the target node.
 */
function branchArcToLeft(from: Pt, toLeft: Pt) {
  return `M ${from.x} ${from.y} C ${from.x} ${toLeft.y}, ${from.x} ${toLeft.y}, ${toLeft.x} ${toLeft.y}`;
}

/**
 * Direct-close skip: leave Open at mid-right, run straight toward Closed,
 * then a true quarter-circle arc down onto the top of the Closed ring (no corner).
 */
function skipArcOpenToClosedTop(fromRight: Pt, toTop: Pt) {
  const dy = Math.max(toTop.y - fromRight.y, 12);
  const dx = Math.max(toTop.x - fromRight.x, 12);
  // Radius fits the vertical drop and available horizontal run.
  const r = Math.min(dy, dx * 0.85, Math.max(dy, 28));
  const arcStartX = toTop.x - r;
  // Horizontal to the arc entry, then SVG elliptical arc (quarter turn) onto Closed top.
  return `M ${fromRight.x} ${fromRight.y} L ${arcStartX} ${fromRight.y} A ${r} ${r} 0 0 1 ${toTop.x} ${toTop.y}`;
}

function StepGlyph({
  label,
  shortLabel,
  Icon,
  isCompleted,
  isCurrent,
  isFuture,
  isBypassed,
  showSkipArrow,
  accent = 'track-b',
  nodeRef,
}: {
  label: string;
  shortLabel?: string;
  Icon: ComponentType<{ className?: string }>;
  isCompleted: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isBypassed?: boolean;
  showSkipArrow?: boolean;
  accent?: Accent;
  nodeRef?: Ref<HTMLDivElement>;
}) {
  const completedRing =
    accent === 'track-a'
      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200'
      : 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950';
  const completedText =
    accent === 'track-a'
      ? 'text-sky-800 dark:text-sky-300'
      : 'text-emerald-700 dark:text-emerald-400';
  const currentRing =
    accent === 'track-a'
      ? 'border-sky-600 bg-sky-100/80 text-sky-800 dark:bg-sky-950 dark:text-sky-100'
      : 'border-primary bg-primary/15 text-primary';

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="relative z-10 flex h-10 w-10 items-center justify-center overflow-visible md:h-11 md:w-11 lg:h-12 lg:w-12">
        {showSkipArrow ? (
          <span
            className="absolute left-1/2 top-[4px] z-20 -translate-x-1/2 -translate-y-full text-primary"
            title="Skipped to Closed"
            aria-hidden
          >
            <svg width="10" height="8" viewBox="0 0 12 10" className="block">
              <path d="M6 10 L0 0 H12 Z" fill="currentColor" />
            </svg>
          </span>
        ) : null}
        {isCurrent ? (
          <span
            className={cn(
              'absolute h-8 w-8 animate-ping rounded-full [animation-duration:1.25s] md:h-9 md:w-9 lg:h-10 lg:w-10',
              accent === 'track-a' ? 'bg-sky-500/40' : 'bg-primary/45'
            )}
            aria-hidden
          />
        ) : null}
        <div
          ref={nodeRef}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background md:h-9 md:w-9 lg:h-10 lg:w-10',
            isCompleted && completedRing,
            isCurrent && currentRing,
            (isFuture || isBypassed) && 'border-muted bg-muted/40 text-muted-foreground',
            isBypassed && 'opacity-40'
          )}
        >
          {isCompleted ? (
            <Check className="h-4 w-4 md:h-[1.125rem] md:w-[1.125rem]" />
          ) : (
            <Icon className="h-4 w-4 md:h-[1.125rem] md:w-[1.125rem]" />
          )}
        </div>
      </div>

      <div
        className={cn(
          'mt-1.5 max-w-[5.5rem] px-0.5 md:max-w-[6.75rem] lg:max-w-[7.5rem]',
          (isFuture || isBypassed) && 'opacity-50'
        )}
      >
        <p
          className={cn(
            'text-[10px] font-medium leading-snug md:text-xs lg:text-[13px]',
            isCurrent && 'text-foreground',
            isCompleted && completedText,
            (isFuture || isBypassed) && 'text-muted-foreground',
            isBypassed && 'line-through'
          )}
          title={label}
        >
          <span className="md:hidden">{shortLabel || label}</span>
          <span className="hidden md:inline">{label}</span>
        </p>
        {isBypassed ? (
          <p className="mt-0.5 text-[9px] text-muted-foreground md:text-[10px]">Bypassed</p>
        ) : null}
      </div>
    </div>
  );
}

function RailConnector({
  done,
  accent,
}: {
  done: boolean;
  accent: 'track-a' | 'track-b';
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-[16px] h-0.5 md:left-[calc(50%+18px)] md:right-[calc(-50%+18px)] md:top-[18px] lg:left-[calc(50%+20px)] lg:right-[calc(-50%+20px)] lg:top-[20px]',
        accent === 'track-a'
          ? done
            ? 'bg-sky-500'
            : 'bg-sky-200/90 dark:bg-sky-900'
          : done
            ? 'bg-emerald-500'
            : 'bg-border'
      )}
      aria-hidden
    />
  );
}

function TrackCaption({
  label,
  accent,
  position,
}: {
  label: string;
  accent: 'track-a' | 'track-b';
  position: 'above' | 'below';
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        position === 'above' ? 'pb-0.5' : 'pt-0.5'
      )}
    >
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider md:text-xs',
          accent === 'track-a'
            ? 'text-sky-700 dark:text-sky-300'
            : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function CaseProgressStepper({
  displayStatus,
  skipToClosed = false,
  skipFromStatus = null,
  trackAProgress = null,
  trackAStatus = null,
  className,
}: CaseProgressStepperProps) {
  const currentIndex = CASE_WORKFLOW_ORDER.indexOf(displayStatus);
  const closedIndex = CASE_WORKFLOW_ORDER.indexOf(MaintenanceCaseWorkflowStatus.CLOSED);
  const skipFromIndex = useMemo(() => resolveSkipFromIndex(skipFromStatus), [skipFromStatus]);
  const showSkipArc =
    skipToClosed &&
    displayStatus === MaintenanceCaseWorkflowStatus.CLOSED &&
    skipFromIndex < closedIndex;

  const resolvedProgress = useMemo<TrackAProgress | null>(() => {
    if (trackAProgress?.status) return trackAProgress;
    if (trackAStatus) return { status: trackAStatus };
    return null;
  }, [trackAProgress, trackAStatus]);

  const normalizedTrackA = (resolvedProgress?.status || '').trim().toLowerCase() || null;
  const showTrackA = Boolean(normalizedTrackA);
  const trackARejected = normalizedTrackA === 'pd_rejected';
  const trackAStepIndex = useMemo(
    () => resolveTrackAStepIndex(resolvedProgress),
    [resolvedProgress]
  );
  const trackAComplete =
    !trackARejected &&
    trackAStepIndex >= TRACK_A_STEPPER_STEPS.length - 1 &&
    (normalizedTrackA === 'patch_delivered' ||
      normalizedTrackA === 'ait_approved' ||
      normalizedTrackA === 'track_a_closed');

  const openMeta = CASE_STATUS_META[MaintenanceCaseWorkflowStatus.OPEN];
  const OpenIcon = openMeta.icon;
  const openCompleted =
    currentIndex > 0 ||
    (showSkipArc && skipFromIndex === 0) ||
    displayStatus === MaintenanceCaseWorkflowStatus.CLOSED;
  const openCurrent = !showSkipArc && currentIndex === 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const openNodeRef = useRef<HTMLDivElement>(null);
  const trackA0Ref = useRef<HTMLDivElement>(null);
  const trackB0Ref = useRef<HTMLDivElement>(null);
  const closedNodeRef = useRef<HTMLDivElement>(null);
  const [arcs, setArcs] = useState<{
    toA: string | null;
    toB: string | null;
    skip: string | null;
    skipArrow: Pt | null;
    size: { w: number; h: number };
  }>({ toA: null, toB: null, skip: null, skipArrow: null, size: { w: 0, h: 0 } });

  const measureArcs = useCallback(() => {
    const root = rootRef.current;
    const openEl = openNodeRef.current;
    const b0 = trackB0Ref.current;
    if (!root || !openEl || !b0) return;

    const rootBox = root.getBoundingClientRect();
    const openBox = openEl.getBoundingClientRect();
    const b0Box = b0.getBoundingClientRect();

    const openCenter: Pt = {
      x: openBox.left - rootBox.left + openBox.width / 2,
      y: openBox.top - rootBox.top + openBox.height / 2,
    };
    // Leave from the Open ring (top / bottom), arrive on the target ring's left side.
    const openTop: Pt = {
      x: openCenter.x,
      y: openBox.top - rootBox.top + 1,
    };
    const openBottom: Pt = {
      x: openCenter.x,
      y: openBox.bottom - rootBox.top - 1,
    };
    const openRight: Pt = {
      x: openBox.right - rootBox.left - 1,
      y: openCenter.y,
    };

    const b0Left: Pt = {
      x: b0Box.left - rootBox.left + 1,
      y: b0Box.top - rootBox.top + b0Box.height / 2,
    };

    let toA: string | null = null;
    if (showTrackA && trackA0Ref.current) {
      const a0Box = trackA0Ref.current.getBoundingClientRect();
      const a0Left: Pt = {
        x: a0Box.left - rootBox.left + 1,
        y: a0Box.top - rootBox.top + a0Box.height / 2,
      };
      toA = branchArcToLeft(openTop, a0Left);
    }

    const toB = branchArcToLeft(openBottom, b0Left);

    let skip: string | null = null;
    let skipArrow: Pt | null = null;
    if (showSkipArc && closedNodeRef.current) {
      const closedBox = closedNodeRef.current.getBoundingClientRect();
      const closedTop: Pt = {
        x: closedBox.left - rootBox.left + closedBox.width / 2,
        y: closedBox.top - rootBox.top + 1,
      };
      skip = skipArcOpenToClosedTop(openRight, closedTop);
      skipArrow = closedTop;
    }

    setArcs({
      toA,
      toB,
      skip,
      skipArrow,
      size: { w: rootBox.width, h: rootBox.height },
    });
  }, [showTrackA, showSkipArc]);

  useEffect(() => {
    measureArcs();
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureArcs());
    ro.observe(root);
    window.addEventListener('resize', measureArcs);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureArcs);
    };
  }, [measureArcs, displayStatus, trackAStepIndex, showTrackA]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative w-full overflow-visible px-1 py-3 sm:px-2 md:py-4',
        showTrackA ? 'min-h-[16rem] md:min-h-[18rem]' : 'min-h-[11rem] md:min-h-[12.5rem]',
        className
      )}
    >
      {arcs.size.w > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
          width={arcs.size.w}
          height={arcs.size.h}
          aria-hidden
        >
          {arcs.toA ? (
            <path
              d={arcs.toA}
              fill="none"
              stroke="currentColor"
              className="text-sky-500"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          ) : null}
          {arcs.toB ? (
            <path
              d={arcs.toB}
              fill="none"
              stroke="currentColor"
              className="text-muted-foreground/50"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          ) : null}
          {arcs.skip ? (
            <g className="text-primary">
              <path
                d={arcs.skip}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              {arcs.skipArrow ? (
                <path
                  d={`M ${arcs.skipArrow.x} ${arcs.skipArrow.y + 1} L ${arcs.skipArrow.x - 5} ${arcs.skipArrow.y - 7} L ${arcs.skipArrow.x + 5} ${arcs.skipArrow.y - 7} Z`}
                  fill="currentColor"
                />
              ) : null}
            </g>
          ) : null}
        </svg>
      ) : null}

      <div
        className="relative z-[1] grid w-full gap-y-1 md:gap-y-2"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          // Track A caption → Track A nodes → Open → Track B nodes → Track B caption
          gridTemplateRows: showTrackA
            ? 'auto auto auto auto auto'
            : 'auto auto auto',
        }}
      >
        {showTrackA ? (
          <>
            <div
              className="col-span-full"
              style={{ gridColumn: `2 / -1`, gridRow: 1 }}
            >
              <TrackCaption label="Track A" accent="track-a" position="above" />
            </div>
            {TRACK_A_STEPPER_STEPS.map((step, index) => {
              const meta = TRACK_A_STEP_META[step];
              const isLast = index === TRACK_A_STEPPER_STEPS.length - 1;
              const isCompleted =
                !trackARejected &&
                trackAStepIndex >= 0 &&
                (index < trackAStepIndex || (trackAComplete && isLast));
              const isCurrent =
                !trackARejected &&
                !trackAComplete &&
                trackAStepIndex >= 0 &&
                index === trackAStepIndex;
              const isFuture = !isCompleted && !isCurrent;
              const connectorDone = !trackARejected && trackAStepIndex > index;

              return (
                <div
                  key={step}
                  className="relative flex flex-col items-center"
                  style={{ gridColumn: index + 2, gridRow: 2 }}
                >
                  {!isLast ? <RailConnector done={connectorDone} accent="track-a" /> : null}
                  <StepGlyph
                    label={meta.label}
                    shortLabel={meta.shortLabel}
                    Icon={meta.icon}
                    isCompleted={isCompleted}
                    isCurrent={isCurrent}
                    isFuture={isFuture}
                    accent="track-a"
                    nodeRef={index === 0 ? trackA0Ref : undefined}
                  />
                </div>
              );
            })}
          </>
        ) : null}

        <div
          className="relative flex flex-col items-center justify-center"
          style={{
            gridColumn: 1,
            gridRow: showTrackA ? 3 : 1,
          }}
        >
          <StepGlyph
            label={openMeta.label}
            shortLabel="Open"
            Icon={OpenIcon}
            isCompleted={openCompleted && !openCurrent}
            isCurrent={openCurrent}
            isFuture={!openCompleted && !openCurrent}
            accent="hub"
            nodeRef={openNodeRef}
          />
        </div>

        {TRACK_B_STEPPER_STEPS.map((step, index) => {
          const caseIndex = index + 1;
          const meta = CASE_STATUS_META[step];
          const isLast = index === TRACK_B_STEPPER_STEPS.length - 1;
          const isBypassed = showSkipArc && caseIndex > skipFromIndex && caseIndex < closedIndex;
          const isCompleted =
            !isBypassed &&
            (caseIndex < currentIndex || (showSkipArc && caseIndex === skipFromIndex));
          const isCurrent = !isBypassed && caseIndex === currentIndex;
          const isFuture = !isCompleted && !isCurrent && !isBypassed;
          const connectorDone =
            !isBypassed &&
            (caseIndex < currentIndex || (showSkipArc && caseIndex < skipFromIndex));
          const trackBRow = showTrackA ? 4 : 2;

          return (
            <div
              key={step}
              className="relative flex flex-col items-center"
              style={{
                gridColumn: index + 2,
                gridRow: trackBRow,
              }}
            >
              {!isLast ? (
                <RailConnector
                  done={
                    showSkipArc && caseIndex >= skipFromIndex && caseIndex < closedIndex
                      ? false
                      : connectorDone || isCompleted
                  }
                  accent="track-b"
                />
              ) : null}
              <StepGlyph
                label={meta.label}
                shortLabel={meta.label}
                Icon={meta.icon}
                isCompleted={isCompleted}
                isCurrent={isCurrent}
                isFuture={isFuture}
                isBypassed={isBypassed}
                accent="track-b"
                nodeRef={
                  index === 0
                    ? trackB0Ref
                    : isLast
                      ? closedNodeRef
                      : undefined
                }
              />
            </div>
          );
        })}

        <div
          className="col-span-full"
          style={{
            gridColumn: `2 / -1`,
            gridRow: showTrackA ? 5 : 3,
          }}
        >
          <TrackCaption label="Track B" accent="track-b" position="below" />
        </div>
      </div>
    </div>
  );
}
