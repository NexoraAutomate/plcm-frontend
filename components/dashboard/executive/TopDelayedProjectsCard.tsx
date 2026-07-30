'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';

/** Aim for ~4.5 rows visible so the 5th peeks and signals scroll. */
const VISIBLE_ROWS = 4.5;

interface TopDelayedProjectsCardProps {
  data: ExecNamedValue[];
  className?: string;
  insight?: ExecInsight;
  onBarClick?: (item: ExecNamedValue) => void;
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
    subtitle: Math.min(11, Math.max(8, size * 0.05)),
    name: Math.min(12, Math.max(9, size * 0.055)),
    days: Math.min(12, Math.max(9, size * 0.055)),
    daysCol: Math.min(32, Math.max(22, size * 0.14)),
    axis: Math.min(10, Math.max(7, size * 0.042)),
    gap: Math.min(8, Math.max(4, size * 0.03)),
  };
}

export function TopDelayedProjectsCard({
  data,
  className,
  insight,
  onBarClick,
}: TopDelayedProjectsCardProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data]
  );

  const maxDays = useMemo(() => {
    const peak = sorted.reduce((m, d) => Math.max(m, d.value), 0);
    if (peak <= 0) return 50;
    return Math.max(50, Math.ceil(peak / 10) * 10);
  }, [sorted]);

  const ticks = useMemo(() => {
    const step = maxDays / 5;
    return Array.from({ length: 6 }, (_, i) => Math.round(i * step));
  }, [maxDays]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(180);
  const [listHeight, setListHeight] = useState(140);

  const titleFit = useFitOneLine('Top Delayed Projects', 14, 8);
  const scale = useMemo(() => scaleForCard(cardSize), [cardSize]);

  // Row height so ~4–5 bars fill the visible list area
  const rowHeight = Math.max(28, Math.min(52, listHeight / VISIBLE_ROWS));
  const nameSize = Math.min(scale.name, Math.max(8, rowHeight * 0.32));
  const barHeight = Math.min(12, Math.max(5, rowHeight * 0.28));
  const rowGap = Math.min(scale.gap, Math.max(2, rowHeight * 0.12));

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
      title="Top Delayed Projects"
      showHeader={false}
      insight={insight}
      noPadding
    >
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-1.5 sm:px-3 sm:pt-2.5 sm:pb-2">
          <h3
            ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[#F5F5F5]"
            style={{ fontSize: titleFit.fontSize }}
          >
            Top Delayed Projects
          </h3>
          <p
            className="mt-0.5 leading-tight text-[#D1D5DB]"
            style={{ fontSize: scale.subtitle }}
          >
            by Days Overdue
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2 pt-1 sm:px-3">
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] [scrollbar-color:#3F3F46_transparent]"
            style={{ gap: rowGap }}
            onWheel={(e) => e.stopPropagation()}
          >
            {sorted.length ? (
              <div className="flex flex-col" style={{ gap: rowGap }}>
                {sorted.map((item) => {
                  const widthPct = Math.max(4, Math.min(100, (item.value / maxDays) * 100));
                  return (
                    <button
                      key={item.id ?? item.name}
                      type="button"
                      className="flex w-full shrink-0 flex-col justify-center text-left"
                      style={{ height: rowHeight }}
                      onClick={() => onBarClick?.(item)}
                    >
                      <p
                        className="truncate font-medium leading-tight text-[#F5F5F5]"
                        style={{ fontSize: nameSize }}
                      >
                        {item.name}
                      </p>
                      <div
                        className="flex items-center"
                        style={{ gap: Math.max(4, scale.gap * 0.7), marginTop: rowHeight * 0.06 }}
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
                          className="shrink-0 text-right font-semibold tabular-nums text-[#EF4444]"
                          style={{
                            fontSize: scale.days,
                            width: scale.daysCol,
                          }}
                        >
                          {Math.round(item.value)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p
                className="flex h-full items-center justify-center text-[#9CA3AF]"
                style={{ fontSize: scale.name }}
              >
                No delayed projects
              </p>
            )}
          </div>

          <div className="mt-1 shrink-0 border-t border-[#242424] pt-1">
            <div className="flex justify-between px-0.5">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="tabular-nums text-[#9CA3AF]"
                  style={{ fontSize: scale.axis }}
                >
                  {t}
                </span>
              ))}
            </div>
            <p
              className="mt-0.5 text-center uppercase tracking-wide text-[#9CA3AF]"
              style={{ fontSize: scale.axis }}
            >
              Days
            </p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
