'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Undo2 } from 'lucide-react';
import * as api from '@/lib/api';
import type { InventoryIssuance, User } from '@/lib/models';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
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
import { PageLoader } from '@/components/page-loader';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'issued', label: 'Issued (open)' },
  { value: 'installed', label: 'Installed' },
  { value: 'returned', label: 'Returned' },
  { value: 'reverted', label: 'Reverted' },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'issued':
      return 'default' as const;
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
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function entityLabel(type?: string | null, id?: number | null) {
  if (!type && id == null) return '—';
  return `${type || 'entity'}${id != null ? ` #${id}` : ''}`;
}

export default function InventoryIssuancesPage() {
  const { users } = useDataStore();
  const [rows, setRows] = useState<InventoryIssuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('issued');
  const [issuedTo, setIssuedTo] = useState('all');
  const [search, setSearch] = useState('');
  const [returningId, setReturningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.inventory.listIssuances({
        status: status !== 'all' ? status : undefined,
        issued_to_user_id: issuedTo !== 'all' ? Number(issuedTo) : undefined,
        search: search.trim() || undefined,
      });
      setRows(res.data ?? []);
    } catch {
      toast.error('Failed to load issuances');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, issuedTo, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReturn = async (row: InventoryIssuance) => {
    setReturningId(row.id);
    try {
      await api.inventory.returnIssuance(row.id);
      toast.success('Issuance returned — stock is available again');
      await load();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to return issuance';
      toast.error(typeof detail === 'string' ? detail : 'Failed to return issuance');
    } finally {
      setReturningId(null);
    }
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
            Track who received stock, when, quantity, and install status. Quantity decreases only
            on install.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 size-3.5" />
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
            <Select value={issuedTo} onValueChange={setIssuedTo}>
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
          {loading ? (
            <PageLoader />
          ) : rows.length === 0 ? (
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
                    <TableHead>When</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.inventory_name || `Inventory #${row.inventory_id}`}</div>
                        <div className="text-xs text-muted-foreground">{row.inventory_type}</div>
                      </TableCell>
                      <TableCell>
                        <div>{row.part_number || '—'}</div>
                        <div className="text-xs text-muted-foreground">{row.serial_number || '—'}</div>
                      </TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.issued_to_name || `User #${row.issued_to_user_id}`}</TableCell>
                      <TableCell>{row.issued_by_name || `User #${row.issued_by_user_id}`}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatWhen(row.issued_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entityLabel(
                          row.installed_entity_type || row.target_entity_type,
                          row.installed_entity_id ?? row.target_entity_id
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.status === 'issued' && (
                          <Can permission={P.issue_inventory}>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={returningId === row.id}
                              onClick={() => void handleReturn(row)}
                            >
                              <Undo2 className="mr-1 size-3.5" />
                              Return
                            </Button>
                          </Can>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
