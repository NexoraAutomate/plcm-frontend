# Copy-Paste Code Examples

These are ready-to-use templates for implementing the next entity pages.

---

## Example 1: Systems List Page

**File to create**: `app/(dashboard)/systems/page.tsx`

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Plus, Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import Link from 'next/link';

export default function SystemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { systems, loading, createSystem, updateSystem, deleteSystem, getEntityMaintenanceLogs } = useDataStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [statuses, setStatuses] = useState<Models.Status[]>([]);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await api.statuses.list('systems');
        setStatuses(res.data);
      } catch (err) {
        console.error('Failed to fetch statuses', err);
      }
    };
    fetchStatuses();
  }, []);

  const filtered = systems.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status?.name === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Systems</h1>
        <p className="text-muted-foreground mt-2">Manage satellite systems and their subsystems</p>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status Overview</CardTitle>
          <CardDescription>Click to filter by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setStatusFilter('all');
                router.push('/dashboard/systems');
              }}
              className="text-left cursor-pointer transition-transform hover:scale-105"
            >
              <Card className="hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">All Systems</p>
                      <p className="text-2xl font-bold">{systems.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
            
            {['Design', 'Development', 'Testing', 'Operational', 'Retired'].map((status) => {
              const count = systems.filter(s => s.status?.name === status).length;
              const icons: Record<string, any> = {
                'Design': Clock,
                'Development': Zap,
                'Testing': AlertTriangle,
                'Operational': CheckCircle,
                'Retired': Clock,
              };
              const Icon = icons[status] || Clock;
              
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    router.push(`/dashboard/systems?status=${encodeURIComponent(status)}`);
                  }}
                  className={`text-left cursor-pointer transition-transform hover:scale-105`}
                >
                  <Card className={`hover:shadow-lg ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{status}</p>
                          <p className="text-2xl font-bold">{count}</p>
                        </div>
                        <Icon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search systems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table would go here - use EntityTable component */}
      <Card>
        <CardHeader>
          <CardTitle>All Systems</CardTitle>
          <CardDescription>Total: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {filtered.length} system(s) found
          </p>
          {/* TODO: Implement with EntityTable component */}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Example 2: System Detail Page

**File to create**: `app/(dashboard)/systems/[id]/page.tsx`

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDataStore } from '@/lib/data-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Plus } from 'lucide-react';
import * as Models from '@/lib/models';

export default function SystemDetailPage() {
  const { id } = useParams();
  const systemId = parseInt(id as string);
  
  const { 
    systems, 
    getSystemSubsystems,
    deleteSubsystem,
    getEntityMaintenanceLogs,
  } = useDataStore();

  const system = systems.find(s => s.id === systemId);
  const [subsystems, setSubsystems] = useState<Models.Subsystem[]>([]);
  const [loadingSubsystems, setLoadingSubsystems] = useState(false);

  useEffect(() => {
    const loadSubsystems = async () => {
      try {
        setLoadingSubsystems(true);
        const subs = await getSystemSubsystems(systemId);
        setSubsystems(subs);
      } finally {
        setLoadingSubsystems(false);
      }
    };
    loadSubsystems();
  }, [systemId, getSystemSubsystems]);

  if (!system) {
    return <div className="p-8 text-center">System not found</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{system.name}</h1>
        <p className="text-muted-foreground">{system.description}</p>
      </div>

      {/* System Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{system.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={system.status?.name || 'Unknown'} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(system.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subsystems Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Subsystems</CardTitle>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Subsystem
          </Button>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement with EntityTable component */}
          <p className="text-sm text-muted-foreground">
            {subsystems.length} subsystem(s)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Example 3: Using EntityTable in a Page

**Shows how to integrate the EntityTable component:**

```tsx
import { EntityTable } from '@/components/entity-table';
import { StatusBadge } from '@/components/status-badge';

// In your component:

const columns = [
  { 
    key: 'name', 
    label: 'Name' 
  },
  { 
    key: 'status', 
    label: 'Status', 
    render: (status) => <StatusBadge status={status?.name || 'Unknown'} /> 
  },
  { 
    key: 'created_at', 
    label: 'Created',
    render: (date) => new Date(date).toLocaleDateString()
  },
];

return (
  <EntityTable
    columns={columns}
    data={filtered}
    entityName="System"
    onView={(item) => router.push(`/dashboard/systems/${item.id}`)}
    onEdit={(item) => console.log('Edit', item)}
    onDelete={(item) => deleteSystem(item.id)}
    getMaintenanceLogs={getEntityMaintenanceLogs}
    isLoading={loading}
  />
);
```

---

## Example 4: Inventory Sync Pattern

**For adding and deleting child entities:**

```tsx
async function handleAddSubsystem(selectedInventoryId: number) {
  try {
    // 1. Create subsystem linked to parent system
    const newSubsystem = await createSubsystem({
      system_id: systemId,
      // other required fields...
    });

    // 2. Decrease inventory quantity
    const inventory = inventoryItems.find(i => i.id === selectedInventoryId);
    if (inventory) {
      await updateInventoryItem(selectedInventoryId, {
        quantity: inventory.quantity - 1,
      });
    }

    // Reload subsystems list
    const updated = await getSystemSubsystems(systemId);
    setSubsystems(updated);
  } catch (error) {
    console.error('Failed to add subsystem', error);
  }
}

async function handleDeleteSubsystem(subsystemId: number, inventoryId?: number) {
  try {
    // 1. Delete subsystem
    await deleteSubsystem(subsystemId);

    // 2. Increase inventory quantity
    if (inventoryId) {
      const inventory = inventoryItems.find(i => i.id === inventoryId);
      if (inventory) {
        await updateInventoryItem(inventoryId, {
          quantity: inventory.quantity + 1,
        });
      }
    }

    // Reload subsystems list
    const updated = await getSystemSubsystems(systemId);
    setSubsystems(updated);
  } catch (error) {
    console.error('Failed to delete subsystem', error);
  }
}
```

---

## Example 5: Maintenance Log Dialog

**For adding/editing maintenance logs:**

```tsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
const [maintenanceForm, setMaintenanceForm] = useState({
  notes: '',
  performed_by: '',
  status: 'Open',
});

async function handleAddMaintenance() {
  try {
    await createMaintenanceLog({
      entity_id: systemId,
      notes: maintenanceForm.notes,
      performed_by: maintenanceForm.performed_by,
      performed_at: new Date().toISOString(),
      status: maintenanceForm.status,
    });
    
    setIsMaintenanceOpen(false);
    setMaintenanceForm({ notes: '', performed_by: '', status: 'Open' });
  } catch (error) {
    console.error('Failed to add maintenance log', error);
  }
}

return (
  <>
    <Dialog open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Maintenance Log</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Notes</Label>
            <Input
              value={maintenanceForm.notes}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
              placeholder="Maintenance notes..."
            />
          </div>
          <div>
            <Label>Performed By</Label>
            <Input
              value={maintenanceForm.performed_by}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })}
              placeholder="Engineer name..."
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setIsMaintenanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMaintenance}>
              Add Log
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
```

---

## Example 6: Filter by Status from URL

**Handling status query parameters:**

```tsx
import { useSearchParams } from 'next/navigation';

