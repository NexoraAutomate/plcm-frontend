'use client';

import { type LucideIcon, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AccentColor = 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate' | 'emerald' | 'violet' | 'cyan';

interface ExecutiveKPICardProps {
  label: string;
  value: number;
  changePercent: number | null;
  icon: LucideIcon;
  accentColor?: AccentColor;
  isSelected?: boolean;
  onClick?: () => void;
}

const accentStyles: Record<AccentColor, string> = {
  blue: 'border-l-blue-500 dark:border-l-blue-400',
  green: 'border-l-emerald-500 dark:border-l-emerald-400',
  red: 'border-l-red-500 dark:border-l-red-400',
  amber: 'border-l-amber-500 dark:border-l-amber-400',
  orange: 'border-l-orange-500 dark:border-l-orange-400',
  slate: 'border-l-slate-500 dark:border-l-slate-400',
  emerald: 'border-l-emerald-500 dark:border-l-emerald-400',
  violet: 'border-l-violet-500 dark:border-l-violet-400',
  cyan: 'border-l-cyan-500 dark:border-l-cyan-400',
};

const glowStyles: Record<AccentColor, string> = {
  blue: 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20 scale-[1.02]',
  green: 'ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 scale-[1.02]',
  red: 'ring-2 ring-red-500/50 shadow-lg shadow-red-500/20 scale-[1.02]',
  amber: 'ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20 scale-[1.02]',
  orange: 'ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20 scale-[1.02]',
  slate: 'ring-2 ring-slate-500/50 shadow-lg shadow-slate-500/20 scale-[1.02]',
  emerald: 'ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 scale-[1.02]',
  violet: 'ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/20 scale-[1.02]',
  cyan: 'ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-[1.02]',
};

const iconBgStyles: Record<AccentColor, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
};

export function ExecutiveKPICard({
  label,
  value,
  changePercent,
  icon: Icon,
  accentColor = 'blue',
  isSelected = false,
  onClick,
}: ExecutiveKPICardProps) {
  const change = changePercent ?? 0;
  const showChange = changePercent !== null;

  return (
    <Card
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
      className={cn(
        'h-full cursor-default border-l-4 shadow-sm transition-all duration-200 hover:scale-[1.01]',
        accentStyles[accentColor],
        isSelected && glowStyles[accentColor],
        onClick && 'cursor-pointer'
      )}
    >
      <CardContent className="flex items-center justify-between p-4 md:p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground md:text-sm">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
          {showChange ? (
            <div className="flex items-center gap-1">
              {change > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : change < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  change > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : change < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                )}
              >
                {change > 0 ? `+${change}%` : change < 0 ? `${change}%` : '—'}
              </span>
              <span className="text-xs text-muted-foreground">MoM</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">— MoM</span>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            iconBgStyles[accentColor]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
