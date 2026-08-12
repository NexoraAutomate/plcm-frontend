/** Shared status color palette + badge styling helpers */

import type { CSSProperties } from 'react';

/**
 * Office / PowerPoint-style theme matrix:
 * each column is a hue; rows go from light → dark (we prefer mid–dark for white text).
 */
export const THEME_COLOR_COLUMNS: { name: string; shades: string[] }[] = [
  {
    name: 'Blue',
    shades: ['#BDD7EE', '#9BC2E6', '#5B9BD5', '#2E75B6', '#1F4E79', '#0D2B4A'],
  },
  {
    name: 'Orange',
    shades: ['#F8CBAD', '#F4B183', '#ED7D31', '#C55A11', '#833C0C', '#5B2A08'],
  },
  {
    name: 'Gray',
    shades: ['#E7E6E6', '#C9C9C9', '#A6A6A6', '#7F7F7F', '#595959', '#404040'],
  },
  {
    name: 'Gold',
    shades: ['#FFE699', '#FFD966', '#FFC000', '#BF9000', '#806000', '#5C4500'],
  },
  {
    name: 'Blue-Gray',
    shades: ['#D6DCE4', '#ADB9CA', '#8FAADC', '#5B7BB5', '#2F5496', '#1F3864'],
  },
  {
    name: 'Green',
    shades: ['#C6EFCE', '#A9D08E', '#70AD47', '#548235', '#375623', '#1E3A14'],
  },
  {
    name: 'Teal',
    shades: ['#B4C6E7', '#8EA9DB', '#4472C4', '#2F5496', '#1F3864', '#0F1E38'],
  },
  {
    name: 'Aqua',
    shades: ['#A9D08E', '#70AD47', '#00B050', '#009F4D', '#006B34', '#004822'],
  },
  {
    name: 'Purple',
    shades: ['#D5A6BD', '#C38CB3', '#9E5B8A', '#7030A0', '#4A1F6A', '#2D1340'],
  },
  {
    name: 'Red',
    shades: ['#F4B183', '#ED7D31', '#C00000', '#9C0006', '#7A0005', '#520003'],
  },
];

/** Single-row standard colors (Word / PowerPoint “Standard Colors”) */
export const STANDARD_COLORS: { name: string; hex: string }[] = [
  { name: 'Dark Red', hex: '#C00000' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Orange', hex: '#FFC000' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Light Green', hex: '#92D050' },
  { name: 'Green', hex: '#00B050' },
  { name: 'Light Blue', hex: '#00B0F0' },
  { name: 'Blue', hex: '#0070C0' },
  { name: 'Dark Blue', hex: '#002060' },
  { name: 'Purple', hex: '#7030A0' },
];

/** Flat list used for defaults / suggestions (darker theme shades) */
export const STATUS_COLOR_PALETTE = THEME_COLOR_COLUMNS.flatMap((col) =>
  col.shades.slice(2).map((hex, i) => ({
    name: `${col.name} ${i + 3}`,
    hex,
  }))
);

export type StatusColorSwatch = { name: string; hex: string };

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeStatusColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeStatusColor(hex);
  if (!normalized) return `rgba(51, 65, 85, ${alpha})`;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Solid badge background with white label text */
export function statusBadgeStyleFromColor(
  color: string | null | undefined
): CSSProperties | undefined {
  const hex = normalizeStatusColor(color);
  if (!hex) return undefined;
  return {
    backgroundColor: hex,
    color: '#FFFFFF',
    borderColor: hex,
  };
}

export const DEFAULT_STATUS_COLOR_BY_NAME: Record<string, string> = {
  Available: '#548235',
  Allocated: '#2E75B6',
  Installed: '#2F5496',
  Testing: '#BF9000',
  Failed: '#C00000',
  Replaced: '#595959',
  Retired: '#404040',
  Planning: '#2E75B6',
  Building: '#2F5496',
  Delivered: '#548235',
  Pending: '#C55A11',
  Approved: '#00B050',
  Rejected: '#C00000',
  Open: '#0070C0',
  Resolved: '#548235',
  Monitoring: '#BF9000',
  Active: '#00B050',
  Inactive: '#595959',
  // Spec 00 workflow codes + display labels
  AVAILABLE: '#548235',
  RESERVED: '#2E75B6',
  ISSUED: '#0070C0',
  INSTALLATION_IN_PROGRESS: '#C55A11',
  UNDER_TESTING_REVIEW: '#BF9000',
  INSTALLED_VERIFIED: '#00B050',
  RETURNED: '#7030A0',
  INSPECTION: '#ED7D31',
  REUSABLE: '#70AD47',
  REPAIRABLE: '#C55A11',
  SCRAPPED: '#595959',
  DRAFT: '#7F7F7F',
  APPROVED: '#00B050',
  HIERARCHY_GENERATED: '#2E75B6',
  READY_FOR_INVENTORY: '#548235',
  CANCELLED: '#C00000',
  COMPLETED: '#375623',
  READY_TO_DELIVER: '#2F5496',
  'Installation In Progress': '#C55A11',
  'Under Testing / Review': '#BF9000',
  'Installed Verified': '#00B050',
  'Hierarchy Generated': '#2E75B6',
  'Ready For Inventory': '#548235',
  'Ready To Deliver': '#2F5496',
};

export function suggestColorForStatusName(name: string): string {
  return DEFAULT_STATUS_COLOR_BY_NAME[name] ?? '#2F5496';
}
