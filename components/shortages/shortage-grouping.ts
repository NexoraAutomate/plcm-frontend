import type { InventoryShortage } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';

export type ShortageViewMode = 'flight' | 'item';

export function flightLabel(row: InventoryShortage): string {
  return row.flight_name?.trim() || row.flight_code?.trim() || `Flight #${row.flight_id}`;
}

export function sdlsLabel(row: InventoryShortage): string {
  return row.sdls_name?.trim() || row.sdls_code?.trim() || `SDLS #${row.sdls_id}`;
}

export function itemLabel(row: InventoryShortage): string {
  return row.lru_name?.trim() || row.target_entity_type || 'Item';
}

export function flightGroupKey(row: InventoryShortage): string {
  return `flight:${row.project_id ?? 'p'}:${row.flight_id}`;
}

export function sdlsGroupKey(row: InventoryShortage): string {
  return `${flightGroupKey(row)}:sdls:${row.sdls_id}`;
}

export function itemGroupKey(row: InventoryShortage): string {
  const type = (row.target_entity_type || '').trim().toLowerCase();
  const name = itemLabel(row).toLowerCase();
  return `item:${type}:${name}`;
}

export function isActiveShortage(row: InventoryShortage): boolean {
  return row.status === 'OPEN' || row.status === 'PARTIAL';
}

export function daysSinceReported(row: InventoryShortage, now = Date.now()): number {
  const requested = parseApiDate(row.requested_at).getTime();
  if (!Number.isFinite(requested)) return 0;
  return Math.max(0, Math.floor((now - requested) / (24 * 60 * 60 * 1000)));
}

export function fulfilledQtyOf(row: InventoryShortage): number {
  const original = Math.max(0, Number(row.qty_original) || 0);
  const short = Math.max(0, Number(row.qty_short) || 0);
  if (row.status === 'FULFILLED') return original || Math.max(0, original - short);
  if (row.status === 'CANCELLED') return 0;
  return Math.max(0, original - short);
}

export function pendingQtyOf(row: InventoryShortage): number {
  if (!isActiveShortage(row)) return 0;
  return Math.max(0, Number(row.qty_short) || 0);
}

export type ShortageSdlsGroup = {
  key: string;
  label: string;
  rows: InventoryShortage[];
};

export type ShortageFlightGroup = {
  key: string;
  label: string;
  projectId?: number | null;
  projectName?: string | null;
  qtyShort: number;
  sdlsGroups: ShortageSdlsGroup[];
};

export type ShortageItemDemand = {
  key: string;
  flightLabel: string;
  sdlsLabel: string;
  row: InventoryShortage;
};

export type ShortageItemGroup = {
  key: string;
  label: string;
  entityType: string;
  qtyShort: number;
  demandCount: number;
  oldestDays: number;
  demands: ShortageItemDemand[];
};

export type ShortageScopeStats = {
  key: string;
  label: string;
  parentLabel?: string;
  pendingQty: number;
  fulfilledQty: number;
  openCount: number;
  oldestPendingDays: number | null;
};

export type ShortageDashboardStats = {
  openCount: number;
  partialCount: number;
  fulfilledCount: number;
  cancelledCount: number;
  pendingQty: number;
  fulfilledQty: number;
  flightCount: number;
  sdlsCount: number;
  itemCount: number;
  oldestPendingDays: number | null;
  flights: ShortageScopeStats[];
  sdls: ShortageScopeStats[];
};

export function groupShortagesByFlightSdls(rows: InventoryShortage[]): ShortageFlightGroup[] {
  const flightMap = new Map<
    string,
    {
      label: string;
      projectId?: number | null;
      projectName?: string | null;
      qtyShort: number;
      sdlsMap: Map<string, ShortageSdlsGroup>;
    }
  >();

  for (const row of rows) {
    const fKey = flightGroupKey(row);
    let flight = flightMap.get(fKey);
    if (!flight) {
      flight = {
        label: flightLabel(row),
        projectId: row.project_id,
        projectName: row.project_name,
        qtyShort: 0,
        sdlsMap: new Map(),
      };
      flightMap.set(fKey, flight);
    }
    flight.qtyShort += pendingQtyOf(row);

    const sKey = sdlsGroupKey(row);
    let sdls = flight.sdlsMap.get(sKey);
    if (!sdls) {
      sdls = { key: sKey, label: sdlsLabel(row), rows: [] };
      flight.sdlsMap.set(sKey, sdls);
    }
    sdls.rows.push(row);
  }

  return Array.from(flightMap.entries()).map(([key, flight]) => ({
    key,
    label: flight.label,
    projectId: flight.projectId,
    projectName: flight.projectName,
    qtyShort: flight.qtyShort,
    sdlsGroups: Array.from(flight.sdlsMap.values()).map((sdls) => ({
      ...sdls,
      rows: [...sdls.rows].sort(
        (a, b) =>
          parseApiDate(a.requested_at).getTime() - parseApiDate(b.requested_at).getTime()
      ),
    })),
  }));
}

