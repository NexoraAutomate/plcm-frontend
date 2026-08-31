'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { CircleArrowLeft } from 'lucide-react';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatValue(currency?: string, total?: number | null) {
  if (total == null) return '—';
  return `${currency || ''} ${total.toLocaleString()}`.trim();
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const faultMap = useEntityFaultMap();
  const { orders, customers, projects, loading } = useDataStore();

  const order = orders.find((entry) => entry.id === orderId);
  const customer = order ? customers.find((entry) => entry.id === order.customer_id) : null;
  const orderProjects = useMemo(
    () => (order ? projects.filter((project) => project.order_id === order.id) : []),
    [order, projects]
  );

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Order Not Found</h2>
        <Link href="/orders" className="mt-2 text-sm text-primary underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/orders">Orders</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{order.order_number || order.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <EntityNameWithFault
              name={order.order_number || order.title}
              entityType="order"
              entityId={order.id}
              faultMap={faultMap}
            />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{order.title}</p>
        </div>
        <Link href="/orders">
          <Button variant="ghost" className="gap-2 bg-muted/40">
            <CircleArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Contract and delivery information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={order.status_name || order.status?.status_name} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              {customer ? (
                <Link
                  href={`/customers/${customer.id}`}
                  className="mt-1 inline-block font-medium text-primary hover:underline"
                >
                  {customer.name}
                </Link>
              ) : (
                <p className="mt-1 font-medium">—</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Project Manager</p>
              <p className="mt-1 font-medium">{order.project_manager || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contract Number</p>
              <p className="mt-1 font-medium">{order.contract_number || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">PO Number</p>
              <p className="mt-1 font-medium">{order.po_number || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="mt-1 font-medium">{formatValue(order.currency, order.total_value)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="mt-1 font-medium">{formatDate(order.order_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="mt-1 font-medium">{formatDate(order.delivery_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="mt-1 font-medium">{formatDate(order.created_at)}</p>
            </div>
          </div>

          {order.description ? (
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1 text-sm">{order.description}</p>
            </div>
          ) : null}

          {order.remarks ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Remarks</p>
              <p className="mt-1 text-sm">{order.remarks}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {orderProjects.length} project{orderProjects.length === 1 ? '' : 's'} linked to this order
            </CardDescription>
          </div>
          {orderProjects.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects?order_id=${order.id}`)}
            >
              View in Projects
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {orderProjects.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center">
              <Can permission={[P.project_create_draft, P.create_projects]}>
                <Button onClick={() => router.push(`/projects?action=create&order_id=${order.id}`)}>
                  Create New Project
                </Button>
              </Can>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderProjects.map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={project.status_name} />
                      </TableCell>
                      <TableCell>{formatDate(project.start_date)}</TableCell>
                      <TableCell>{formatDate(project.end_date)}</TableCell>
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
