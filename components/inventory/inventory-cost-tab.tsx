'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatInventoryMoney,
  INVENTORY_CURRENCIES,
} from '@/lib/inventory-currencies';
import { cn } from '@/lib/utils';

export type CostEntryMode = 'batch' | 'unit';

export type InventoryCostTabValue = {
  currency: string;
  costMode: CostEntryMode;
  bulkQuoteCost: string;
  unitCost: string;
  unitCosts: string[];
};

export type ExistingUnitCostRow = {
  id: number | string;
  label: string;
  cost: string;
};

type InventoryCostTabProps = {
  quantity: number;
  value: InventoryCostTabValue;
  onChange: (next: InventoryCostTabValue) => void;
  disabled?: boolean;
  /** Existing stocked units (edit catalog) — editable per-unit list. */
  existingUnits?: ExistingUnitCostRow[];
  onExistingUnitCostChange?: (id: number | string, cost: string) => void;
  className?: string;
};

function resizeUnitCosts(current: string[], quantity: number, fill = ''): string[] {
  const qty = Math.max(0, Math.floor(quantity) || 0);
  if (current.length === qty) return current;
  if (current.length > qty) return current.slice(0, qty);
  return [...current, ...Array.from({ length: qty - current.length }, () => fill)];
}

export function InventoryCostTab({
  quantity,
  value,
  onChange,
  disabled = false,
  existingUnits,
  onExistingUnitCostChange,
  className,
}: InventoryCostTabProps) {
  const [subTab, setSubTab] = useState<CostEntryMode>(value.costMode);

  useEffect(() => {
    setSubTab(value.costMode);
  }, [value.costMode]);

  useEffect(() => {
    const nextCosts = resizeUnitCosts(value.unitCosts, quantity, value.unitCost);
    if (
      nextCosts.length !== value.unitCosts.length ||
      nextCosts.some((cost, index) => cost !== value.unitCosts[index])
    ) {
      onChange({ ...value, unitCosts: nextCosts });
    }
    // Only sync length when quantity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  const parsedBulk = Number(value.bulkQuoteCost);
  const bulkOk =
    value.bulkQuoteCost.trim() !== '' &&
    Number.isFinite(parsedBulk) &&
    parsedBulk >= 0;
  const qty = Math.max(1, Math.floor(quantity) || 1);
  const derivedUnit = bulkOk ? parsedBulk / qty : null;

  const unitLineTotal = useMemo(() => {
    return value.unitCosts.reduce((sum, raw) => {
      const n = Number(raw);
      return sum + (Number.isFinite(n) && n >= 0 ? n : 0);
    }, 0);
  }, [value.unitCosts]);

  function setMode(mode: CostEntryMode) {
    setSubTab(mode);
    onChange({ ...value, costMode: mode });
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={value.currency || 'PKR'}
            onValueChange={(currency) => onChange({ ...value, currency })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {INVENTORY_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Units in this receipt</Label>
          <Input value={String(Math.max(0, quantity))} disabled />
        </div>
      </div>

      <Tabs
        value={subTab}
        onValueChange={(next) => setMode(next as CostEntryMode)}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="batch" disabled={disabled}>
            Supplier quote
          </TabsTrigger>
          <TabsTrigger value="unit" disabled={disabled}>
            Per-unit pricing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bulk-quote-cost">
              Accumulated cost (supplier quote) *
            </Label>
            <Input
              id="bulk-quote-cost"
              type="number"
              min={0}
              step="0.01"
              value={value.bulkQuoteCost}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  costMode: 'batch',
                  bulkQuoteCost: e.target.value,
                })
              }
              placeholder="Total quoted for this batch"
            />
            <p className="text-xs text-muted-foreground">
              Bulk price for the quantity above. Split evenly across units for
              project cost estimates.
            </p>
            {derivedUnit != null ? (
              <p className="text-xs text-muted-foreground">
                ≈ {formatInventoryMoney(derivedUnit, value.currency)} per unit ·
                batch total{' '}
                {formatInventoryMoney(parsedBulk, value.currency)}
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="unit" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter a different acquisition cost for each unit when prices vary.
          </p>
          {existingUnits && existingUnits.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {existingUnits.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_8rem] items-center gap-2"
                >
                  <p className="truncate font-mono text-xs" title={row.label}>
                    {row.label}
                  </p>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.cost}
                    disabled={disabled}
                    onChange={(e) =>
                      onExistingUnitCostChange?.(row.id, e.target.value)
                    }
                    aria-label={`Cost for ${row.label}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {Array.from({ length: Math.max(0, Math.floor(quantity) || 0) }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[6rem_1fr] items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground">
                      Unit {index + 1}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={value.unitCosts[index] ?? ''}
                      disabled={disabled}
                      onChange={(e) => {
                        const next = resizeUnitCosts(
                          value.unitCosts,
                          quantity,
                          ''
                        );
                        next[index] = e.target.value;
                        onChange({
                          ...value,
                          costMode: 'unit',
                          unitCosts: next,
                          unitCost: next[0] ?? value.unitCost,
                        });
                      }}
                      placeholder="Cost"
                      aria-label={`Unit ${index + 1} cost`}
                    />
                  </div>
                )
              )}
              {quantity < 1 ? (
                <p className="text-xs text-muted-foreground">
                  Set quantity on the General tab first.
                </p>
              ) : null}
            </div>
          )}
          {quantity >= 1 && !existingUnits?.length ? (
            <p className="text-xs text-muted-foreground">
              Line total:{' '}
              {formatInventoryMoney(unitLineTotal, value.currency)}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Validate cost tab for create / restock / shortage receive. */
export function validateInventoryCostTab(
  value: InventoryCostTabValue,
  quantity: number
): string | null {
  const qty = Math.floor(Number(quantity) || 0);
  if (qty < 1) return 'Quantity must be at least 1 before entering cost';
  if (!value.currency?.trim()) return 'Select a currency';
  if (value.costMode === 'batch') {
    const bulk = Number(value.bulkQuoteCost);
    if (
      value.bulkQuoteCost.trim() === '' ||
      !Number.isFinite(bulk) ||
      bulk < 0
    ) {
      return 'Enter the accumulated supplier quote (0 or greater)';
    }
    return null;
  }
  const costs = resizeUnitCosts(value.unitCosts, qty, '');
  for (let i = 0; i < qty; i += 1) {
    const raw = (costs[i] || '').trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0) {
      return `Enter a cost for unit ${i + 1}`;
    }
  }
  return null;
}

export function costTabToPayload(value: InventoryCostTabValue, quantity: number) {
  const qty = Math.max(1, Math.floor(quantity) || 1);
  const currency = (value.currency || 'PKR').trim().toUpperCase();
  if (value.costMode === 'batch') {
    const bulk = Number(value.bulkQuoteCost);
    return {
      currency,
      bulk_quote_cost: bulk,
      unit_cost: undefined as number | undefined,
      unit_costs: undefined as number[] | undefined,
    };
  }
  const unit_costs = resizeUnitCosts(value.unitCosts, qty, '0').map((raw) =>
    Number(raw)
  );
  return {
    currency,
    bulk_quote_cost: undefined as number | undefined,
    unit_cost: unit_costs[0],
    unit_costs,
  };
}
