'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
                  'truncate text-[14px] font-semibold leading-tight',
                  gradient ? 'text-white' : 'text-[#F5F5F5]'
                )}
              >
                {title}
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
}
