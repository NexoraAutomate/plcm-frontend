'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardCard } from './DashboardCard';
import type { ExecConfigChangeRow, ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';
import { useAppDefinitions } from '@/lib/app-definitions-context';

/** ~4.5 bars visible; scroll reveals the rest. */
const VISIBLE_ROWS = 4.5;

const HIERARCHY_FILTER_KEYS = ['system', 'subsystem', 'module', 'unit'] as const;
type HierarchyKey = (typeof HIERARCHY_FILTER_KEYS)[number];

function statusStyle(status: string): { color: string; bg: string; pill: boolean } {
  const s = status.toLowerCase();
  if (s.includes('approv') || s.includes('resolved') || s.includes('closed')) {
    return { color: '#FFFFFF', bg: EXEC.success, pill: true };
  }
  if (s.includes('pend') || s.includes('review')) {
    return { color: EXEC.orange, bg: 'transparent', pill: false };
  }
  if (s.includes('reject') || s.includes('fail')) {
    return { color: EXEC.danger, bg: `${EXEC.danger}22`, pill: true };
  }
  return { color: EXEC.cyan, bg: `${EXEC.cyan}22`, pill: true };
}

function useFitOneLine(text: string, maxPx: number, minPx: number) {
  const ref = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(maxPx);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      el.style.whiteSpace = 'nowrap';
      while (size > minPx && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };

    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxPx, minPx]);

  return { ref, fontSize };
}

function scaleForCard(sizePx: number) {
  const size = Math.max(sizePx, 1);
  return {
    section: Math.min(12, Math.max(9, size * 0.055)),
    sectionSub: Math.min(10, Math.max(7, size * 0.042)),
    name: Math.min(12, Math.max(8, size * 0.05)),
    value: Math.min(12, Math.max(9, size * 0.05)),
    valueCol: Math.min(28, Math.max(18, size * 0.12)),
    axis: Math.min(10, Math.max(7, size * 0.04)),
    tableHead: Math.min(10, Math.max(7, size * 0.04)),
    tableCell: Math.min(11, Math.max(8, size * 0.045)),
    padX: Math.min(12, Math.max(6, size * 0.045)),
    gap: Math.min(12, Math.max(6, size * 0.04)),
    btn: Math.min(11, Math.max(8, size * 0.045)),
    btnPadX: Math.min(10, Math.max(6, size * 0.035)),
    btnPadY: Math.min(5, Math.max(3, size * 0.018)),
  };
}

interface ConfigSplitCardProps {
  components: ExecNamedValue[];
  rows: ExecConfigChangeRow[];
  className?: string;
  insight?: ExecInsight;
}

