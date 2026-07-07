'use client';

/**
 * Notification bell data is provided by useAppNotifications in the navbar.
 * Passive store-driven alerts are not shown as toasts — only explicit user
 * actions (create/update/delete) should surface toast feedback.
 */
export function useNotificationSync() {
  // Intentionally no-op: avoids hundreds of toasts when bootstrap data loads.
}
