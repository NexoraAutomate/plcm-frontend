'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Pencil ,Search, UserRoundPen } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { Badge } from '@/components/ui/badge';
import { getProjectCountByOrderId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchOrdersPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { OrdersMiniDashboard } from '@/components/orders/orders-mini-dashboard';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';

type OrderForm = {
  order_number?: string
  title: string
  description?: string | null
  contract_number?: string | null
  po_number?: string | null
  order_date: string
  delivery_date?: string | null
  total_value?: number | null
  currency: string
  project_manager?: string | null
  remarks?: string | null

  customer_id?: number;
  status_id?: number;
  };
const emptyOrderForm: OrderForm = {
  order_number: '',
  title: '',
  description: '',
  contract_number: '',
  po_number: '',
  order_date: '',
  delivery_date: '',
  total_value: null,
  currency: '',
  project_manager: '',
  remarks: '',
  customer_id: undefined,
  status_id: undefined
};

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customers, projects, createOrder, updateOrder, deleteOrder } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<OrderForm>(emptyOrderForm);
  const { data: statuses = [] } = useStatusesByTypeQuery('orders');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsCreateOpen(true);
      router.replace('/orders', { scroll: false });
    }
  }, [searchParams, router]);

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusId: statusFilter !== 'all' ? Number(statusFilter) : null,
        customerId: customerFilter !== 'all' ? Number(customerFilter) : null,
      }),
    [debouncedSearch, statusFilter, customerFilter]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.ordersPage(listFilters),
    fetchPage: fetchOrdersPage,
    filters: listFilters,
  });
  const orders = pagination.items;
  const showLoader = useListPageLoader(pagination, {
    debouncedSearch,
    filtersActive: statusFilter !== 'all' || customerFilter !== 'all',
    hasData: orders.length > 0,
  });

  const projectCountByOrder = useMemo(
    () => getProjectCountByOrderId(projects),
    [projects]
  );

  const filteredCustomer = useMemo(
    () => (customerFilter === 'all' ? null : customers.find((c) => String(c.id) === customerFilter)),
    [customerFilter, customers]
  );

  async function handleCreate() {
    if (
      !formData.title.trim() ||
      !formData.order_date ||
      !formData.currency.trim() ||
      !formData.status_id
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await createOrder(formData);
      pagination.invalidate();

      setFormData(emptyOrderForm);
      setIsCreateOpen(false);

      // toast.success('Order created successfully');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;

    if (
      !formData.title.trim() ||
      !formData.order_date ||
      !formData.currency.trim() ||
      !formData.status_id
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await updateOrder(editingId, formData);
      pagination.invalidate();

      setFormData(emptyOrderForm);
      setEditingId(null);
      setIsEditOpen(false);

      // toast.success('Order updated successfully');
    } catch (error) {
      console.error(error);
    }
  }

  async function confirmDelete() {
    if (deleteConfirm.id === null) return;

    try {
      await deleteOrder(deleteConfirm.id);
      pagination.invalidate();
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteConfirm({ open: false, id: null });
    }
  }

  function openEdit(order: typeof orders[number]) {
    setEditingId(order.id);

    setFormData({
      order_number: order.order_number ?? '',
      title: order.title ?? '',
      description: order.description ?? '',
      contract_number: order.contract_number ?? '',
      po_number: order.po_number ?? '',
      order_date: order.order_date ?? '',
      delivery_date: order.delivery_date ?? '',
      total_value: order.total_value ?? null,
      currency: order.currency ?? '',
      project_manager: order.project_manager ?? '',
      remarks: order.remarks ?? '',
      customer_id: order.customer_id ?? undefined, // <-- Missing
      status_id: order.status_id ?? undefined,
    });

    setIsEditOpen(true);
  }


  if (showLoader) return <PageLoader />;

  if (pagination.error) {
    return (
      <ListPageError
        message={pagination.error instanceof Error ? pagination.error.message : undefined}
        onRetry={() => void pagination.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-2">Manage all orders</p>
      </div>

      <OrdersMiniDashboard
        orders={orders}
        projects={projects}
        customers={customers}
        orderStatuses={statuses}
        activeOrderStatusId={statusFilter}
        activeCustomerId={customerFilter}
        onOrderStatusFilter={setStatusFilter}
        onCustomerFilter={setCustomerFilter}
        totalCount={pagination.total}
      />

      {(statusFilter !== 'all' || customerFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter !== 'all' && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Status:{' '}
              <strong>{statuses.find((s) => String(s.id) === statusFilter)?.status_name}</strong>
            </span>
          )}
          {filteredCustomer && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Customer: <strong>{filteredCustomer.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setCustomerFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => ( 
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.status_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Can permission={P.create_orders}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Order
              </Button>
            </DialogTrigger>
          </Can>

          <DialogContent className="sm:max-w-190 p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="text-lg font-semibold">Create Order</DialogTitle>
              <DialogDescription>Enter order details below.</DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select
                    value={formData.customer_id?.toString() ?? ""}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        customer_id: Number(v),
                      })
                    }
                  >
                    <SelectTrigger id="customer" className="h-10">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                        {customers.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id.toString()}
                          >
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status_id?.toString()}
                    onValueChange={(v) =>
                      setFormData({ ...formData, status_id: parseInt(v, 10) })
                    }
                  >
                    <SelectTrigger id="status" className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.status_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Order title"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="min-h-22.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.description ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract_number">Contract Number</Label>
                  <Input
                    id="contract_number"
                    value={formData.contract_number ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, contract_number: e.target.value })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="po_number">PO Number</Label>
                  <Input
                    id="po_number"
                    value={formData.po_number ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, po_number: e.target.value })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order_date">Order Date</Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={formData.order_date}
                    onChange={(e) =>
                      setFormData({ ...formData, order_date: e.target.value })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_date: e.target.value })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_value">Total Value</Label>
                  <Input
                    id="total_value"
                    type="number"
                    value={formData.total_value ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_value: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    placeholder="USD / PKR / EUR"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="project_manager">Project Manager</Label>
                  <Input
                    id="project_manager"
                    value={formData.project_manager ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, project_manager: e.target.value })
                    }
                    className="h-10"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <textarea
                    id="remarks"
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.remarks ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            Showing {orders.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className='bg-slate-200 dark:bg-black hover:bg-slate-200'>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contract / PO</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const customer = customers.find((c) => c.id === order.customer_id);
                    const status = statuses.find((s) => s.id === order.status_id);
                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/projects?order_id=${order.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={order.order_number}
                            entityType="order"
                            entityId={order.id}
                            faultMap={faultMap}
                          />
                        </TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium">{order.title}</p>
                          {order.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-62.5">
                              {order.description}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {customer?.name || "N/A"}
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <p>{order.contract_number || "-"}</p>
                          <p className="text-muted-foreground">
                            {order.po_number || "-"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {order.total_value
                          ? `${order.currency} ${order.total_value.toLocaleString()}`
                          : "-"}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            status?. status_name === "Created"
                              ? "bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-100"
                              : status?.status_name === "Confirmed"
                              ? "bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-100"
                              : status?.status_name === "Processing"
                              ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100"
                              : status?.status_name === "Shipped"
                              ? "bg-violet-100 text-violet-800 border border-violet-300 hover:bg-violet-100"
                              : status?.status_name === "Delivered"
                              ? "bg-green-100 text-green-800 border border-green-300 hover:bg-green-100"
                              : status?.status_name === "Cancelled"
                              ? "bg-red-100 text-red-800 border border-red-300 hover:bg-red-100"
                              : "bg-gray-100 text-gray-700 border border-gray-300"
                          }
                        >
                          {order.status_name}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <EntityCountCell
                          count={getCount(projectCountByOrder, order.id)}
                          label="Total projects"
                        />
                      </TableCell>

                      <TableCell>
                        {order.delivery_date
                          ? new Date(order.delivery_date).toLocaleDateString()
                          : "-"}
                      </TableCell>

                      <TableCell>
                        {order.project_manager || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 text-accent">
                            <Can permission={P.edit_orders}>
                              <Pencil  className='w-4.5 text-accent-foreground hover:text-blue-600'
                                onClick={(e) => { e.stopPropagation(); openEdit(order); }}
                              />
                            </Can>
                            <Can permission={P.delete_orders}>
                              <Trash2 className='w-4.5 text-accent-foreground hover:text-red-600'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ open: true, id: order.id });
                                }}
                              />
                            </Can>
                        </div>
                      </TableCell>
                      </TableRow>   
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <EntityListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            rangeLabel={pagination.rangeLabel}
            hasPrev={pagination.hasPrev}
            hasNext={pagination.hasNext}
            onPrev={pagination.prevPage}
            onNext={pagination.nextPage}
            loading={pagination.fetching}
          />
        </CardContent>
      </Card>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-190 p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-lg font-semibold">
              Edit Order
            </DialogTitle>
            <DialogDescription>
              Update the order details below.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-5 md:grid-cols-2">

              {/* Customer */}
              <div className="space-y-2">
                <Label htmlFor="edit_customer">Customer</Label>

                <Select
                  value={formData.customer_id?.toString() ?? ""}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      customer_id: Number(v),
                    })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>

                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.id.toString()}
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              {/* <div className="space-y-2">
                <Label>Status</Label>

                <Select
                  value={formData.status_id?.toString() ?? ""}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      status_id: Number(v),
                    })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>

                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id.toString()}
                      >
                        {s.status_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}
              <div>
            <Label htmlFor="edit-status">Status</Label>
            {/* <select
              id="edit-status"
              value={formData.status || "active"}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="prospect">Prospect</option>
            </select> */}

            {/* <Select 
                value={formData.status}  
                onValueChange={(value) => setFormData((prev) => ({...prev, status: value}))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>

              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={getStatusValue(s)}>
                    {getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select> */}
            <Select
              value={formData.status_id?.toString() ?? ""}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  status_id: Number(v),
                })
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>

              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id.toString()}
                  >
                    {s.status_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Title</Label>

                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      title: e.target.value,
                    })
                  }
                />
              </div>

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>

                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.description ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              {/* Contract */}
              <div className="space-y-2">
                <Label>Contract Number</Label>

                <Input
                  value={formData.contract_number ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contract_number: e.target.value,
                    })
                  }
                />
              </div>

              {/* PO */}
              <div className="space-y-2">
                <Label>PO Number</Label>

                <Input
                  value={formData.po_number ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      po_number: e.target.value,
                    })
                  }
                />
              </div>

              {/* Order Date */}
              <div className="space-y-2">
                <Label>Order Date</Label>

                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order_date: e.target.value,
                    })
                  }
                />
              </div>

              {/* Delivery Date */}
              <div className="space-y-2">
                <Label>Delivery Date</Label>

                <Input
                  type="date"
                  value={formData.delivery_date ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delivery_date: e.target.value,
                    })
                  }
                />
              </div>

              {/* Total Value */}
              <div className="space-y-2">
                <Label>Total Value</Label>

                <Input
                  type="number"
                  value={formData.total_value ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      total_value:
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                    })
                  }
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>Currency</Label>

                <Input
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currency: e.target.value,
                    })
                  }
                />
              </div>

              {/* Project Manager */}
              <div className="space-y-2 md:col-span-2">
                <Label>Project Manager</Label>

                <Input
                  value={formData.project_manager ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      project_manager: e.target.value,
                    })
                  }
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label>Remarks</Label>

                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.remarks ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remarks: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleUpdate}>
              Update Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, open, id: open ? prev.id : null }))
        }
        title="Delete Order"
        description="Are you sure you want to delete this order? All related projects will also be deleted. This action cannot be undone."
        onConfirm={confirmDelete}
      />
      
    </div>
  );
}
