'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsType } from 'echarts';
import { DashboardCard } from './DashboardCard';
import type { ExecGaugeMetric } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function scaleForChartSize(sizePx: number) {
  const size = Math.max(sizePx, 1);
  return {
    value: Math.min(32, Math.max(14, size * 0.24)),
    ring: Math.min(18, Math.max(6, Math.round(size * 0.09))),
    radius: size < 90 ? '86%' : size < 130 ? '90%' : '92%',
  };
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

interface ProgramHealthCardProps {
  metric: ExecGaugeMetric;
  className?: string;
}

export function ProgramHealthCard({ metric, className }: ProgramHealthCardProps) {
  const { exec } = useExecTheme();
  const available = metric.available !== false;
  const chartHostRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const [scale, setScale] = useState(() => scaleForChartSize(160));
  const [cardSize, setCardSize] = useState({ w: 220, h: 160 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleFit = useFitOneLine('Overall Program Health', 14, 8);

  const labelScale = Math.min(cardSize.w, cardSize.h);
  const trendSize = Math.min(16, Math.max(10, labelScale * 0.085));
  const vsSize = Math.min(12, Math.max(8, labelScale * 0.06));
  const trendGlyphSize = Math.min(12, Math.max(8, labelScale * 0.055));

  useEffect(() => {
    const body = bodyRef.current;
    const host = chartHostRef.current;
    if (typeof ResizeObserver === 'undefined') return;

    const onChartResize = (width: number, height: number) => {
      const diameter = Math.min(width, height);
      setScale(scaleForChartSize(diameter));
      requestAnimationFrame(() => {
        try {
          chartInstanceRef.current?.resize();
        } catch {
          /* chart may unmount mid-frame */
        }
      });
    };

    const observers: ResizeObserver[] = [];

    if (host) {
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        onChartResize(entry.contentRect.width, entry.contentRect.height);
      });
      ro.observe(host);
      onChartResize(host.clientWidth, host.clientHeight);
      observers.push(ro);
    }

    if (body) {
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setCardSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      });
      ro.observe(body);
      setCardSize({ w: body.clientWidth, h: body.clientHeight });
      observers.push(ro);
    }

    return () => observers.forEach((ro) => ro.disconnect());
  }, []);

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      animation: false,
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          radius: scale.radius,
          center: ['50%', '50%'],
          silent: true,
          progress: {
            show: available,
            width: scale.ring,
            roundCap: true,
            itemStyle: { color: metric.color },
          },
          axisLine: {
            lineStyle: {
              width: scale.ring,
              color: [[1, exec.gaugeTrack]],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: { show: false },
          data: [{ value: available ? Math.round(metric.value) : 0 }],
        },
      ],
    }),
    [available, exec.gaugeTrack, metric.color, metric.value, scale.radius, scale.ring]
  );

  const trend = metric.trend;
  const trendPositive = trend ? trend.positive !== false : true;
  const trendGlyph =
    trend?.direction === 'down' ? '▼' : trend?.direction === 'flat' ? '–' : '▲';
  const trendText = trend?.value.replace(/^[▲▼+\-\s]+/, '') ?? '';

  return (
    <DashboardCard
      className={className}
      title="Overall Program Health"
      showHeader={false}
      noPadding
      insight={metric.insight}
    >
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
          <h3
            ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
            style={{ fontSize: titleFit.fontSize }}
          >
            Overall Program Health
          </h3>
        </div>

        <div className="flex min-h-0 flex-1 items-center gap-1 overflow-hidden px-1.5 pb-2 pt-0">
          <div ref={chartHostRef} className="relative h-full min-h-0 min-w-0 flex-[1.35]">
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge
              lazyUpdate
              autoResize
              onChartReady={(instance: EChartsType) => {
                chartInstanceRef.current = instance;
                instance.resize();
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="max-w-[70%] truncate text-center font-bold leading-none tracking-tight"
                style={{
                  color: available ? EXEC.text : EXEC.muted,
                  fontSize: scale.value,
                }}
              >
                {metric.displayValue}
              </span>
            </div>
          </div>

          {trend ? (
            <div className="mr-1 flex shrink-0 flex-col items-start justify-center pr-0.5 sm:mr-2 sm:pr-1">
              <span
                className="inline-flex max-w-full items-center gap-0.5 font-semibold leading-none"
                style={{
                  color: trendPositive ? EXEC.success : EXEC.danger,
                  fontSize: trendSize,
                }}
              >
                <span style={{ fontSize: trendGlyphSize }} aria-hidden>
                  {trendGlyph}
                </span>
                <span className="truncate">{trendText}</span>
              </span>
              <span
                className="mt-1 max-w-full truncate leading-tight text-[var(--exec-muted)]"
                style={{ fontSize: vsSize }}
              >
                vs last month
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
