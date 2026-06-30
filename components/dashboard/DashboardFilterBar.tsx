'use client';

import { Search, RotateCcw } from 'lucide-react';
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
import type { Customer, Order, Project, Status } from '@/lib/models';

interface DashboardFilterBarProps {
  filters: ExecutiveDashboardFilters;
  customers: Customer[];
  orders: Order[];
  projects: Project[];
  projectStatuses: Status[];
  onChange: (patch: Partial<ExecutiveDashboardFilters>) => void;
  onClear: () => void;
  onSearchOpen?: () => void;
}

const MAINTENANCE_STATUSES = [
  'open',
  'under_inspection',
  'under_repair',
  'resolved',
  'closed',
];

const CONFIG_STATUSES = ['repair', 'replace', 'reconfigure', 'no_action'];

export function DashboardFilterBar({
  filters,
  customers,
  orders,
  projects,
  projectStatuses,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
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

        <Select
          value={filters.project_status ?? 'all'}
          onValueChange={(v) =>
            onChange({ project_status: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Project Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Project Statuses</SelectItem>
            {projectStatuses.map((s) => (
              <SelectItem key={s.id} value={s.status_name}>
                {s.status_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.maintenance_status ?? 'all'}
          onValueChange={(v) =>
            onChange({ maintenance_status: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Maintenance Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Maintenance Statuses</SelectItem>
            {MAINTENANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.configuration_status ?? 'all'}
          onValueChange={(v) =>
            onChange({ configuration_status: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Config Resolution" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Config Types</SelectItem>
            {CONFIG_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* <Input
          type="date"
          value={filters.date_from?.slice(0, 10) ?? ''}
          onChange={(e) =>
            onChange({ date_from: e.target.value ? `${e.target.value}T00:00:00` : undefined })
          }
          placeholder="From date"
        />

        <Input
          type="date"
          value={filters.date_to?.slice(0, 10) ?? ''}
          onChange={(e) =>
            onChange({ date_to: e.target.value ? `${e.target.value}T23:59:59` : undefined })
          }
          placeholder="To date"
        /> */}

        <div className="relative sm:col-span-2 lg:col-span-1 xl:col-span-2">
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
