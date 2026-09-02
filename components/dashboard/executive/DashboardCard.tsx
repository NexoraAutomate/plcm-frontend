'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExecInsight } from './types';
import { EXEC } from './theme';

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  gradient?: boolean;
  noPadding?: boolean;
  onClick?: () => void;
  insight?: ExecInsight;
  /** Square corners (no border radius). */
  square?: boolean;
  /** When false, `title` is kept for insight tooltip only (no header row). */
  showHeader?: boolean;
}

function InsightBody({ insight, title }: { insight: ExecInsight; title?: string }) {
  return (
    <div className="max-w-70 space-y-2 text-left">
      {title ? (
        <p className="text-[12px] font-semibold leading-snug text-popover-foreground">{title}</p>
      ) : null}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#A78BFA]">Calculation</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{insight.calculation}</p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#34D399]">
          Decision value
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{insight.benefit}</p>
      </div>
    </div>
  );
}

function InsightTrigger({
  insight,
  title,
  gradient,
  className,
}: {
  insight: ExecInsight;
  title?: string;
  gradient?: boolean;
  className?: string;
}) {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded p-0.5 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none',
            className
          )}
          aria-label={title ? `About ${title}` : 'About this metric'}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Info
            className={cn('h-3 w-3', gradient ? 'text-white' : 'text-[var(--exec-muted)]')}
            aria-hidden
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="z-[80] border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl"
      >
        <InsightBody insight={insight} title={title} />
      </TooltipContent>
    </Tooltip>
  );
}

export function DashboardCard({
  children,
  className,
  title,
  subtitle,
  headerRight,
  gradient = false,
  noPadding = false,
  onClick,
  insight,
  square = false,
  showHeader = true,
}: DashboardCardProps) {
  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'group relative flex h-full min-h-0 flex-col overflow-hidden border shadow-[var(--exec-card-shadow)] transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(139,92,246,0.18)] hover:border-[#8B5CF6]/40',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        background: gradient
          ? 'linear-gradient(145deg, #6D28D9 0%, #8B5CF6 45%, #5B21B6 100%)'
          : EXEC.card,
        borderColor: gradient ? 'transparent' : EXEC.border,
        borderRadius: square ? 0 : EXEC.radius,
      }}
    >
      {(title || headerRight) && showHeader !== false && (
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-2 px-3 pt-2.5 pb-1',
            gradient && 'text-white'
          )}
        >
          <div className="min-w-0">
            {title ? (
              <h3
                className={cn(
                  'flex items-center gap-1 text-[14px] font-semibold leading-tight',
                  gradient ? 'text-white' : 'text-[var(--exec-text)]'
                )}
              >
                <span className="truncate">{title}</span>
                {insight ? <InsightTrigger insight={insight} title={title} gradient={gradient} /> : null}
              </h3>
            ) : null}
            {subtitle ? (
              <p
                className={cn(
                  'mt-0.5 text-[11px] leading-tight',
                  gradient ? 'text-white/70' : 'text-[var(--exec-text-secondary)]'
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {headerRight}
        </div>
      )}

      {insight && showHeader === false ? (
        <InsightTrigger
          insight={insight}
          title={title}
          className="absolute top-2 right-2 z-20 opacity-40 group-hover:opacity-90"
        />
      ) : null}

      <div
        className={cn(
          'min-h-0 flex-1',
          noPadding ? 'flex flex-col overflow-hidden' : 'px-3 pb-2.5'
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