export function groupShortagesByItem(rows: InventoryShortage[]): ShortageItemGroup[] {
  const itemMap = new Map<
    string,
    {
      label: string;
      entityType: string;
      qtyShort: number;
      oldestDays: number;
      demands: ShortageItemDemand[];
    }
  >();

  for (const row of rows) {
    const key = itemGroupKey(row);
    let item = itemMap.get(key);
    if (!item) {
      item = {
        label: itemLabel(row),
        entityType: row.target_entity_type || 'item',
        qtyShort: 0,
        oldestDays: 0,
        demands: [],
      };
      itemMap.set(key, item);
    }
    item.qtyShort += pendingQtyOf(row);
    item.oldestDays = Math.max(item.oldestDays, daysSinceReported(row));
    item.demands.push({
      key: `${key}:${row.id}`,
      flightLabel: flightLabel(row),
      sdlsLabel: sdlsLabel(row),
      row,
    });
  }

  return Array.from(itemMap.entries())
    .map(([key, item]) => ({
      key,
      label: item.label,
      entityType: item.entityType,
      qtyShort: item.qtyShort,
      demandCount: item.demands.length,
      oldestDays: item.oldestDays,
      demands: [...item.demands].sort(
        (a, b) =>
          parseApiDate(a.row.requested_at).getTime() -
          parseApiDate(b.row.requested_at).getTime()
      ),
    }))
    .sort((a, b) => b.qtyShort - a.qtyShort || a.label.localeCompare(b.label));
}

export function buildShortageDashboardStats(
  rows: InventoryShortage[],
  now = Date.now()
): ShortageDashboardStats {
  let openCount = 0;
  let partialCount = 0;
  let fulfilledCount = 0;
  let cancelledCount = 0;
  let pendingQty = 0;
  let fulfilledQty = 0;
  let oldestPendingDays: number | null = null;

  const flightMap = new Map<string, ShortageScopeStats>();
  const sdlsMap = new Map<string, ShortageScopeStats>();
  const pendingItemKeys = new Set<string>();

  for (const row of rows) {
    const pending = pendingQtyOf(row);
    const fulfilled = fulfilledQtyOf(row);
    pendingQty += pending;
    fulfilledQty += fulfilled;

    if (row.status === 'OPEN') openCount += 1;
    else if (row.status === 'PARTIAL') partialCount += 1;
    else if (row.status === 'FULFILLED') fulfilledCount += 1;
    else if (row.status === 'CANCELLED') cancelledCount += 1;

    if (isActiveShortage(row)) {
      pendingItemKeys.add(itemGroupKey(row));
      const days = daysSinceReported(row, now);
      oldestPendingDays =
        oldestPendingDays == null ? days : Math.max(oldestPendingDays, days);
    }

    const fKey = flightGroupKey(row);
    let flight = flightMap.get(fKey);
    if (!flight) {
      flight = {
        key: fKey,
        label: flightLabel(row),
        pendingQty: 0,
        fulfilledQty: 0,
        openCount: 0,
        oldestPendingDays: null,
      };
      flightMap.set(fKey, flight);
    }
    flight.pendingQty += pending;
    flight.fulfilledQty += fulfilled;
    if (isActiveShortage(row)) {
      flight.openCount += 1;
      const days = daysSinceReported(row, now);
      flight.oldestPendingDays =
        flight.oldestPendingDays == null
          ? days
          : Math.max(flight.oldestPendingDays, days);
    }

    const sKey = sdlsGroupKey(row);
    let sdls = sdlsMap.get(sKey);
    if (!sdls) {
      sdls = {
        key: sKey,
        label: sdlsLabel(row),
        parentLabel: flightLabel(row),
        pendingQty: 0,
        fulfilledQty: 0,
        openCount: 0,
        oldestPendingDays: null,
      };
      sdlsMap.set(sKey, sdls);
    }
    sdls.pendingQty += pending;
    sdls.fulfilledQty += fulfilled;
    if (isActiveShortage(row)) {
      sdls.openCount += 1;
      const days = daysSinceReported(row, now);
      sdls.oldestPendingDays =
        sdls.oldestPendingDays == null ? days : Math.max(sdls.oldestPendingDays, days);
    }
  }

  const sortScope = (a: ShortageScopeStats, b: ShortageScopeStats) =>
    b.pendingQty - a.pendingQty || b.fulfilledQty - a.fulfilledQty || a.label.localeCompare(b.label);

  return {
    openCount,
    partialCount,
    fulfilledCount,
    cancelledCount,
    pendingQty,
    fulfilledQty,
    flightCount: Array.from(flightMap.values()).filter((f) => f.openCount > 0).length,
    sdlsCount: Array.from(sdlsMap.values()).filter((s) => s.openCount > 0).length,
    itemCount: pendingItemKeys.size,
    oldestPendingDays,
    flights: Array.from(flightMap.values()).sort(sortScope).slice(0, 6),
    sdls: Array.from(sdlsMap.values()).sort(sortScope).slice(0, 6),
  };
}
