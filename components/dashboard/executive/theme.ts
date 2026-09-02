export type ExecPalette = {
  bg: string;
  card: string;
  border: string;
  purple: string;
  cyan: string;
  success: string;
  warning: string;
  danger: string;
  muted: string;
  text: string;
  textSecondary: string;
  elevated: string;
  gaugeTrack: string;
  grid: string;
  orange: string;
  yellow: string;
  radius: number;
};

const ACCENTS = {
  purple: '#8B5CF6',
  cyan: '#00C2FF',
  success: '#4ADE80',
  warning: '#F59E0B',
  danger: '#EF4444',
  orange: '#FB923C',
  yellow: '#FACC15',
  radius: 10,
} as const;

/** Resolved hex palette for dark mode (charts / canvas). */
export const EXEC_DARK: ExecPalette = {
  bg: '#090909',
  card: '#141414',
  border: '#242424',
  muted: '#9CA3AF',
  text: '#F5F5F5',
  textSecondary: '#D1D5DB',
  elevated: '#0C0C0C',
  gaugeTrack: '#2A2A2A',
  grid: '#242424',
  ...ACCENTS,
};

/** Resolved hex palette for light mode (charts / canvas). */
export const EXEC_LIGHT: ExecPalette = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  textSecondary: '#4B5563',
  elevated: '#F9FAFB',
  gaugeTrack: '#E5E7EB',
  grid: '#E5E7EB',
  ...ACCENTS,
};

/**
 * DOM-oriented tokens — surfaces resolve via CSS variables so the dashboard
 * follows the app-wide `.dark` class. Accent colors stay as hex.
 */
export const EXEC = {
  bg: 'var(--exec-bg)',
  card: 'var(--exec-card)',
  border: 'var(--exec-border)',
  muted: 'var(--exec-muted)',
  text: 'var(--exec-text)',
  textSecondary: 'var(--exec-text-secondary)',
  elevated: 'var(--exec-elevated)',
  gaugeTrack: 'var(--exec-gauge-track)',
  grid: 'var(--exec-grid)',
  ...ACCENTS,
} as const;

export function getExecPalette(isDark: boolean): ExecPalette {
  return isDark ? EXEC_DARK : EXEC_LIGHT;
}

export function getExecChartTheme(isDark: boolean): 'classicDark' | 'classic' {
  return isDark ? 'classicDark' : 'classic';
}

export const EXEC_DONUT_COLORS = [
  EXEC.success,
  EXEC.orange,
  EXEC.yellow,
  EXEC.cyan,
  EXEC.purple,
] as const;

/** Fixed palette for Projects by Status buckets (order matters). */
export const EXEC_PROJECT_STATUS_COLORS: Record<string, string> = {
  'On Track': EXEC.success,
  Delayed: EXEC.orange,
  'On Hold': EXEC.yellow,
  Completed: EXEC.cyan,
};

export const EXEC_PROJECT_STATUS_ORDER = [
  'On Track',
  'Delayed',
  'On Hold',
  'Completed',
] as const;

export const EXEC_MAINT_COLORS = [
  EXEC.purple,
  EXEC.orange,
  EXEC.yellow,
  EXEC.success,
] as const;

export const EXEC_FAULT_COLORS = [
  EXEC.purple,
  EXEC.cyan,
  EXEC.warning,
  EXEC.danger,
  EXEC.success,
] as const;

export const PRIORITY_COLORS = {
  Critical: EXEC.danger,
  High: EXEC.orange,
  Medium: EXEC.yellow,
  Low: EXEC.success,
} as const;
