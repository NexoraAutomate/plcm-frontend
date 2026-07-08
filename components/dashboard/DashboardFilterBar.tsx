'use client';

import Link from 'next/link';
import { Search, RotateCcw, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExecutiveDashboardFilters } from '@/lib/types/dashboard';
import type { Customer, Order, Project } from '@/lib/models';

interface DashboardFilterBarProps {
  filters: ExecutiveDashboardFilters;
  customers: Customer[];
  orders: Order[];
  projects: Project[];
  onChange: (patch: Partial<ExecutiveDashboardFilters>) => void;
  onClear: () => void;
  onSearchOpen?: () => void;
}

export function DashboardFilterBar({
  filters,
  customers,
  orders,
  projects,
  onChange,
  onClear,
  onSearchOpen,
}: DashboardFilterBarProps) {
  const filteredOrders = filters.customer_id
    ? orders.filter((o) => o.customer_id === filters.customer_id)
    : orders;

  const filteredProjects = filters.order_id
    ? projects.filter((p) => p.order_id === filters.order_id)
    : filters.customer_id
      ? projects.filter((p) => {
          const order = orders.find((o) => o.id === p.order_id);
          return order?.customer_id === filters.customer_id;
        })
      : projects;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Global Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
      {/* <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"> */}
      <div className="flex justify-between">
      <div className="flex gap-2 w-1/2"> 
        <Select
          value={filters.customer_id?.toString() ?? 'all'}
          onValueChange={(v) =>
            onChange({
              customer_id: v === 'all' ? undefined : Number(v),
              order_id: undefined,
              project_id: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.order_id?.toString() ?? 'all'}
          onValueChange={(v) =>
            onChange({
              order_id: v === 'all' ? undefined : Number(v),
              project_id: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            {filteredOrders.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.order_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.project_id?.toString() ?? 'all'}
          onValueChange={(v) =>
            onChange({ project_id: v === 'all' ? undefined : Number(v) })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {filteredProjects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link
            href={
              filters.project_id != null
                ? `/hierarchy-dashboard?project_id=${filters.project_id}`
                : '/hierarchy-dashboard'
            }
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Hierarchy
          </Link>
        </Button>
        </div>
        <div className="relative w-1/2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            className="cursor-pointer pl-9"
            placeholder="Search customers, projects, cases..."
            onFocus={() => onSearchOpen?.()}
            onClick={() => onSearchOpen?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearchOpen?.();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
