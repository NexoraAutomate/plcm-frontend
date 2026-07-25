export const EXEC = {
  bg: '#090909',
  card: '#141414',
  border: '#242424',
  purple: '#8B5CF6',
  cyan: '#00C2FF',
  success: '#4ADE80',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: '#9CA3AF',
  text: '#F5F5F5',
  orange: '#FB923C',
  yellow: '#FACC15',
  radius: 10,
} as const;

export const EXEC_DONUT_COLORS = [
  EXEC.success,
  EXEC.orange,
  EXEC.yellow,
  EXEC.cyan,
  EXEC.purple,
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
