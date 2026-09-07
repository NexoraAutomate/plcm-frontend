import type {
  AppNotificationRecord,
  InventoryInstallerNotice,
  InventoryReservationExpiryNotice,
  InventoryReturnNotice,
  InventoryShortageNotice,
} from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';

export const APP_NOTICE_ID_PREFIX = 'app-';

export type AppNotificationType =
  | 'inventory_returned'
  | 'inventory_issued'
  | 'inventory_return_accepted'
  | 'inventory_return_rejected'
  | 'inventory_shortage'
  | 'inventory_shortage_fulfilled'
  | 'inventory_shortage_partial'
  | 'reservation_idle_reminder'
  | 'reservation_auto_released'
  | (string & {});

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  href: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  /** Backend notice id for inventory returns / installer / unified app notices. */
  metaId?: number;
  /** Issuance id for inventory return accept/reject. */
  metaIssuanceId?: number;
  projectId?: number;
  entityType?: string | null;
  entityId?: number;
  shortageId?: number;
  reservationId?: number;
  partNumber?: string | null;
  serialNumber?: string | null;
  /** Server-backed notice already marked read (stays in history). */
  serverRead?: boolean;
  /** Persist in history — not removable by Clear all. */
  persistent?: boolean;
  /** Extra text for client-side search (recipient name, notes, etc.). */
  searchText?: string;
}

function normalizePriority(value?: string | null): AppNotification['priority'] {
  if (value === 'high' || value === 'low' || value === 'medium') return value;
  return 'medium';
}

export function isServerAppNotificationId(id: string): boolean {
  return id.startsWith(APP_NOTICE_ID_PREFIX);
}

export function parseServerAppNotificationId(id: string): number | undefined {
  if (!isServerAppNotificationId(id)) return undefined;
  const n = Number(id.slice(APP_NOTICE_ID_PREFIX.length));
  return Number.isFinite(n) ? n : undefined;
}

export function mapServerAppNotification(row: AppNotificationRecord): AppNotification {
  return {
    id: `${APP_NOTICE_ID_PREFIX}${row.id}`,
    type: row.event_type,
    title: row.title,
    message: row.message,
    href: row.href || '/notifications',
    timestamp: row.created_at,
    priority: normalizePriority(row.priority),
    metaId: row.id,
    projectId: row.project_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    shortageId: row.entity_type === 'shortage' ? row.entity_id ?? undefined : undefined,
    reservationId:
      row.entity_type === 'inventory_reservation' ? row.entity_id ?? undefined : undefined,
    serverRead: Boolean(row.read_at),
    persistent: true,
    searchText: [row.event_type, row.entity_type, row.entity_id].filter(Boolean).join(' '),
  };
}

