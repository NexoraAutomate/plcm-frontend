'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecSeriesPoint } from './types';
import { EXEC } from './theme';

const SERIES = [
  { key: 'Projects Started', color: EXEC.purple, totalKey: 'started' as const, label: 'Started' },
  { key: 'Projects Completed', color: EXEC.cyan, totalKey: 'completed' as const, label: 'Completed' },
  { key: 'Delayed Projects', color: EXEC.orange, totalKey: 'delayed' as const, label: 'Delayed' },
] as const;

interface AreaChartCardProps {
  title?: string;
  data: ExecSeriesPoint[];
  totals?: { started: number; completed: number; delayed: number };
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
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

function scaleForArea(sizePx: number) {
  const size = Math.max(sizePx, 1);
  return {
    axis: Math.min(12, Math.max(8, size * 0.055)),
    legend: Math.min(12, Math.max(8, size * 0.05)),
    legendLine: Math.min(4, Math.max(2, size * 0.015)),
    legendW: Math.min(18, Math.max(10, size * 0.08)),
    totalLabel: Math.min(11, Math.max(8, size * 0.045)),
    totalValue: Math.min(24, Math.max(14, size * 0.12)),
    lineWidth: Math.min(2.5, Math.max(1.25, size * 0.01)),
    totalsCol: Math.min(72, Math.max(52, size * 0.32)),
  };
}

export function AreaChartCard({
  title = 'Portfolio Progress Trend',
  data,
  totals,
  className,
  onClick,
  insight,
}: AreaChartCardProps) {
  const chartHostRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState({ w: 420, h: 148 });
  const [cardSize, setCardSize] = useState(180);
  const titleFit = useFitOneLine(title, 14, 8);

  const scale = useMemo(
    () => scaleForArea(Math.min(host.w, host.h * 2.2, cardSize)),
    [cardSize, host.h, host.w]
  );

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observers: ResizeObserver[] = [];

    const chartEl = chartHostRef.current;
    if (chartEl) {
      const update = () => {
        const w = chartEl.clientWidth;
        const h = chartEl.clientHeight;
        if (w > 0 && h > 0) setHost({ w, h });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(chartEl);
      observers.push(ro);
    }

    const bodyEl = bodyRef.current;
    if (bodyEl) {
      const update = () => {
        const basis = Math.min(bodyEl.clientWidth, bodyEl.clientHeight);
        if (basis > 0) setCardSize(basis);
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(bodyEl);
      observers.push(ro);
    }

    return () => observers.forEach((ro) => ro.disconnect());
  }, []);

  const chartData = useMemo(() => {
    const rows: { month: string; value: number; type: string }[] = [];
    for (const row of data) {
      rows.push({
        month: String(row.month),
        value: Number(row.started ?? 0),
        type: 'Projects Started',
      });
      rows.push({
        month: String(row.month),
        value: Number(row.completed ?? 0),
        type: 'Projects Completed',
      });
      rows.push({
        month: String(row.month),
        value: Number(row.delayed ?? 0),
        type: 'Delayed Projects',
      });
    }
    return rows;
  }, [data]);

  const yMax = useMemo(() => {
    const peak = chartData.reduce((m, r) => Math.max(m, r.value), 0);
    if (peak <= 100) return 100;
    return Math.ceil(peak / 20) * 20;
  }, [chartData]);

  const chartHeight = Math.max(90, Math.floor(host.h));
  const chartWidth = Math.max(120, Math.floor(host.w));

  const config = useMemo(
    () =>
      ({
        data: chartData,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        seriesField: 'type',
        stack: false,
        width: chartWidth,
        height: chartHeight,
        autoFit: false,
        legend: false,
        theme: 'classicDark',
        shapeField: 'smooth',
        style: {
          fillOpacity: 0.22,
          lineWidth: scale.lineWidth,
        },
        scale: {
          color: {
            domain: SERIES.map((s) => s.key),
            range: SERIES.map((s) => s.color),
          },
          y: {
            domain: [0, yMax],
            nice: false,
          },
        },
        axis: {
          x: {
            labelFill: '#9CA3AF',
            labelFontSize: scale.axis,
            labelFontWeight: 500,
            line: false,
            tick: false,
            grid: null,
          },
          y: {
            labelFill: '#9CA3AF',
            labelFontSize: scale.axis,
            labelFontWeight: 500,
            grid: true,
            gridStroke: '#2A2A2A',
            gridStrokeOpacity: 1,
            gridLineWidth: 1,
            line: false,
            tick: false,
            tickCount: 6,
            labelFormatter: (v: number) => String(Math.round(Number(v))),
          },
        },
        tooltip: {
          title: (d: { month?: string }) => d?.month ?? '',
          items: [
            (datum: { type?: string; value?: number; color?: string }) => ({
              name: datum.type ?? '',
              value: String(Number(datum.value ?? 0)),
              color: datum.color,
            }),
          ],
        },
        interaction: {
          tooltip: {
            shared: true,
            series: true,
            crosshairs: true,
            marker: true,
          },
        },
      }) as Record<string, unknown>,
    [chartData, chartHeight, chartWidth, scale.axis, scale.lineWidth, yMax]
  );

  return (
    <DashboardCard
      className={className}
      title={title}
      showHeader={false}
      onClick={onClick}
      insight={insight}
      noPadding
    >
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
          <h3
            ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[#F5F5F5]"
            style={{ fontSize: titleFit.fontSize }}
          >
            {title}
          </h3>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2 pt-0.5 sm:px-3 sm:pb-2.5">
          <div
            className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4"
            style={{ fontSize: scale.legend }}
          >
            {SERIES.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-[#E5E7EB]"
              >
                <span
                  className="inline-block shrink-0 rounded-full"
                  style={{
                    backgroundColor: s.color,
                    width: scale.legendW,
                    height: scale.legendLine,
                  }}
                  aria-hidden
                />
                {s.key}
              </span>
            ))}
          </div>

          <div
            className="grid min-h-0 flex-1 gap-2"
            style={{
              gridTemplateColumns: totals
                ? `minmax(0,1fr) ${Math.round(scale.totalsCol)}px`
                : 'minmax(0,1fr)',
            }}
          >
            <div
              ref={chartHostRef}
              className="relative min-h-[100px] min-w-0 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {chartData.length ? (
                <div className="absolute inset-0 overflow-hidden">
                  <Area {...config} />
                </div>
              ) : null}
            </div>

            {totals ? (
              <div className="flex flex-col justify-center gap-2 border-l border-[#242424] pl-2 sm:gap-3 sm:pl-2.5">
                {SERIES.map((s) => (
                  <div key={s.totalKey} className="min-w-0">
                    <p
                      className="font-medium leading-none text-[#9CA3AF]"
                      style={{ fontSize: scale.totalLabel }}
                    >
                      {s.label}
                    </p>
                    <p
                      className="mt-0.5 font-bold leading-none tabular-nums tracking-tight sm:mt-1"
                      style={{ color: s.color, fontSize: scale.totalValue }}
                    >
                      {totals[s.totalKey]}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
