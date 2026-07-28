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
}

function InsightBody({ insight, title }: { insight: ExecInsight; title?: string }) {
  return (
    <div className="max-w-[280px] space-y-2 text-left">
      {title ? <p className="text-[12px] font-semibold leading-snug text-white">{title}</p> : null}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#A78BFA]">Calculation</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#E5E7EB]">{insight.calculation}</p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-[#34D399]">
          Decision value
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#E5E7EB]">{insight.benefit}</p>
      </div>
    </div>
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
}: DashboardCardProps) {
  const card = (
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
        'group relative flex h-full min-h-0 flex-col overflow-hidden border shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(139,92,246,0.18)] hover:border-[#8B5CF6]/40',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        background: gradient
          ? 'linear-gradient(145deg, #6D28D9 0%, #8B5CF6 45%, #5B21B6 100%)'
          : EXEC.card,
        borderColor: gradient ? 'transparent' : EXEC.border,
        borderRadius: EXEC.radius,
      }}
    >
      {(title || headerRight) && (
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
                  'flex items-center gap-1 truncate text-[14px] font-semibold leading-tight',
                  gradient ? 'text-white' : 'text-[#F5F5F5]'
                )}
              >
                <span className="truncate">{title}</span>
                {insight ? (
                  <Info
                    className={cn(
                      'h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100',
                      gradient ? 'text-white' : 'text-[#9CA3AF]'
                    )}
                    aria-hidden
                  />
                ) : null}
              </h3>
            ) : null}
            {subtitle ? (
              <p
                className={cn(
                  'mt-0.5 text-[11px] uppercase tracking-wide',
                  gradient ? 'text-white/70' : 'text-[#9CA3AF]'
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {headerRight}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', noPadding ? '' : 'px-3 pb-2.5')}>{children}</div>
    </motion.div>
  );

  if (!insight) return card;

  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="z-[80] border border-[#3F3F46] bg-[#18181B] px-3 py-2.5 text-white shadow-xl"
      >
        <InsightBody insight={insight} title={title} />
      </TooltipContent>
    </Tooltip>
  );
}
