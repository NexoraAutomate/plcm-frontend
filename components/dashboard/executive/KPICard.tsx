'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { AnimatedNumber } from './AnimatedNumber';
import type { ExecInsight, ExecTrend } from './types';
import { EXEC } from './theme';

interface KPICardProps {
  label: string;
  value: number;
  decimals?: number;
  accent?: string;
  trend?: ExecTrend;
  sparkline?: number[];
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
}

function TrendBadge({ trend }: { trend: ExecTrend }) {
  const Icon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : Minus;
  const positive = trend.positive ?? trend.direction === 'up';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium',
        positive ? 'text-[#4ADE80]' : 'text-[#EF4444]'
      )}
    >
      <Icon className="h-3 w-3" />
      {trend.value}
    </span>
  );
}

function formatTrendValue(value: string) {
  return value.replace(/^[▲▼+\-\s]+/, '').replace(/\s*vs last month\s*/i, '').trim();
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
    value: Math.min(40, Math.max(18, size * 0.22)),
    trend: Math.min(14, Math.max(9, size * 0.075)),
    vs: Math.min(11, Math.max(8, size * 0.055)),
    glyph: Math.min(11, Math.max(8, size * 0.05)),
    sparkH: Math.min(44, Math.max(22, size * 0.22)),
    stroke: Math.min(2.5, Math.max(1.25, size * 0.012)),
  };
}

function MiniSparkline({
  values,
  color,
  height,
  strokeWidth,
}: {
  values: number[];
  color: string;
  height: number;
  strokeWidth: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 36;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return { x, y };
  });
  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = [`0,${h}`, ...coords.map((p) => `${p.x},${p.y}`), `${w},${h}`].join(' ');
  const gradientId = `spark-fill-${color.replace('#', '')}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-auto w-full shrink-0"
      style={{
        height,
        filter: `drop-shadow(0 0 4px ${color}88)`,
      }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={areaPoints} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        points={linePoints}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KPICard({
  label,
  value,
  decimals = 0,
  accent = EXEC.purple,
  trend,
  sparkline,
  className,
  onClick,
  insight,
}: KPICardProps) {
  const positive = trend ? (trend.positive ?? trend.direction === 'up') : true;
  const trendGlyph =
    trend?.direction === 'down' ? '▼' : trend?.direction === 'flat' ? '–' : '▲';

  const bodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => scaleForCard(160));
  const titleFit = useFitOneLine(label, 14, 8);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const basis = Math.min(el.clientWidth, el.clientHeight);
      setScale(scaleForCard(basis));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <DashboardCard
      className={className}
      onClick={onClick}
      title={label}
      showHeader={false}
      noPadding
      insight={insight}
    >
      <div ref={bodyRef} className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pt-2 pb-0 sm:px-3 sm:pt-2.5">
          <h3
            ref={titleFit.ref as React.RefObject<HTMLHeadingElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
            style={{ fontSize: titleFit.fontSize }}
          >
            {label}
          </h3>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2 pt-1 sm:px-3 sm:pb-2.5">
          <div style={{ color: accent }}>
            <AnimatedNumber
              value={value}
              decimals={decimals}
              className="font-bold leading-none"
              style={{ fontSize: scale.value }}
            />
          </div>
          {trend ? (
            <div className="mt-1.5 shrink-0 sm:mt-2">
              <div
                className="inline-flex max-w-full items-center gap-0.5 font-semibold leading-none"
                style={{
                  color: positive ? EXEC.success : EXEC.danger,
                  fontSize: scale.trend,
                }}
              >
                <span style={{ fontSize: scale.glyph }} aria-hidden>
                  {trendGlyph}
                </span>
                <span className="whitespace-nowrap">{formatTrendValue(trend.value)}</span>
              </div>
              <p
                className="mt-0.5 whitespace-nowrap leading-tight text-[var(--exec-muted)] sm:mt-1"
                style={{ fontSize: scale.vs }}
              >
                vs last month
              </p>
            </div>
          ) : null}
          {sparkline?.length ? (
            <MiniSparkline
              values={sparkline}
              color={accent}
              height={scale.sparkH}
              strokeWidth={scale.stroke}
            />
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}

export { TrendBadge };
