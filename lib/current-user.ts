/** Read signed-in user id from the persisted auth session (client-only). */
export function getStoredUserId(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('sat-user');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { id?: number | string };
    const id = Number(parsed?.id);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}
