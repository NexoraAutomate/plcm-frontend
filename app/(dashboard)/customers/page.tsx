'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Edit,UserRoundPen ,Check,X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data-store';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchCustomersPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { toast } from 'sonner';
import { Customer } from '@/lib/models';
import * as Models from '@/lib/models';
import { getOrderCountByCustomerId, getProjectCountByCustomerId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { CustomersListDashboard } from '@/components/customers/customers-list-dashboard';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';

const emptyCustomerForm: CustomerForm = {
  customer_code: '',
  name: '',
  organization_type: '',
  primary_contact_name: '',
  email: '',
  phone: '',
  country: '',
  status_id: undefined,
};

type CustomerForm = {
  customer_code?: string;
  name: string;
  organization_type: string;
  primary_contact_name: string;
  email: string;
  phone: string;
  country: string;
  status_id?: number;
};

export default function CustomersPage() {
  const {
    orders,
    projects,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  } = useDataStore();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number| null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer| null>(null);
  const { data: statuses = [] } = useStatusesByTypeQuery('customers');
  const [formData, setFormData] = useState<CustomerForm>(emptyCustomerForm);
  const router = useRouter();

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusId: statusFilter !== 'all' ? Number(statusFilter) : null,
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.customersPage(listFilters),
    fetchPage: fetchCustomersPage,
    filters: listFilters,
  });
  const customers = pagination.items;
  const showLoader = useListPageLoader(pagination, {
    debouncedSearch,
    filtersActive: statusFilter !== 'all',
    hasData: customers.length > 0,
  });


  const getStatusValue = (status: Models.Status) => status.status_name ?? (status as any).status_name ?? String(status.id);
  const getStatusLabel = (status: Models.Status) => status.status_name ?? (status as any).status_name ?? 'Unknown';

  const resolveStatusValue = (status?: string) => {
    if (!status) return '';

    const normalized = status.toString().toLowerCase();
    const matched = statuses.find((s) => {
      const value = getStatusValue(s).toString().toLowerCase();
      const label = getStatusLabel(s).toLowerCase();
      return value === normalized || label === normalized || String(s.id) === normalized;
    });

    return matched ? getStatusValue(matched) : status;
  };
  const orderCountByCustomer = useMemo(
    () => getOrderCountByCustomerId(orders),
    [orders]
  );
  const projectCountByCustomer = useMemo(
    () => getProjectCountByCustomerId(orders, projects),
    [orders, projects]
  );

  const filteredStatusLabel = useMemo(
    () =>
      statusFilter === 'all'
        ? null
        : statuses.find((s) => String(s.id) === statusFilter)?.status_name,
    [statusFilter, statuses]
  );
  async function handleCreate() {
   if (!formData.name.trim() || !formData.status_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      console.log("formData  :", formData)
      await createCustomer(formData);
      pagination.invalidate();
      setFormData(emptyCustomerForm);
      setIsCreateOpen(false);
    } catch {
      // Error handled by DataStore
    }
  }

  const prepareDelete = (item: Customer) => {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  };

  async function handleDelete() {
    if (!deleteTarget) return;
    // if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteCustomer(deleteTarget.id);
      pagination.invalidate();
    } catch (err) {
      console.error("Failed to delete hierarchy item", err);
      toast.error("Failed to delete hierarchy item");
    }finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  }
  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    // console.log(customer.status.status_name);

    setFormData({
      customer_code: customer.customer_code || '',
      name: customer.name || '',
      organization_type: customer.organization_type || '',
      primary_contact_name: customer.primary_contact_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      country: customer.country || '',
      status_id: customer.status_id ?? undefined,
    });

    setIsEditOpen(true);
  };

  async function handleUpdate() {
    if (!editingId) return;

    if (!formData.name.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      console.log("Updating customer:", {
          id: editingId,
          payload: formData,
        });
      await updateCustomer(editingId, formData);
      pagination.invalidate();
      console.log('Current formData.status:', formData.status_id);

      setFormData({
        customer_code: '',
        name: '',
        organization_type: '',
        primary_contact_name: '',
        email: '',
        phone: '',
        country: '',
        status_id: undefined
,
      });

      setEditingId(null);
      setIsEditOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update customer');
    }
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
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-2">Manage your customer list</p>
      </div>

      <CustomersListDashboard
        customers={customers}
        orders={orders}
        projects={projects}
        customerStatuses={statuses}
        activeStatusId={statusFilter}
        onStatusFilter={setStatusFilter}
        totalCount={pagination.total}
      />

      {statusFilter !== 'all' && filteredStatusLabel && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border bg-muted px-3 py-1 text-sm">
            Status: <strong>{filteredStatusLabel}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
            Clear filter
          </Button>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, name, contact, email or phone..."
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
          <Can permission={P.create_customers}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent className="sm:max-w-150">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>
                Enter customer information.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
{/* Customer Name */}
                <div>
                  <Label htmlFor="name">Customer Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Customer name"
                  />
                </div>
{/* organization_type */}
                <div>
                  <Label htmlFor="organization_type">
                    Organization Type
                  </Label>
                  <Input
                    id="organization_type"
                    value={formData.organization_type || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        organization_type: e.target.value,
                      })
                    }
                    placeholder="Government / Private"
                  />
                </div>
{/* primary_contact_name */}
                <div>
                  <Label htmlFor="primary_contact_name">
                    Primary Contact
                  </Label>
                  <Input
                    id="primary_contact_name"
                    value={formData.primary_contact_name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primary_contact_name: e.target.value,
                      })
                    }
                    placeholder="Contact person"
                  />
                </div>
{/* Email */}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                    placeholder="customer@example.com"
                  />
                </div>
{/* Phone */}
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+92xxxxxxxxxx"
                  />
                </div>
{/* Country */}
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        country: e.target.value,
                      })
                    }
                    placeholder="Pakistan"
                  />
                </div>
{/* Status */}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status_id?.toString()}
                    onValueChange={(v) =>
                      setFormData({ ...formData, status_id: parseInt(v, 10) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.status_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    {/* <SelectContent>
                      {statuses.map((s) => {
                        const statusValue = s.status_name ?? (s as any).status_name ?? String(s.id);
                        const statusLabel = s.status_name ?? (s as any).status_name ?? 'Unknown';
                        console.log("statusValue", statusValue)
                        console.log("statusLabel", statusLabel)
                        console.log("statusID", s.id)
                        return (
                          <SelectItem key={s.id} value={statusValue}>
                            {statusLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent> */}
                  </Select>
                </div>
                
              </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>

              <Button onClick={handleCreate}>
                Create Customer
              </Button>
            </div>
          </DialogContent>
         
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            Showing {customers.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader  className='bg-slate-200 dark:bg-black hover:bg-slate-200'>
                <TableRow>
                  <SortableTableHead column="customer_code" sort={sort} onSort={cycleSort}>Code</SortableTableHead>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Customer</SortableTableHead>
                  <SortableTableHead column="primary_contact_name" sort={sort} onSort={cycleSort}>Contact</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <TableCell>{customer.customer_code}</TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          {customer.organization_type && (
                            <p className="text-xs text-muted-foreground">
                              {customer.organization_type}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          {customer.primary_contact_name && (
                            <p>{customer.primary_contact_name}</p>
                          )}

                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">
                              {customer.phone}
                            </p>
                          )}

                          {customer.email && (
                            <p className="text-xs text-muted-foreground">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* <TableCell>
                        <Badge
                          variant={
                            customer.status.status_name === "Active"
                              ? "default"
                              : customer.status.status_name === "Inactive"
                              ? "secondary"
                              : customer.status.status_name === "Blacklisted"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {customer.status.status_name}
                        </Badge>
                      </TableCell> */}

                      <TableCell>
                          <Badge
                            className={
                                  customer.status_name === "Active"
                                ? "bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-100"
                                : customer.status_name === "Inactive"
                                ? "bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-100"
                                : customer.status_name === "Blacklisted"
                                ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100"
                                : customer.status_name === "Prospect"
                                ? "bg-violet-100 text-violet-800 border border-violet-300 hover:bg-violet-100"
                                : "outline"
                              }
                          >
                            {customer.status_name}
                          </Badge>
                        </TableCell>
  
                      <TableCell>
                        <EntityCountCell
                          count={getCount(orderCountByCustomer, customer.id)}
                          label="Total orders"
                        />
                      </TableCell>
                      <TableCell>
                        <EntityCountCell
                          count={getCount(projectCountByCustomer, customer.id)}
                          label="Total projects"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 text-accent">
                              <Can permission={P.edit_customers}>
                                <UserRoundPen className='w-4.5 text-accent-foreground hover:text-blue-600'
                                onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(customer);}}
                              />
                              </Can>
                            <Can permission={P.delete_customers}>
                              <Trash2 className='w-4.5 text-accent-foreground hover:text-red-600'
                                onClick={(e) => {
                                      e.stopPropagation();
                                      prepareDelete(customer);}}
                              />
                            </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div>
            <Label htmlFor="edit-name">Customer Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Customer name"
            />
          </div>

          <div>
            <Label htmlFor="edit-org-type">Organization Type</Label>
            <Input
              id="edit-org-type"
              value={formData.organization_type || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  organization_type: e.target.value,
                })
              }
              placeholder="Government / Private / NGO"
            />
          </div>

          <div>
            <Label htmlFor="edit-contact-person">
              Primary Contact
            </Label>
            <Input
              id="edit-contact-person"
              value={formData.primary_contact_name || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  primary_contact_name: e.target.value,
                })
              }
              placeholder="Contact person name"
            />
          </div>

          <div>
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={formData.phone || ""}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+92 XXX XXXXXXX"
            />
          </div>

          <div>
            <Label htmlFor="edit-country">Country</Label>
            <Input
              id="edit-country"
              value={formData.country || ""}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              placeholder="Pakistan"
            />
          </div>

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
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(false)}
          >
            Cancel
                <X />
          </Button>

          <Button onClick={handleUpdate}>
            Update Customer
                <Check />
          </Button>
        </div>
      </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Confirm delete"
        description="Delete customer detail. This action cannot be undone."
        onConfirm={handleDelete}
      />

    </div>  
  );
}
