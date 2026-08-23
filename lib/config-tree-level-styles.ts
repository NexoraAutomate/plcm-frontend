import type { TemplateNodeLevel } from '@/lib/hierarchy-config';

/** Distinct fill/border per hierarchy level for node identification. */
export const LEVEL_NODE_STYLE: Record<
  TemplateNodeLevel,
  { card: string; minimap: string }
> = {
  system: {
    card: 'border-blue-500 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-50',
    minimap: '#3b82f6',
  },
  subsystem: {
    card: 'border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-50',
    minimap: '#8b5cf6',
  },
  module: {
    card: 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-50',
    minimap: '#10b981',
  },
  unit: {
    card: 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950/50 dark:text-amber-50',
    minimap: '#f59e0b',
  },
  component: {
    card: 'border-slate-500 bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-50',
    minimap: '#64748b',
  },
};

export const LEVEL_LEGEND_DOT: Record<TemplateNodeLevel, string> = {
  system: 'bg-blue-500',
  subsystem: 'bg-violet-500',
  module: 'bg-emerald-500',
  unit: 'bg-amber-500',
  component: 'bg-slate-500',
};
