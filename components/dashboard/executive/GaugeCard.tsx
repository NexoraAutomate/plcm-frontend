'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsType } from 'echarts';
import { DashboardCard } from './DashboardCard';
import type { ExecGaugeMetric } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/** Typography + ring thickness scale with chart diameter. */
function scaleForChartSize(sizePx: number) {
  const size = Math.max(sizePx, 1);
  return {
    value: Math.min(28, Math.max(11, size * 0.22)),
    unit: Math.min(12, Math.max(7, size * 0.09)),
    gap: Math.min(6, Math.max(2, size * 0.03)),
    ring: Math.min(16, Math.max(5, Math.round(size * 0.08))),
  };
}

/** Shrink font until `text` fits on one line inside the element width. */
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

interface GaugeCardProps {
  metric: ExecGaugeMetric;
  className?: string;
  onClick?: () => void;
}

export function GaugeCard({ metric, className, onClick }: GaugeCardProps) {
  const { exec } = useExecTheme();
  const available = metric.available !== false;
  const chartHostRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const [scale, setScale] = useState(() => scaleForChartSize(140));

  const topText = metric.eyebrow ?? metric.label;
  const bottomText = metric.eyebrow ? metric.label : (metric.subtitle ?? '');

  const fitTop = useFitOneLine(topText, metric.eyebrow ? 11 : 14, 8);
  const fitBottom = useFitOneLine(bottomText, metric.eyebrow ? 14 : 11, 7);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;

    const resize = (width: number, height: number) => {
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

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      resize(width, height);
    });
    ro.observe(host);
    resize(host.clientWidth, host.clientHeight);
    return () => ro.disconnect();
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
          max: Math.max(metric.max || 1, 0.001),
          radius: '88%',
          center: ['50%', '50%'],
          silent: true,
          progress: {
            show: available && metric.value > 0,
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
          data: [{ value: available ? metric.value : 0 }],
        },
      ],
    }),
    [available, exec.gaugeTrack, metric.color, metric.max, metric.value, scale.ring]
  );

  const trend = metric.trend;
  const trendPositive = trend ? (trend.positive ?? trend.direction === 'up') : true;
  const trendGlyph =
    trend?.direction === 'down' ? '▼' : trend?.direction === 'flat' ? '–' : '▲';
  const trendText = trend?.value.replace(/^[▲▼+\-\s]+/, '') ?? '';

  return (
    <DashboardCard
      className={className}
      title={metric.label}
      showHeader={false}
      onClick={onClick}
      noPadding
      insight={metric.insight}
    >
      <div className="shrink-0 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
        {metric.eyebrow ? (
          <>
            <p
              ref={fitTop.ref as React.RefObject<HTMLParagraphElement>}
              className="w-full overflow-hidden leading-tight text-[var(--exec-text-secondary)]"
              style={{ fontSize: fitTop.fontSize }}
            >
              {topText}
            </p>
            <h3
              ref={fitBottom.ref as React.RefObject<HTMLHeadingElement>}
              className="mt-0.5 w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
              style={{ fontSize: fitBottom.fontSize }}
            >
              {bottomText}
            </h3>
          </>
        ) : (
          <>
            <h3
              ref={fitTop.ref as React.RefObject<HTMLHeadingElement>}
              className="w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
              style={{ fontSize: fitTop.fontSize }}
            >
              {topText}
            </h3>
            {bottomText ? (
              <p
                ref={fitBottom.ref as React.RefObject<HTMLParagraphElement>}
                className="mt-0.5 w-full overflow-hidden leading-tight text-[var(--exec-text-secondary)]"
                style={{ fontSize: fitBottom.fontSize }}
              >
                {bottomText}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="@container-[size] flex min-h-0 flex-1 flex-col overflow-hidden px-1.5 pb-1.5">
        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden">
          <div
            ref={chartHostRef}
            className="relative aspect-square"
            style={{
              width: 'min(100%, 100cqw, calc(100cqh - 2rem))',
              maxHeight: '100%',
            }}
          >
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
            <div className="pointer-events-none absolute inset-[14%] flex flex-col items-center justify-center overflow-hidden px-0.5">
              <span
                className="max-w-full truncate text-center font-bold leading-none tracking-tight"
                style={{
                  color: available ? EXEC.text : EXEC.muted,
                  fontSize: scale.value,
                }}
              >
                {metric.displayValue}
              </span>
              {metric.unit ? (
                <span
                  className="max-w-full truncate text-center font-medium leading-none text-[var(--exec-text-secondary)]"
                  style={{ fontSize: scale.unit, marginTop: scale.gap }}
                >
                  {metric.unit}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-0.5 flex h-[1.85rem] shrink-0 flex-col items-center justify-center overflow-hidden text-center sm:h-8">
          {trend ? (
            <>
              <p
                className="inline-flex max-w-full items-center gap-0.5 font-semibold leading-none sm:gap-1"
                style={{
                  color: trendPositive ? EXEC.success : EXEC.danger,
                  fontSize: 'clamp(0.625rem, 2.4cqi, 0.8125rem)',
                }}
              >
                <span className="shrink-0 text-[9px] leading-none sm:text-[10px]" aria-hidden>
                  {trendGlyph}
                </span>
                <span className="truncate">{trendText}</span>
              </p>
              <p className="mt-0.5 truncate text-[9px] leading-tight text-[var(--exec-muted)] sm:mt-1 sm:text-[10px]">
                vs last month
              </p>
            </>
          ) : (
            <p className="truncate text-[9px] leading-tight text-[#6B7280] sm:text-[10px]">
              vs last month
            </p>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