export function ConfigSplitCard({ components, rows, className, insight }: ConfigSplitCardProps) {
  const { entityLabel } = useAppDefinitions();
  const HIERARCHY_FILTERS = useMemo(
    () =>
      HIERARCHY_FILTER_KEYS.map((key) => ({
        key,
        label: entityLabel(key),
      })),
    [entityLabel]
  );

  const availableTypes = useMemo(() => {
    const set = new Set(
      components.map((c) => (c.category || '').toLowerCase()).filter(Boolean)
    );
    return set;
  }, [components]);

  const defaultType = useMemo<HierarchyKey>(() => {
    if (availableTypes.has('module')) return 'module';
    const first = HIERARCHY_FILTERS.find((f) => availableTypes.has(f.key));
    return first?.key ?? 'module';
  }, [availableTypes, HIERARCHY_FILTERS]);

  const [entityFilter, setEntityFilter] = useState<HierarchyKey>(defaultType);

  useEffect(() => {
    setEntityFilter(defaultType);
  }, [defaultType]);

  const filterMeta = HIERARCHY_FILTERS.find((f) => f.key === entityFilter) ?? HIERARCHY_FILTERS[2];

  const sorted = useMemo(
    () =>
      [...components]
        .filter((c) => (c.category || '').toLowerCase() === entityFilter)
        .sort((a, b) => b.value - a.value),
    [components, entityFilter]
  );

  const filteredRows = useMemo(
    () => rows.filter((r) => (r.category || '').toLowerCase() === entityFilter),
    [rows, entityFilter]
  );

  const maxCount = useMemo(() => {
    const peak = sorted.reduce((m, d) => Math.max(m, d.value), 0);
    if (peak <= 0) return 10;
    return Math.max(10, Math.ceil(peak / 5) * 5);
  }, [sorted]);

  const ticks = useMemo(() => {
    const step = maxCount / 6;
    return Array.from({ length: 7 }, (_, i) => Math.round(i * step));
  }, [maxCount]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(220);
  const [listHeight, setListHeight] = useState(140);

  const titleFit = useFitOneLine('Configuration Changes', 14, 8);
  const scale = useMemo(() => scaleForCard(cardSize), [cardSize]);

  const rowHeight = Math.max(26, Math.min(48, listHeight / VISIBLE_ROWS));
  const nameSize = Math.min(scale.name, Math.max(8, rowHeight * 0.34));
  const barHeight = Math.min(14, Math.max(6, rowHeight * 0.36));
  const rowGap = Math.max(3, rowHeight * 0.12);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observers: ResizeObserver[] = [];

    if (bodyRef.current) {
      const el = bodyRef.current;
      const update = () => {
        const basis = Math.min(el.clientWidth, el.clientHeight);
        if (basis > 0) setCardSize(basis);
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers.push(ro);
    }

    if (listRef.current) {
      const el = listRef.current;
      const update = () => {
        if (el.clientHeight > 0) setListHeight(el.clientHeight);
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers.push(ro);
    }

    return () => observers.forEach((ro) => ro.disconnect());
  }, []);

  return (
    <DashboardCard
      className={className}
      title="Configuration Changes"
      showHeader={false}
      noPadding
      insight={insight}
    >
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-1 sm:px-3 sm:pt-2.5 sm:pb-1.5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3
              ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
              className="min-w-0 flex-1 overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
              style={{ fontSize: titleFit.fontSize }}
            >
              Configuration Changes
            </h3>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {HIERARCHY_FILTERS.map((f) => {
                const active = entityFilter === f.key;
                const hasData = availableTypes.has(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    disabled={!hasData && !active}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEntityFilter(f.key);
                    }}
                    className="rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                    style={{
                      fontSize: scale.btn,
                      paddingLeft: scale.btnPadX,
                      paddingRight: scale.btnPadX,
                      paddingTop: scale.btnPadY,
                      paddingBottom: scale.btnPadY,
                      borderColor: active ? EXEC.purple : EXEC.border,
                      backgroundColor: active ? `${EXEC.purple}33` : 'transparent',
                      color: active ? EXEC.text : EXEC.muted,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 overflow-hidden pb-2"
          style={{
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)',
            gap: scale.gap,
            paddingLeft: scale.padX,
            paddingRight: scale.padX,
          }}
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <p
              className="shrink-0 font-semibold leading-tight text-[var(--exec-text)]"
              style={{ fontSize: scale.section }}
            >
              Top Modified {filterMeta.label}s
            </p>
            <p
              className="mt-0.5 shrink-0 leading-tight text-[var(--exec-muted)]"
              style={{ fontSize: scale.sectionSub }}
            >
              by Change Count · {filterMeta.label} types
            </p>

            <div
              ref={listRef}
              className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] [scrollbar-color:var(--exec-scrollbar)_transparent]"
              onWheel={(e) => e.stopPropagation()}
            >
              {sorted.length ? (
                <div className="flex flex-col" style={{ gap: rowGap }}>
                  {sorted.map((item) => {
                    const widthPct = Math.max(6, Math.min(100, (item.value / maxCount) * 100));
                    return (
                      <div
                        key={`${entityFilter}-${item.name}`}
                        className="flex w-full shrink-0 flex-col justify-center"
                        style={{ height: rowHeight }}
                      >
                        <p
                          className="truncate font-medium leading-tight text-[var(--exec-text)]"
                          style={{ fontSize: nameSize }}
                          title={item.name}
                        >
                          {item.name}
                        </p>
                        <div
                          className="flex items-center"
                          style={{ gap: 6, marginTop: rowHeight * 0.08 }}
                        >
                          <div
                            className="min-w-0 flex-1 rounded-sm bg-[#1A1A1A]"
                            style={{ height: barHeight }}
                          >
                            <div
                              className="h-full rounded-sm"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: EXEC.purple,
                              }}
                            />
                          </div>
                          <span
                            className="shrink-0 text-right font-semibold tabular-nums text-[var(--exec-text)]"
                            style={{
                              fontSize: scale.value,
                              width: scale.valueCol,
                            }}
                          >
                            {Math.round(item.value)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p
                  className="flex h-full items-center justify-center text-[var(--exec-muted)]"
                  style={{ fontSize: scale.name }}
                >
                  No {filterMeta.label.toLowerCase()} replacements yet
                </p>
              )}
            </div>

            <div className="mt-1 shrink-0 border-t border-[var(--exec-border)] pt-1">
              <div className="flex justify-between px-0.5">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="tabular-nums text-[var(--exec-muted)]"
                    style={{ fontSize: scale.axis }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <p
              className="mb-1.5 shrink-0 font-semibold leading-tight text-[var(--exec-text)]"
              style={{ fontSize: scale.section }}
            >
              Recent Changes
            </p>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--exec-border)] [scrollbar-width:thin] [scrollbar-color:var(--exec-scrollbar)_transparent]">
              <table className="w-full text-left" style={{ fontSize: scale.tableCell }}>
                <thead
                  className="sticky top-0 bg-[var(--exec-elevated)] uppercase tracking-wide text-[var(--exec-muted)]"
                  style={{ fontSize: scale.tableHead }}
                >
                  <tr>
                    <th className="px-1.5 py-1.5 font-medium">{filterMeta.label}</th>
                    <th className="px-1.5 py-1.5 font-medium">Reason</th>
                    <th className="px-1.5 py-1.5 font-medium">Status</th>
                    <th className="px-1.5 py-1.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const st = statusStyle(row.status);
                    return (
                      <tr key={row.id} className="border-t border-[var(--exec-border)]">
                        <td className="max-w-22 truncate px-1.5 py-1.5 font-medium text-[var(--exec-text)]">
                          {row.partNumber}
                        </td>
                        <td className="max-w-24 truncate px-1.5 py-1.5 text-[var(--exec-muted)]">
                          {row.reason}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <span
                            className={
                              st.pill
                                ? 'inline-flex rounded-full px-1.5 py-0.5 font-medium'
                                : 'font-medium'
                            }
                            style={{
                              color: st.color,
                              backgroundColor: st.pill ? st.bg : undefined,
                              fontSize: Math.max(7, scale.tableCell - 1),
                            }}
                          >
                            {row.status || '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1.5 text-[var(--exec-muted)]">
                          {row.date}
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-8 text-center text-[var(--exec-muted)]">
                        No recent {filterMeta.label.toLowerCase()} changes
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

export function RecentChangesTable({ rows }: { rows: ExecConfigChangeRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--exec-border)]">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[var(--exec-elevated)] text-[10px] uppercase tracking-wide text-[var(--exec-muted)]">
          <tr>
            <th className="px-2 py-1.5 font-medium">Entity</th>
            <th className="px-2 py-1.5 font-medium">Reason</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row) => {
            const st = statusStyle(row.status);
            return (
              <tr key={row.id} className="border-t border-[var(--exec-border)]">
                <td className="px-2 py-1.5 font-medium text-[var(--exec-text)]">{row.partNumber}</td>
                <td className="px-2 py-1.5 text-[var(--exec-muted)]">{row.reason}</td>
                <td className="px-2 py-1.5">
                  <span style={{ color: st.color }}>{row.status}</span>
                </td>
                <td className="px-2 py-1.5 text-[var(--exec-muted)]">{row.date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
