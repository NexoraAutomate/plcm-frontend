'use client';

import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ActivityItem } from '@/lib/types/dashboard';
import { DashboardEmptyState } from './DashboardEmptyState';

interface RecentActivityTableProps {
  title: string;
  items: ActivityItem[];
  onRowClick?: (item: ActivityItem) => void;
}

export function RecentActivityTable({ title, items, onRowClick }: RecentActivityTableProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <DashboardEmptyState message="No recent activity" compact />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={`${item.link_type}-${item.id}`}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
                  onClick={() => onRowClick?.(item)}
                >
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    {item.subtitle ? (
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell capitalize">
                    {item.status?.replace(/_/g, ' ') ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
