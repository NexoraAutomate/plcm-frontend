'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CircleArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import * as Models from '@/lib/models';
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
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useClientTableSort } from '@/hooks/use-table-sorting';
import {
  OrderFormDialog,
  emptyOrderForm,
  type OrderFormData,
} from '@/components/orders/order-form-dialog';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { coerceOptionalNumber, validateOrderForm } from '@/lib/form-validation';

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

function orderToFormData(order: Models.Order): OrderFormData {
  return {
    order_number: order.order_number ?? '',
    title: order.title ?? '',
    description: order.description ?? '',
    contract_number: order.contract_number ?? '',
    po_number: order.po_number ?? '',
    order_date: order.order_date ?? '',
    delivery_date: order.delivery_date ?? '',
    production_support_date: order.production_support_date ?? '',
    total_value: coerceOptionalNumber(order.total_value),
    currency: order.currency ?? 'PKR',
    project_manager: order.project_manager ?? '',
    remarks: order.remarks ?? '',
    customer_id: order.customer_id ?? undefined,
    status_id: order.status_id ?? undefined,
  };
}

function sanitizeOrderPayload(data: OrderFormData): OrderFormData {
  const blankToNull = (value?: string | null) => {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  };
  return {
    ...data,
    description: blankToNull(data.description),
    contract_number: blankToNull(data.contract_number),
    po_number: blankToNull(data.po_number),
    delivery_date: blankToNull(data.delivery_date),
    production_support_date: blankToNull(data.production_support_date),
    project_manager: blankToNull(data.project_manager),
    remarks: blankToNull(data.remarks),
    total_value: coerceOptionalNumber(data.total_value),
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = Number(params.id);
  const faultMap = useEntityFaultMap();
  const { orders, customers, projects, loading, getOrder, updateOrder } = useDataStore();
  const { data: statuses = [] } = useStatusesByTypeQuery('orders');

  const storeOrder = useMemo(
    () => (Number.isFinite(orderId) ? orders.find((entry) => entry.id === orderId) : undefined),
    [orders, orderId]
  );
  const [fetchedOrder, setFetchedOrder] = useState<Models.Order | null>(null);
  const [fetchingOrder, setFetchingOrder] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>(emptyOrderForm);
  const [submitting, setSubmitting] = useState(false);

  const order = storeOrder ?? fetchedOrder;
  const customer = order ? customers.find((entry) => entry.id === order.customer_id) : null;
  const orderProjects = useMemo(
    () => (order ? projects.filter((project) => project.order_id === order.id) : []),
    [order, projects]
  );
  const { sort, cycleSort, sortedRows: sortedOrderProjects } = useClientTableSort(orderProjects);

  useEffect(() => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setFetchedOrder(null);
      setFetchFailed(true);
      setFetchingOrder(false);
      return;
    }
    if (storeOrder) {
      setFetchedOrder(null);
      setFetchFailed(false);
      setFetchingOrder(false);
      return;
    }
    if (loading) return;

    let cancelled = false;
    setFetchingOrder(true);
    setFetchFailed(false);
    getOrder(orderId)
      .then((result) => {
        if (!cancelled) setFetchedOrder(result);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedOrder(null);
          setFetchFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingOrder(false);
      });

    return () => {
      cancelled = true;
    };
    // getOrder is recreated each render; key on orderId / store presence only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, storeOrder, loading]);

  function openEdit(target: Models.Order) {
    setFormData(orderToFormData(target));
    setIsEditOpen(true);
  }

  useEffect(() => {
    if (searchParams.get('action') !== 'edit' || !order) return;
    setFormData(orderToFormData(order));
    setIsEditOpen(true);
    router.replace(`/orders/${order.id}`, { scroll: false });
  }, [searchParams, order, router]);

  async function handleUpdate() {
    if (!order) return;

    const validationError = validateOrderForm({
      title: formData.title,
      orderDate: formData.order_date,
      currency: formData.currency,
      statusId: formData.status_id,
      customerId: formData.customer_id,
      deliveryDate: formData.delivery_date,
      productionSupportDate: formData.production_support_date,
      totalValue: formData.total_value,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateOrder(order.id, sanitizeOrderPayload(formData));
      setFetchedOrder(updated);
      setFormData(emptyOrderForm);
      setIsEditOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || fetchingOrder) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!order || fetchFailed) {
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
        <div className="flex items-center gap-2">
          <Can permission={P.edit_orders}>
            <Button variant="outline" className="gap-2" onClick={() => openEdit(order)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Can>
          <Link href="/orders">
            <Button variant="ghost" className="gap-2 bg-muted/40">
              <CircleArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
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
                <StatusBadge
                  status={order.status_name || order.status?.status_name || 'Unknown'}
                />
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
              <p className="text-sm text-muted-foreground">Production Support</p>
              <p className="mt-1 font-medium">{formatDate(order.production_support_date)}</p>
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
            <div className="overflow-x-visible">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead column="name" sort={sort} onSort={cycleSort}>
                      Name
                    </SortableTableHead>
                    <SortableTableHead column="status_name" sort={sort} onSort={cycleSort}>
                      Status
                    </SortableTableHead>
                    <SortableTableHead column="start_date" sort={sort} onSort={cycleSort}>
                      Start
                    </SortableTableHead>
                    <SortableTableHead column="end_date" sort={sort} onSort={cycleSort}>
                      End
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrderProjects.map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={project.status_name || 'Unknown'} />
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

      <OrderFormDialog
        mode="edit"
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setFormData(emptyOrderForm);
        }}
        formData={formData}
        onFormChange={setFormData}
        customers={customers}
        statuses={statuses}
        onSubmit={handleUpdate}
        submitting={submitting}
      />
    </div>
  );
}
