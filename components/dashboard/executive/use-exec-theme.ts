'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  getExecChartTheme,
  getExecPalette,
  type ExecPalette,
} from './theme';

export function useExecTheme(): {
  isDark: boolean;
  exec: ExecPalette;
  chartTheme: 'classicDark' | 'classic';
} {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return useMemo(
    () => ({
      isDark,
      exec: getExecPalette(isDark),
      chartTheme: getExecChartTheme(isDark),
    }),
    [isDark]
  );
}
