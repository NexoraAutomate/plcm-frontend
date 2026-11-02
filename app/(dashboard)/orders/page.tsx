'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Plus, Trash2, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
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
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { OrdersMiniDashboard } from '@/components/lazy/list-dashboards';
import {
  OrderFormDialog,
  emptyOrderForm,
  type OrderFormData,
} from '@/components/orders/order-form-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import { useColumnVisibility, type ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { validateOrderForm } from '@/lib/form-validation';
import { cloneOrderProjectsAsDrafts } from '@/lib/clone-order-projects';
import { useAuth } from '@/lib/auth-context';
import {
  ListStatsVisibilityControls,
  useListStatsVisibility,
} from '@/components/list-stats-visibility';

const COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'order_number', label: 'Order No.', alwaysVisible: true },
  { id: 'title', label: 'Title' },
  { id: 'customer_id', label: 'Customer' },
  { id: 'contract_number', label: 'Contract / PO' },
  { id: 'total_value', label: 'Value' },
  { id: 'status_id', label: 'Status' },
  { id: 'projects', label: 'Projects' },
  { id: 'delivery_date', label: 'Delivery' },
  { id: 'production_support_date', label: 'Prod. Support' },
  { id: 'project_manager', label: 'PM' },
];

export default function OrdersPage() {
  const { showStats, setShowStats } = useListStatsVisibility();
  const { visibleIds, isVisible, toggleColumn, resetColumns } = useColumnVisibility('orders-list', COLUMN_DEFS);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customers, projects, createOrder, updateOrder, deleteOrder, mergeProjectLocal } =
    useDataStore();
  const { can } = useAuth();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [repeatSourceOrderId, setRepeatSourceOrderId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<OrderFormData>(emptyOrderForm);
  const { data: statuses = [] } = useStatusesByTypeQuery('orders');
  const defaultStatusId = statuses.find(
    (status) => status.status_name.trim().toLowerCase() === 'created'
  )?.id;
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setRepeatSourceOrderId(null);
      setFormData((previous) => ({
        ...emptyOrderForm,
        status_id: previous.status_id ?? defaultStatusId,
        currency: previous.currency || 'PKR',
      }));
      setIsCreateOpen(true);
      router.replace('/orders', { scroll: false });
    }
  }, [searchParams, router, defaultStatusId]);

  useEffect(() => {
    if (defaultStatusId === undefined || isEditOpen) return;
    setFormData((previous) =>
      previous.status_id === undefined
        ? { ...previous, status_id: defaultStatusId }
        : previous
    );
  }, [defaultStatusId, formData.status_id, isEditOpen]);

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function orderValidationError() {
    return validateOrderForm({
      title: formData.title,
      orderDate: formData.order_date,
      currency: formData.currency,
      statusId: formData.status_id,
      customerId: formData.customer_id,
      deliveryDate: formData.delivery_date,
      productionSupportDate: formData.production_support_date,
      totalValue: formData.total_value,
    });
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
    };
  }

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusId: statusFilter !== 'all' ? Number(statusFilter) : null,
        customerId: customerFilter !== 'all' ? Number(customerFilter) : null,
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, customerFilter, listFilterPatch]
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
    const validationError = orderValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const sourceOrderId = repeatSourceOrderId;

    try {
      const newOrder = await createOrder(sanitizeOrderPayload(formData));
      pagination.invalidate();

      if (sourceOrderId != null && newOrder?.id) {
        if (!can(P.project_create_draft)) {
          toast.warning(
            'Order repeated, but draft projects were not cloned (missing create-draft permission).'
          );
        } else {
          try {
            const cloneResult = await cloneOrderProjectsAsDrafts(sourceOrderId, newOrder.id);
            cloneResult.created.forEach((project) => mergeProjectLocal(project));
            if (cloneResult.created.length > 0) {
              toast.success(
                `Cloned ${cloneResult.created.length} draft project${
                  cloneResult.created.length === 1 ? '' : 's'
                } (same config, flights, and SDLS).`
              );
            } else if (cloneResult.skipped > 0 && cloneResult.errors.length === 0) {
              toast.message('Order repeated. Source order had no cloneable project specs.');
            }
            if (cloneResult.errors.length > 0) {
              toast.error(
                `Some draft projects failed to clone: ${cloneResult.errors.slice(0, 2).join('; ')}`
              );
            }
          } catch (cloneError) {
            console.error(cloneError);
            toast.error('Order created, but failed to clone draft projects from the source order.');
          }
        }
      }

      setRepeatSourceOrderId(null);
      setFormData({ ...emptyOrderForm, status_id: defaultStatusId });
      setIsCreateOpen(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;

    const validationError = orderValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await updateOrder(editingId, sanitizeOrderPayload(formData));
      pagination.invalidate();

      setFormData({ ...emptyOrderForm, status_id: defaultStatusId });
      setEditingId(null);
      setIsEditOpen(false);
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
      production_support_date: order.production_support_date ?? '',
      total_value: order.total_value ?? null,
      currency: order.currency ?? 'PKR',
      project_manager: order.project_manager ?? '',
      remarks: order.remarks ?? '',
      customer_id: order.customer_id ?? undefined,
      status_id: order.status_id ?? undefined,
    });

    setIsEditOpen(true);
  }

  function openRepeat(order: typeof orders[number]) {
    const baseTitle = (order.title ?? '').trim();
    setEditingId(null);
    setIsEditOpen(false);
    setRepeatSourceOrderId(order.id);
    setFormData({
      order_number: '',
      title: baseTitle
        ? baseTitle.toLowerCase().endsWith('(repeat)')
          ? baseTitle
          : `${baseTitle} (Repeat)`
        : 'Repeat Order',
      description: order.description ?? '',
      contract_number: order.contract_number ?? '',
      po_number: order.po_number ?? '',
      order_date: todayIsoDate(),
      delivery_date: order.delivery_date ?? '',
      production_support_date: order.production_support_date ?? '',
      total_value: order.total_value ?? null,
      currency: order.currency ?? 'PKR',
      project_manager: order.project_manager ?? '',
      remarks: order.remarks ?? '',
      customer_id: order.customer_id ?? undefined,
      status_id: defaultStatusId,
    });
    setIsCreateOpen(true);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-2">Manage all orders</p>
        </div>
        <ListStatsVisibilityControls
          showStats={showStats}
          onShowStatsChange={setShowStats}
          onRefresh={pagination.refetch}
        />
      </div>

      {showStats && (
        <ListContentSuspense loading={pagination.fetching}>
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
        </ListContentSuspense>
      )}

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

        <Can permission={P.create_orders}>
          <Button
            className="gap-2"
            onClick={() => {
              setRepeatSourceOrderId(null);
              setFormData({
                ...emptyOrderForm,
                status_id: defaultStatusId,
                order_date: todayIsoDate(),
              });
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Order
          </Button>
        </Can>
        <OrderFormDialog
          mode="create"
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setRepeatSourceOrderId(null);
              setFormData({ ...emptyOrderForm, status_id: defaultStatusId });
            }
          }}
          formData={formData}
          onFormChange={setFormData}
          customers={customers}
          statuses={statuses}
          onSubmit={handleCreate}
          titleOverride={repeatSourceOrderId != null ? 'Repeat Order' : undefined}
          descriptionOverride={
            repeatSourceOrderId != null
              ? 'Commercial terms are prefilled. Linked projects will be cloned as Draft with the same configuration, flights, and SDLS counts. Further workflow steps stay manual.'
              : undefined
          }
        />
    </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            Showing {orders.length} on this page · {pagination.total} matching
          </CardDescription>
          <CardAction>
            <ColumnVisibilityMenu
              columns={COLUMN_DEFS}
              visibleIds={visibleIds}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <div className="overflow-x-visible">
            <Table>
              <TableHeader>
                <TableRow>
                  {isVisible('order_number') && (
                    <SortableTableHead column="order_number" sort={sort} onSort={cycleSort}>Order No.</SortableTableHead>
                  )}
                  {isVisible('title') && (
                    <SortableTableHead column="title" sort={sort} onSort={cycleSort}>Title</SortableTableHead>
                  )}
                  {isVisible('customer_id') && (
                    <SortableTableHead column="customer_id" sort={sort} onSort={cycleSort}>Customer</SortableTableHead>
                  )}
                  {isVisible('contract_number') && (
                    <SortableTableHead column="contract_number" sort={sort} onSort={cycleSort}>Contract / PO</SortableTableHead>
                  )}
                  {isVisible('total_value') && (
                    <SortableTableHead column="total_value" sort={sort} onSort={cycleSort}>Value</SortableTableHead>
                  )}
                  {isVisible('status_id') && (
                    <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  )}
                  {isVisible('projects') && <TableHead>Projects</TableHead>}
                  {isVisible('delivery_date') && (
                    <SortableTableHead column="delivery_date" sort={sort} onSort={cycleSort}>Delivery</SortableTableHead>
                  )}
                  {isVisible('production_support_date') && (
                    <TableHead>Prod. Support</TableHead>
                  )}
                  {isVisible('project_manager') && (
                    <SortableTableHead column="project_manager" sort={sort} onSort={cycleSort}>PM</SortableTableHead>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleIds.length + 1} className="text-center text-muted-foreground py-8">
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
                        {isVisible('order_number') && (
                          <TableCell className="font-medium">
                            <EntityNameWithFault
                              name={order.order_number}
                              entityType="order"
                              entityId={order.id}
                              faultMap={faultMap}
                            />
                          </TableCell>
                        )}

                      {isVisible('title') && (
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
                      )}

                      {isVisible('customer_id') && (
                        <TableCell>
                          {customer?.name || "N/A"}
                        </TableCell>
                      )}

                      {isVisible('contract_number') && (
                        <TableCell>
                          <div className="text-sm">
                            <p>{order.contract_number || "-"}</p>
                            <p className="text-muted-foreground">
                              {order.po_number || "-"}
                            </p>
                          </div>
                        </TableCell>
                      )}

                      {isVisible('total_value') && (
                        <TableCell>
                          {order.total_value
                            ? `${order.currency} ${order.total_value.toLocaleString()}`
                            : "-"}
                        </TableCell>
                      )}

                      {isVisible('status_id') && (
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
                      )}

                      {isVisible('projects') && (
                        <TableCell>
                          <EntityCountCell
                            count={getCount(projectCountByOrder, order.id)}
                            label="Total projects"
                          />
                        </TableCell>
                      )}

                      {isVisible('delivery_date') && (
                        <TableCell>
                          {order.delivery_date
                            ? new Date(order.delivery_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      )}

                      {isVisible('production_support_date') && (
                        <TableCell>
                          {order.production_support_date
                            ? new Date(order.production_support_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      )}

                      {isVisible('project_manager') && (
                        <TableCell>
                          {order.project_manager || "-"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 text-accent">
                            <Can permission={P.create_orders}>
                              <button
                                type="button"
                                title="Repeat order"
                                className="inline-flex"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRepeat(order);
                                }}
                              >
                                <Copy className="w-4.5 text-accent-foreground hover:text-emerald-600" />
                              </button>
                            </Can>
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
          </ListContentSuspense>
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
      
      <OrderFormDialog
        mode="edit"
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ ...emptyOrderForm, status_id: defaultStatusId });
          }
        }}
        formData={formData}
        onFormChange={setFormData}
        customers={customers}
        statuses={statuses}
        onSubmit={handleUpdate}
      />

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
