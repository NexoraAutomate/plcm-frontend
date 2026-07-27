/** Shared status color palette + badge styling helpers */

import type { CSSProperties } from 'react';

export const STATUS_COLOR_PALETTE = [
  { name: 'Emerald', hex: '#059669' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Zinc', hex: '#52525b' },
] as const;

export type StatusColorSwatch = (typeof STATUS_COLOR_PALETTE)[number];

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeStatusColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeStatusColor(hex);
  if (!normalized) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function statusBadgeStyleFromColor(
  color: string | null | undefined
): CSSProperties | undefined {
  const hex = normalizeStatusColor(color);
  if (!hex) return undefined;
  return {
    backgroundColor: hexToRgba(hex, 0.12),
    color: hex,
    borderColor: hexToRgba(hex, 0.4),
  };
}

/** Default hex suggestions keyed by common status names (seed UI / fallbacks). */
export const DEFAULT_STATUS_COLOR_BY_NAME: Record<string, string> = {
  Available: '#059669',
  Allocated: '#0284c7',
  Installed: '#2563eb',
  Testing: '#d97706',
  Failed: '#dc2626',
  Replaced: '#475569',
  Retired: '#52525b',
  Planning: '#0284c7',
  Building: '#2563eb',
  Delivered: '#059669',
  Pending: '#d97706',
  Approved: '#059669',
  Rejected: '#dc2626',
  Open: '#2563eb',
  Resolved: '#059669',
  Monitoring: '#d97706',
  Active: '#059669',
  Inactive: '#52525b',
};

export function suggestColorForStatusName(name: string): string {
  return DEFAULT_STATUS_COLOR_BY_NAME[name] ?? STATUS_COLOR_PALETTE[0].hex;
}