export function buildAppNotifications(input: {
  inventoryReturnNotices?: InventoryReturnNotice[];
  inventoryInstallerNotices?: InventoryInstallerNotice[];
  inventoryShortageNotices?: InventoryShortageNotice[];
  inventoryReservationExpiryNotices?: InventoryReservationExpiryNotice[];
  serverAppNotifications?: AppNotificationRecord[];
}): AppNotification[] {
  const {
    inventoryReturnNotices = [],
    inventoryInstallerNotices = [],
    inventoryShortageNotices = [],
    inventoryReservationExpiryNotices = [],
    serverAppNotifications = [],
  } = input;
  const notifications: AppNotification[] = [];

  for (const notice of inventoryReturnNotices) {
    const itemLabel =
      notice.inventory_name ||
      notice.part_number ||
      (notice.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
    const who = notice.returned_by_name || `User #${notice.returned_by_user_id}`;
    const serial = notice.serial_number ? ` (${notice.serial_number})` : '';
    const decision = (notice.decision || 'pending').toLowerCase();
    const searchText = [
      itemLabel,
      who,
      notice.serial_number,
      notice.part_number,
      notice.request_notes,
      notice.decision_notes,
      decision,
    ]
      .filter(Boolean)
      .join(' ');

    if (decision === 'pending' || !notice.decision) {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_returned',
        title: 'Inventory return requested',
        message: `Installer ${who} requested return of ${itemLabel}${serial}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: false,
        persistent: true,
        searchText,
      });
    } else if (decision === 'accepted') {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_return_accepted',
        title: 'Return accepted (admin)',
        message: `Accepted return of ${itemLabel}${serial} from ${who}`,
        href: '/inventory/issuances',
        timestamp: notice.decided_at || notice.created_at,
        priority: 'low',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: true,
        persistent: true,
        searchText,
      });
    } else if (decision === 'rejected') {
      notifications.push({
        id: `inventory-returned-${notice.id}`,
        type: 'inventory_return_rejected',
        title: 'Return rejected (admin)',
        message: `Rejected return of ${itemLabel}${serial} from ${who}`,
        href: '/inventory/issuances',
        timestamp: notice.decided_at || notice.created_at,
        priority: 'low',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id,
        serverRead: true,
        persistent: true,
        searchText,
      });
    }
  }

  for (const notice of inventoryInstallerNotices) {
    const itemLabel =
      notice.inventory_name ||
      notice.part_number ||
      (notice.inventory_id != null ? `Inventory #${notice.inventory_id}` : 'inventory item');
    const serial = notice.serial_number ? ` (${notice.serial_number})` : '';
    const recipient = notice.user_name || `User #${notice.user_id}`;
    const isRead = Boolean(notice.read_at);
    const searchText = [
      itemLabel,
      recipient,
      notice.message,
      notice.notes,
      notice.serial_number,
      notice.part_number,
      notice.notice_type,
    ]
      .filter(Boolean)
      .join(' ');

    if (notice.notice_type === 'issued') {
      notifications.push({
        id: `inventory-issued-${notice.id}`,
        type: 'inventory_issued',
        title: 'Inventory issued',
        message:
          notice.message ||
          `${itemLabel}${serial} issued to ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'return_accepted') {
      notifications.push({
        id: `inventory-return-accepted-${notice.id}`,
        type: 'inventory_return_accepted',
        title: 'Return accepted',
        message:
          notice.message ||
          `Return of ${itemLabel}${serial} accepted for ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'return_rejected') {
      notifications.push({
        id: `inventory-return-rejected-${notice.id}`,
        type: 'inventory_return_rejected',
        title: 'Return rejected',
        message:
          notice.message ||
          `Return of ${itemLabel}${serial} rejected for ${recipient}`,
        href: '/inventory/issuances',
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        metaIssuanceId: notice.issuance_id ?? undefined,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    }
  }

  for (const notice of inventoryShortageNotices) {
    const flight = notice.flight_code || notice.flight_name || 'Flight';
    const sdls = notice.sdls_code || notice.sdls_name || 'SDLS';
    const lru = notice.lru_name || 'item';
    const pn = notice.part_number || '—';
    const href = '/shortages';
    const isRead = Boolean(notice.read_at);
    const searchText = [
      pn,
      notice.qty,
      flight,
      sdls,
      lru,
      notice.project_name,
      notice.message,
      notice.notice_type,
    ]
      .filter(Boolean)
      .join(' ');
    const message =
      notice.message ||
      `PN ${pn}, Qty ${notice.qty}, Flight ${flight}, SDLS ${sdls}, LRU ${lru}`;

    if (notice.notice_type === 'shortage_fulfilled') {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage_fulfilled',
        title: 'Shortage fulfilled — auto-reserved',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        projectId: notice.project_id ?? undefined,
        shortageId: notice.shortage_id,
        partNumber: notice.part_number,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else if (notice.notice_type === 'shortage_partial') {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage_partial',
        title: 'Shortage partially fulfilled',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'medium',
        metaId: notice.id,
        projectId: notice.project_id ?? undefined,
        shortageId: notice.shortage_id,
        partNumber: notice.part_number,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    } else {
      notifications.push({
        id: `shortage-notice-${notice.id}`,
        type: 'inventory_shortage',
        title: 'Inventory shortage',
        message,
        href,
        timestamp: notice.created_at,
        priority: isRead ? 'low' : 'high',
        metaId: notice.id,
        projectId: notice.project_id ?? undefined,
        shortageId: notice.shortage_id,
        partNumber: notice.part_number,
        serverRead: isRead,
        persistent: true,
        searchText,
      });
    }
  }

  for (const notice of inventoryReservationExpiryNotices) {
    const flight = notice.flight_code || notice.flight_name || 'Flight';
    const sdls = notice.sdls_code || notice.sdls_name || 'SDLS';
    const item = notice.inventory_name || notice.serial_number || 'unit';
    const href = '/inventory?stock=reserved';
    const isRead = Boolean(notice.read_at);
    const searchText = [
      notice.part_number,
      notice.serial_number,
      flight,
      sdls,
      item,
      notice.project_name,
      notice.message,
      notice.notice_type,
    ]
      .filter(Boolean)
      .join(' ');
    const autoReleased = notice.notice_type === 'reservation_auto_released';
    notifications.push({
      id: `reservation-expiry-notice-${notice.id}`,
      type: autoReleased ? 'reservation_auto_released' : 'reservation_idle_reminder',
      title: autoReleased ? 'Reservation auto-released' : 'Idle reservation reminder',
      message:
        notice.message ||
        `${item} · ${flight} / ${sdls}${notice.part_number ? ` · PN ${notice.part_number}` : ''}`,
      href,
      timestamp: notice.created_at,
      priority: isRead ? 'low' : autoReleased ? 'medium' : 'high',
      metaId: notice.id,
      projectId: notice.project_id ?? undefined,
      reservationId: notice.reservation_id,
      partNumber: notice.part_number,
      serialNumber: notice.serial_number,
      serverRead: isRead,
      persistent: true,
      searchText,
    });
  }

  for (const row of serverAppNotifications) {
    notifications.push(mapServerAppNotification(row));
  }

  return notifications.sort(
    (a, b) => parseApiDate(b.timestamp).getTime() - parseApiDate(a.timestamp).getTime()
  );
}

/** Client-side filter for notification history search. */
export function filterAppNotifications(
  items: AppNotification[],
  query: string
): AppNotification[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.message,
      item.type,
      item.searchText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
