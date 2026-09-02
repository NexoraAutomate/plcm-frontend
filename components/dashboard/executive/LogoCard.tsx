'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { DashboardCard } from './DashboardCard';

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

export function LogoCard({ className }: { className?: string }) {
  const titleFit = useFitOneLine('PLCM Executive Dashboard', 13, 7);
  const subFit = useFitOneLine('Product Lifecycle Management', 10, 6);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [iconSize, setIconSize] = useState(40);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const h = el.clientHeight;
      setIconSize(Math.min(40, Math.max(24, Math.round(h * 0.55))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <DashboardCard className={className} noPadding>
      <div
        ref={bodyRef}
        className="flex h-full min-h-0 items-center gap-2 overflow-hidden px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2"
      >
        <div
          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--exec-border)] bg-[var(--exec-elevated)]"
          style={{ width: iconSize, height: iconSize }}
        >
          <Image
            src="/icon.svg"
            alt="PLCM"
            width={Math.round(iconSize * 0.7)}
            height={Math.round(iconSize * 0.7)}
            className="opacity-90"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            ref={titleFit.ref as React.RefObject<HTMLParagraphElement>}
            className="w-full overflow-hidden font-semibold leading-tight text-[var(--exec-text)]"
            style={{ fontSize: titleFit.fontSize }}
          >
            PLCM Executive Dashboard
          </p>
          <p
            ref={subFit.ref as React.RefObject<HTMLParagraphElement>}
            className="mt-0.5 w-full overflow-hidden uppercase tracking-wider text-[var(--exec-muted)]"
            style={{ fontSize: subFit.fontSize }}
          >
            Product Lifecycle Management
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}
