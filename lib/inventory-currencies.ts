/** Common currencies for inventory valuation (Order pattern defaults to PKR). */
export const INVENTORY_CURRENCIES = [
  'PKR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SAR',
  'CNY',
  'JPY',
  'INR',
] as const;

export type InventoryCurrency = (typeof INVENTORY_CURRENCIES)[number] | string;

export function formatInventoryMoney(
  amount: number | null | undefined,
  currency = 'PKR'
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'PKR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'PKR'} ${value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;
  }
}