const MyPage = () => {
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get('status'); // Get ?status=Planning
  const [statusFilter, setStatusFilter] = useState<string>(statusFromUrl || 'all');

  const filtered = items.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status?.name === statusFilter;
  });

  // When you want to update the filter:
  const handleStatusClick = (newStatus: string) => {
    setStatusFilter(newStatus);
    if (newStatus === 'all') {
      router.push('/dashboard/items');
    } else {
      router.push(`/dashboard/items?status=${encodeURIComponent(newStatus)}`);
    }
  };

  return (
    // Your component...
  );
};
```

---

## Example 7: Mini Dashboard Card

**Reusable status breakdown card:**

```tsx
<button
  onClick={() => {
    setStatusFilter(statusName);
    router.push(`/dashboard/systems?status=${encodeURIComponent(statusName)}`);
  }}
  className={`text-left cursor-pointer transition-transform hover:scale-105`}
>
  <Card className={`hover:shadow-lg ${statusFilter === statusName ? 'ring-2 ring-primary' : ''}`}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{statusName}</p>
          <p className="text-2xl font-bold">{countByStatus(statusName)}</p>
        </div>
        <IconComponent className="h-8 w-8 text-muted-foreground" />
      </div>
    </CardContent>
  </Card>
</button>
```

---

## Next Steps

1. Choose which entity to implement next (Systems is recommended)
2. Create the list page using Example 1 as template
3. Create the detail page using Example 2 as template
4. Integrate EntityTable component (Example 3)
5. Implement inventory sync if needed (Example 4)
6. Test navigation and filtering

All examples follow the established patterns and use the DataStore for state management.
