'use client';

import { useState,useEffect, useMemo } from 'react';
import { Search, Plus, Edit,UserRoundPen ,Check,X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';


import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useDataStore } from '@/lib/data-store';
import { toast } from 'sonner';
import { Customer } from '@/lib/models';
import { stringify } from 'querystring';
import * as Models from '@/lib/models';
import * as api from '@/lib/api';
import { getOrderCountByCustomerId, getProjectCountByCustomerId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { CustomersListDashboard } from '@/components/customers/customers-list-dashboard';

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
  const { customers, orders, projects, loading, createCustomer, updateCustomer, deleteCustomer } = useDataStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number| null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer| null>(null);
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [formData, setFormData] = useState<CustomerForm>(emptyCustomerForm);
  const router = useRouter();


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

  const filtered = customers.filter((c) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      c.customer_code?.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.primary_contact_name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term);
    const matchesStatus =
      statusFilter === 'all' || c.status_id?.toString() === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  useEffect(() => {
        const fetchStatuses = async () => {
          try {
            const [statusRes] = await Promise.all([
              api.statuses.list("customers"),
            ]);
            console.log("FetchResponse", statusRes)
            setStatuses(statusRes.data);
          } catch (err) {
            console.error("Failed to fetch statuses or hierarchy names", err);
          } finally {
          }
        };
  
        fetchStatuses();
      }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

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
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
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
          <CardDescription>Total: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader  className='bg-slate-200 dark:bg-black hover:bg-slate-200'>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((customer) => (
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
                              <UserRoundPen className='w-4.5 text-accent-foreground hover:text-blue-600'
                              onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(customer);}}
                            />
                            
                            |
                            <Trash2 className='w-4.5 text-accent-foreground hover:text-red-600'
                              onClick={(e) => {
                                    e.stopPropagation();
                                    prepareDelete(customer);}}
                            />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              Delete Customer detail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete()}>
                Delete
                <Trash2 />
              </Button>
               
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>  
  );
}
