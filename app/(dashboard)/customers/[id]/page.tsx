'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CircleArrowLeft } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, Copy } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { Badge } from '@/components/ui/badge';
import { CustomerMiniDashboard } from '@/components/lazy/list-dashboards';
import {
  OrderFormDialog,
  emptyOrderForm,
  type OrderFormData,
} from '@/components/orders/order-form-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { validateOrderForm } from '@/lib/form-validation';
import { cloneOrderProjectsAsDrafts } from '@/lib/clone-order-projects';
import { useAuth } from '@/lib/auth-context';
import {
  ListStatsVisibilityControls,
  useListStatsVisibility,
} from '@/components/list-stats-visibility';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useClientTableSort } from '@/hooks/use-table-sorting';

export default function CustomerDetailPage(){
    const params = useParams();
    const router = useRouter();
    const customerID = params.id as string;
    const {
      customers,
      projects,
      deleteOrder,
      updateOrder,
      createOrder,
      systems,
      orders,
      loading,
      createSystem,
      deleteSystem,
      updateSystem,
      mergeProjectLocal,
      ensureHierarchyTypesLoaded,
    } = useDataStore();
    const { can } = useAuth();
    const { showStats, setShowStats } = useListStatsVisibility();
    const customer = customers.find((c) => String(c.id) === customerID);
    const customerOrders = customer? orders.filter((o) => o.customer_id === customer.id): [];
    const orderIds = new Set(customerOrders.map((o) => o.id));
    const customerProjects = projects.filter((p) => p.order_id != null && orderIds.has(p.order_id));
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [repeatSourceOrderId, setRepeatSourceOrderId] = useState<number | null>(null);
    const [formData, setFormData] = useState<OrderFormData>(emptyOrderForm);
    
    const [statuses, setStatuses] = useState<Models.Status[]>([]);
    const [loadingStatuses, setLoadingStatuses] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
      open: false,
      id: null,
    });
    const defaultStatusId = statuses.find(
      (status) => status.status_name.trim().toLowerCase() === 'created'
    )?.id;

    useEffect(() => {
      if (defaultStatusId === undefined || isEditOpen) return;
      setFormData((previous) =>
        previous.status_id === undefined
          ? { ...previous, status_id: defaultStatusId }
          : previous
      );
    }, [defaultStatusId, formData.status_id, isEditOpen]);
 
    const filtered = customerOrders.filter((o) => {
    const matchesSearch =
      !search.trim() ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status_id?.toString() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { sort, cycleSort, sortedRows } = useClientTableSort(filtered);


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

  async function handleCreate() {
    const validationError = orderValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const sourceOrderId = repeatSourceOrderId;

    try {
      const newOrder = await createOrder(sanitizeOrderPayload(formData));

      if (sourceOrderId != null && newOrder?.id) {
        if (!can(P.project_create_draft)) {
          toast.warning(
            'Order repeated, but draft projects were not cloned (missing create-draft permission).'
          );
        } else {
          try {
            const cloneResult = await cloneOrderProjectsAsDrafts(sourceOrderId, newOrder.id);
            cloneResult.created.forEach((project) => mergeProjectLocal(project));
            if (cloneResult.hierarchiesGenerated > 0) {
              await ensureHierarchyTypesLoaded(['systems'], { force: true });
            }
            if (cloneResult.created.length > 0) {
              toast.success(
                cloneResult.hierarchiesGenerated > 0
                  ? `Cloned ${cloneResult.created.length} project${
                      cloneResult.created.length === 1 ? '' : 's'
                    } with matching flight specs and generated systems.`
                  : `Cloned ${cloneResult.created.length} draft project${
                      cloneResult.created.length === 1 ? '' : 's'
                    } (same config, flights, and SDLS).`
              );
            } else if (cloneResult.skipped > 0 && cloneResult.errors.length === 0) {
              toast.message('Order repeated. Source order had no cloneable project specs.');
            }
            if (cloneResult.errors.length > 0) {
              toast.error(
                `Some projects failed to clone fully: ${cloneResult.errors.slice(0, 2).join('; ')}`
              );
            }
          } catch (cloneError) {
            console.error(cloneError);
            toast.error('Order created, but failed to clone draft projects from the source order.');
          }
        }
      }

      setRepeatSourceOrderId(null);
      setFormData({ ...emptyOrderForm, customer_id: customer?.id, status_id: defaultStatusId });
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
      customer_id: order.customer_id ?? customer?.id,
      status_id: defaultStatusId,
    });
    setIsCreateOpen(true);
  }
    
    useEffect(() => {
      const fetchData = async () => {
        try {
          const statusRes = await api.statuses.list('orders');
          setStatuses(statusRes.data);
        } catch (err) {
          console.error('Failed to fetch statuses', err);
        } finally {
          setLoadingStatuses(false);
        }
      };

      fetchData();
    }, []);

    
    if (!customer) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-xl font-semibold">Customer Not Found</h2>
          <Link href="/customers" className="mt-2 text-sm text-primary underline">
            Back to Customers
          </Link>
        </div>
      );
    }

    if (loading) return <PageLoader />;
    
        return (
    <div className="space-y-6">

        <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
            <BreadcrumbLink asChild>
                <Link href="/customers">Customers</Link>
            </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
            <BreadcrumbPage>{customer.name}</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col justify-between gap-4">
            <div className='flex flex-wrap justify-between items-center gap-3'>

                <div className=''>
                    <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage Customer Orders</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <ListStatsVisibilityControls
                    showStats={showStats}
                    onShowStatsChange={setShowStats}
                  />
                  <Link href="/customers" className='flex'>
                      <Button variant="ghost" className="gap-2 bg-muted/40">
                         <CircleArrowLeft className="h-4 w-4" />
                         Back
                      </Button>
                  </Link>
                </div>

            </div>

            {showStats && (
              <CustomerMiniDashboard
                customer={customer}
                orders={customerOrders}
                projects={customerProjects}
                orderStatuses={statuses}
                activeOrderStatusId={statusFilter}
                onOrderStatusFilter={setStatusFilter}
              />
            )}

            <div className="space-y-8">
            {/* <div>
                <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
                <p className="text-muted-foreground mt-2">Manage all orders</p>
            </div> */}

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
                        customer_id: customer.id,
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
                      setFormData({
                        ...emptyOrderForm,
                        customer_id: customer.id,
                        status_id: defaultStatusId,
                      });
                    }
                  }}
                  formData={formData}
                  onFormChange={setFormData}
                  customers={customers}
                  statuses={statuses}
                  onSubmit={handleCreate}
                  lockCustomer
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
                <CardDescription>Total: {filtered.length}</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="overflow-x-visible">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <SortableTableHead column="order_number" sort={sort} onSort={cycleSort}>
                          Order No.
                        </SortableTableHead>
                        <SortableTableHead column="title" sort={sort} onSort={cycleSort}>
                          Title
                        </SortableTableHead>
                        <SortableTableHead column="customer_id" sort={sort} onSort={cycleSort}>
                          Customer
                        </SortableTableHead>
                        <SortableTableHead column="contract_number" sort={sort} onSort={cycleSort}>
                          Contract / PO
                        </SortableTableHead>
                        <SortableTableHead column="total_value" sort={sort} onSort={cycleSort}>
                          Value
                        </SortableTableHead>
                        <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>
                          Status
                        </SortableTableHead>
                        <SortableTableHead column="delivery_date" sort={sort} onSort={cycleSort}>
                          Delivery
                        </SortableTableHead>
                        <SortableTableHead column="project_manager" sort={sort} onSort={cycleSort}>
                          PM
                        </SortableTableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No orders found
                            </TableCell>
                        </TableRow>
                        ) : (
                        sortedRows.map((order) => {
                            const customer = customers.find((c) => c.id === order.customer_id);
                            const status = statuses.find((s) => s.id === order.status_id);
                            return (
                            <TableRow
                              key={order.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                                <TableCell className="font-medium">
                                {order.order_number}
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
                                    status?.status_name === "Created"
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
                                {status?.status_name || "Unknown"}
                                </Badge>
                            </TableCell>
                            {/* <TableCell>
                                {status?.status_name || "N/A"}
                            </TableCell> */}

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
                </CardContent>
            </Card>
            
            <OrderFormDialog
              mode="edit"
              open={isEditOpen}
              onOpenChange={(open) => {
                setIsEditOpen(open);
                if (!open) {
                  setEditingId(null);
                  setFormData({
                    ...emptyOrderForm,
                    customer_id: customer?.id,
                    status_id: defaultStatusId,
                  });
                }
              }}
              formData={formData}
              onFormChange={setFormData}
              customers={customers}
              statuses={statuses}
              onSubmit={handleUpdate}
              lockCustomer
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

        </div>



    </div>
  );
}