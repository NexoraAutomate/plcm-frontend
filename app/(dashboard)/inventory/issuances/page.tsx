'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, RefreshCw, Undo2, X } from 'lucide-react';
import * as api from '@/lib/api';
import type { InventoryIssuance, User } from '@/lib/models';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
import { parseApiDate } from '@/lib/parse-api-date';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { useAuth } from '@/lib/auth-context';
import {
  IssuanceRemarksDialog,
  type IssuanceRemarksAction,
} from '@/components/inventory/issuance-remarks-dialog';
import { IssuanceHistorySheet } from '@/components/inventory/issuance-history-sheet';
import { issuanceCanReturn, issuanceInstallStateLabel } from '@/lib/inventory-issuance';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All (history)' },
  { value: 'issued', label: 'Issued (open)' },
  { value: 'return_pending', label: 'Return pending' },
  { value: 'installed', label: 'Installed' },
  { value: 'returned', label: 'Returned' },
  { value: 'reverted', label: 'Reverted' },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'issued':
      return 'default' as const;
    case 'return_pending':
      return 'secondary' as const;
    case 'installed':
      return 'secondary' as const;
    case 'returned':
      return 'outline' as const;
    case 'reverted':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    const d = parseApiDate(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

export default function InventoryIssuancesPage() {
  const { users } = useDataStore();
  const { isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const [rows, setRows] = useState<InventoryIssuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [issuedTo, setIssuedTo] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [actionId, setActionId] = useState<number | null>(null);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarksAction, setRemarksAction] = useState<IssuanceRemarksAction | null>(null);
  const [remarksRow, setRemarksRow] = useState<InventoryIssuance | null>(null);
  const [historyRow, setHistoryRow] = useState<InventoryIssuance | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listIssuances({
        status: status !== 'all' ? status : undefined,
        issued_to_user_id:
          inventoryManager && issuedTo !== 'all' ? Number(issuedTo) : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load issuances');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, issuedTo, debouncedSearch, inventoryManager]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRemarks = (row: InventoryIssuance, action: IssuanceRemarksAction) => {
    setRemarksRow(row);
    setRemarksAction(action);
    setRemarksOpen(true);
  };

  const handleRemarksConfirm = async (notes: string) => {
    if (!remarksRow || !remarksAction) return;
    setActionId(remarksRow.id);
    try {
      if (remarksAction === 'return') {
        await api.inventory.returnIssuance(remarksRow.id, notes);
        toast.success(
          inventoryManager
            ? 'Return accepted — stock is available again'
            : 'Return requested — waiting for admin acceptance'
        );
      } else if (remarksAction === 'accept') {
        await api.inventory.acceptReturn(remarksRow.id, notes);
        toast.success('Return accepted — stock restored to warehouse');
      } else {
        await api.inventory.rejectReturn(remarksRow.id, notes);
        toast.success('Return rejected — reissued to installer');
      }
      setRemarksOpen(false);
      setRemarksRow(null);
      setRemarksAction(null);
      await load();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Action failed';
      toast.error(typeof detail === 'string' ? detail : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const itemLabel = (row: InventoryIssuance | null) => {
    if (!row) return undefined;
    return (
      row.inventory_name ||
      row.part_number ||
      row.serial_number ||
      `Issuance #${row.id}`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/inventory">
                <ArrowLeft className="mr-1 size-4" />
                Inventory
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory issuances</h1>
          <p className="text-sm text-muted-foreground">
            {inventoryManager
              ? 'Full issuance and return history. Click a row for unit ping-pong timeline. Accept or reject pending returns with remarks.'
              : 'Your issuance history — click a row for timeline. Return unused items with a reason.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by status, developer, or part/serial/name</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Developer</Label>
            <Select
              value={issuedTo}
              onValueChange={setIssuedTo}
              disabled={!inventoryManager}
            >
              <SelectTrigger>
                <SelectValue placeholder="All developers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All developers</SelectItem>
                {(users as User[]).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {formatUserRef(u) || u.username || `User #${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, part #, serial…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ListContentSuspense loading={loading}>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No issuances found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Part / Serial</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Whom</TableHead>
                    <TableHead>Issued by</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Return / Closed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setHistoryRow(row);
                        setHistoryOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {row.inventory_name || `Inventory #${row.inventory_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.inventory_type}</div>
                      </TableCell>
                      <TableCell>
                        <div>{row.part_number || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.serial_number || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>
                        {row.issued_to_name || `User #${row.issued_to_user_id}`}
                      </TableCell>
                      <TableCell>
                        {row.issued_by_name || `User #${row.issued_by_user_id}`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatWhen(row.issued_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.status === 'return_pending' ? (
                          <span title="Return requested">
                            Req {formatWhen(row.return_requested_at)}
                          </span>
                        ) : row.closed_at ? (
                          <span title={row.status}>{formatWhen(row.closed_at)}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {row.status === 'return_pending' ? 'return pending' : row.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {issuanceCanReturn(row) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap"
                            disabled={actionId === row.id}
                            onClick={() => openRemarks(row, 'return')}
                          >
                            <Undo2 className="size-3.5" />
                            {inventoryManager ? 'Force return' : 'Return'}
                          </Button>
                        ) : issuanceInstallStateLabel(row) ? (
                          <span className="text-xs text-muted-foreground capitalize">
                            {issuanceInstallStateLabel(row)}
                          </span>
                        ) : null}
                        {row.status === 'return_pending' && inventoryManager ? (
                          <div className="inline-flex flex-col items-stretch gap-1.5">
                            <Button
                              variant="default"
                              size="sm"
                              className="whitespace-nowrap"
                              disabled={actionId === row.id}
                              onClick={() => openRemarks(row, 'accept')}
                            >
                              <Check className="size-3.5" />
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap"
                              disabled={actionId === row.id}
                              onClick={() => openRemarks(row, 'reject')}
                            >
                              <X className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : null}
                        {row.status === 'return_pending' && !inventoryManager ? (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            Awaiting admin
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </ListContentSuspense>
        </CardContent>
      </Card>

      <IssuanceRemarksDialog
        open={remarksOpen}
        onOpenChange={setRemarksOpen}
        action={remarksAction}
        itemLabel={itemLabel(remarksRow)}
        busy={actionId != null}
        onConfirm={handleRemarksConfirm}
      />

      <IssuanceHistorySheet
        issuance={historyRow}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
