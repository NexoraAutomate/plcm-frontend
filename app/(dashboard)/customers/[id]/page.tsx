'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CircleArrowLeft } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { Badge } from '@/components/ui/badge';
import { CustomerMiniDashboard } from '@/components/customers/customer-mini-dashboard';

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

export default function CustomerDetailPage(){
    const params = useParams();
    const customerID = params.id as string;
    const { customers, projects, deleteOrder, updateOrder, createOrder, systems, orders, loading, createSystem, deleteSystem, updateSystem } = useDataStore();
    const customer = customers.find((c) => String(c.id) === customerID);
    const customerOrders = customer? orders.filter((o) => o.customer_id === customer.id): [];
    const orderIds = new Set(customerOrders.map((o) => o.id));
    const customerProjects = projects.filter((p) => p.order_id != null && orderIds.has(p.order_id));
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<OrderForm>(emptyOrderForm);
    
    const [statuses, setStatuses] = useState<Models.Status[]>([]);
    const [loadingStatuses, setLoadingStatuses] = useState(true);
 
    const filtered = customerOrders.filter((o) => {
    const matchesSearch =
      !search.trim() ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status_id?.toString() === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

      setFormData(emptyOrderForm);
      setEditingId(null);
      setIsEditOpen(false);

      // toast.success('Order updated successfully');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete(id: number) {
    if (
      !confirm(
        'Are you sure you want to delete this order? All related Projects will also get deleted.'
      )
    )
      return;

    try {
      await deleteOrder(id);
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error(error);
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

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    
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
            <div className='flex  justify-between items-center'>

                <div className=''>
                    <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage Customer Orders</p>
                </div>
                
                <Link href="/customers" className='flex  w-1/12'>
                    <Button variant="ghost" size="icon" className=" w-full bg-mist-100">
                       <CircleArrowLeft className="flex " />Back
                    </Button>
                </Link>

            </div>
            
               

            <CustomerMiniDashboard
              customer={customer}
              orders={customerOrders}
              projects={customerProjects}
              orderStatuses={statuses}
              activeOrderStatusId={statusFilter}
              onOrderStatusFilter={setStatusFilter}
            />

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

                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                  setIsCreateOpen(open);
                  if (open && customer) {
                    setFormData((prev) => ({ ...prev, customer_id: customer.id }));
                  }
                }}>
                <DialogTrigger asChild>
                    <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Order
                    </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-190 p-0">
                    <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle className="text-lg font-semibold">Create Order</DialogTitle>
                    <DialogDescription>Enter order details below.</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                    <div className="grid gap-5 md:grid-cols-2">
                        {/* <div className="space-y-2">
                        <Label htmlFor="order_number">Order Number</Label>
                        <Input
                            id="order_number"
                            value={formData.order_number}
                            onChange={(e) =>
                            setFormData({ ...formData, order_number: e.target.value })
                            }
                            placeholder="ORD-001"
                            className="h-10"
                        />
                        </div> */}

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
                <CardDescription>Total: {filtered.length}</CardDescription>
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
                        <TableHead>Delivery</TableHead>
                        <TableHead>PM</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No orders found
                            </TableCell>
                        </TableRow>
                        ) : (
                        filtered.map((order) => {
                            const customer = customers.find((c) => c.id === order.customer_id);
                            const status = statuses.find((s) => s.id === order.status_id);
                            return (
                            <TableRow key={order.id} >
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
                                    <Pencil  className='w-4.5 text-accent-foreground hover:text-blue-600'
                                    onClick={() => openEdit(order)}
                                    />
                                    |
                                    <Trash2 className='w-4.5 text-accent-foreground hover:text-red-600'
                                    onClick={() => handleDelete(order.id)}
                                    />
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
                    <div className="space-y-2">
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
            
            </div>

        </div>



    </div>
  );
}