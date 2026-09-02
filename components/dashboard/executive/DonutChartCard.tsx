'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pie } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

interface DonutChartCardProps {
  title: string;
  data: ExecNamedValue[];
  colors?: string[];
  className?: string;
  onSliceClick?: (item: ExecNamedValue) => void;
  insight?: ExecInsight;
  legendPlacement?: 'bottom' | 'side';
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

function scaleForDonut(sizePx: number, side: boolean) {
  const size = Math.max(sizePx, 1);
  const radius = size < 100 ? 0.86 : size < 140 ? 0.9 : side ? 0.92 : 0.9;
  const ringNorm = Math.min(0.34, Math.max(0.16, size * 0.0018));
  return {
    radius,
    innerRadius: Math.max(0.45, radius - ringNorm),
    stroke: Math.min(3, Math.max(1, size * 0.012)),
    total: Math.min(28, Math.max(14, size * 0.16)),
    totalLabel: Math.min(11, Math.max(8, size * 0.06)),
    legend: Math.min(13, Math.max(9, size * 0.07)),
    legendValue: Math.min(13, Math.max(9, size * 0.07)),
    swatch: Math.min(10, Math.max(6, size * 0.05)),
    legendGap: Math.min(10, Math.max(4, size * 0.04)),
    bottomLegendFont: Math.min(11, Math.max(8, size * 0.055)),
  };
}

export function DonutChartCard({
  title,
  data,
  colors = [EXEC.success, EXEC.orange, EXEC.yellow, EXEC.cyan, EXEC.purple],
  className,
  onSliceClick,
  insight,
  legendPlacement = 'bottom',
}: DonutChartCardProps) {
  const { exec, chartTheme } = useExecTheme();
  const total = Math.round(data.reduce((s, d) => s + d.value, 0));
  const side = legendPlacement === 'side';
  const chartHostRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState({ w: 160, h: 150 });
  const titleFit = useFitOneLine(title, 14, 8);

  const chartSize = Math.min(host.w, host.h);
  const scale = useMemo(() => scaleForDonut(chartSize, side), [chartSize, side]);

  useEffect(() => {
    const el = chartHostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setHost({ w, h });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side]);

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((d, i) => {
      map.set(d.name, d.color ?? colors[i % colors.length]);
    });
    return map;
  }, [colors, data]);

  const pieHeight = Math.max(80, Math.floor(host.h));
  const pieWidth = Math.max(80, Math.floor(host.w));

  const config = useMemo(
    () =>
      ({
        data,
        angleField: 'value',
        colorField: 'name',
        innerRadius: scale.innerRadius,
        radius: scale.radius,
        width: pieWidth,
        height: pieHeight,
        autoFit: false,
        theme: chartTheme,
        legend: side
          ? false
          : {
              color: {
                position: 'bottom',
                itemMarker: 'circle',
                itemLabelFontSize: scale.bottomLegendFont,
                itemLabelFill: exec.muted,
                maxRows: 2,
              },
            },
        scale: {
          color: {
            domain: data.map((d) => d.name),
            range: data.map((d) => colorByName.get(d.name) ?? EXEC.purple),
          },
        },
        label: false,
        tooltip: true,
        style: { stroke: exec.card, lineWidth: scale.stroke },
        onReady: (plot: {
          on: (event: string, cb: (evt: { data?: { data?: ExecNamedValue } }) => void) => void;
        }) => {
          if (!onSliceClick) return;
          plot.on('element:click', (evt) => {
            const item = evt?.data?.data;
            if (item) onSliceClick(item);
          });
        },
      }) as Record<string, unknown>,
    [chartTheme, colorByName, data, exec.card, exec.muted, onSliceClick, pieHeight, pieWidth, scale, side]
  );

  const centerOverlay = (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="max-w-[70%] text-center">
        {side ? (
          <>
            <p
              className="font-medium uppercase tracking-wide text-[var(--exec-muted)]"
              style={{ fontSize: scale.totalLabel }}
            >
              Total
            </p>
            <p
              className="font-bold leading-none text-[var(--exec-text)]"
              style={{ fontSize: scale.total, marginTop: scale.totalLabel * 0.15 }}
            >
              {total}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold leading-none text-[var(--exec-text)]" style={{ fontSize: scale.total }}>
              {total}
            </p>
            <p
              className="mt-0.5 uppercase tracking-wide text-[var(--exec-muted)]"
              style={{ fontSize: scale.totalLabel }}
            >
              Total
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <DashboardCard
      className={className}
      title={title}
      showHeader={false}
      insight={insight}
      noPadding
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
          <h3
            ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
            style={{ fontSize: titleFit.fontSize }}
          >
            {title}
          </h3>
        </div>

        {side ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-stretch gap-1 overflow-hidden px-2 pb-2 pt-1">
            <div ref={chartHostRef} className="relative h-full min-h-[100px] min-w-0">
              {data.length ? (
                <div className="absolute inset-0 overflow-hidden">
                  <Pie {...config} />
                </div>
              ) : null}
              {centerOverlay}
            </div>
            <ul className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto pr-1">
              {data.map((item, i) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                const color = colorByName.get(item.name) ?? colors[i % colors.length];
                return (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-1.5 border-b border-[var(--exec-border)] last:border-b-0"
                    style={{
                      paddingTop: scale.legendGap * 0.55,
                      paddingBottom: scale.legendGap * 0.55,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                          width: scale.swatch,
                          height: scale.swatch,
                        }}
                        aria-hidden
                      />
                      <span className="truncate text-[var(--exec-text)]" style={{ fontSize: scale.legend }}>
                        {item.name}
                      </span>
                    </span>
                    <span
                      className="shrink-0 font-semibold tabular-nums text-[var(--exec-text)]"
                      style={{ fontSize: scale.legendValue }}
                    >
                      {Math.round(item.value)}{' '}
                      <span className="font-normal text-[var(--exec-muted)]">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div
            ref={chartHostRef}
            className="relative min-h-[120px] flex-1 overflow-hidden px-1 pb-2"
          >
            {data.length ? (
              <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden">
                <Pie {...config} />
              </div>
            ) : null}
            {centerOverlay}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
