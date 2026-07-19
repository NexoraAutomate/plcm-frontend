'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EntityListPagination } from '@/components/entity-list-pagination';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useTableSorting } from '@/hooks/use-table-sorting';
import * as api from '@/lib/api';
import type { User, UserLoginHistory } from '@/lib/models';

const PAGE_SIZE = 10;

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
};

export function UserLoginHistoryDialog({ open, onOpenChange, user }: Props) {
  const [rows, setRows] = useState<UserLoginHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Success' | 'Failed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { sort, cycleSort, listFilterPatch } = useTableSorting();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.users.loginHistory(user.id, page * PAGE_SIZE, PAGE_SIZE, {
        search: search.trim() || undefined,
        login_status: statusFilter === 'all' ? undefined : statusFilter,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
        sort_by: listFilterPatch.sort_by,
        sort_order: listFilterPatch.sort_order,
      });
      setRows(res.data ?? []);
      const headerTotal = Number(res.headers?.['x-total-count'] ?? res.data?.length ?? 0);
      setTotal(Number.isFinite(headerTotal) ? headerTotal : res.data?.length ?? 0);
    } catch {
      toast.error('Failed to load login history');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [user, page, search, statusFilter, dateFrom, dateTo, listFilterPatch]);

  useEffect(() => {
    if (open && user) {
      void load();
    }
  }, [open, user, load]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, dateFrom, dateTo, sort]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Login History</DialogTitle>
          <DialogDescription>
            Authentication history for {user?.full_name || user?.username || 'user'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search IP, browser, device..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value: 'all' | 'Success' | 'Failed') => setStatusFilter(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Success">Success</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="login_time" sort={sort} onSort={cycleSort}>
                  Login Time
                </SortableTableHead>
                <SortableTableHead column="logout_time" sort={sort} onSort={cycleSort}>
                  Logout Time
                </SortableTableHead>
                <SortableTableHead column="session_duration" sort={sort} onSort={cycleSort}>
                  Duration
                </SortableTableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>IP</TableHead>
                <SortableTableHead column="login_status" sort={sort} onSort={cycleSort}>
                  Status
                </SortableTableHead>
                <TableHead>Failure Reason</TableHead>
                <SortableTableHead column="last_activity" sort={sort} onSort={cycleSort}>
                  Last Activity
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    No login history found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(row.login_time)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(row.logout_time)}
                    </TableCell>
                    <TableCell>{formatDuration(row.session_duration)}</TableCell>
                    <TableCell>{row.browser || '—'}</TableCell>
                    <TableCell>{row.device_name || '—'}</TableCell>
                    <TableCell>{row.operating_system || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ip_address || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.login_status === 'Success' ? 'default' : 'destructive'}
                      >
                        {row.login_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                      {row.failure_reason || '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(row.last_activity)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <EntityListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          rangeLabel={`${rangeStart}–${rangeEnd}`}
          hasPrev={page > 0}
          hasNext={page < totalPages - 1}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  );
}
