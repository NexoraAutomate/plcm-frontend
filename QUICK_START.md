# SatLife Dashboard - Quick Start Guide

## What Was Enhanced

The SatLife dashboard now includes:

1. **Clickable KPI Dashboard** - Main dashboard with 4 clickable cards that navigate to key sections
2. **Project Status Breakdown** - 6 status cards showing project distribution (Initiation, Planning, Execution, Monitoring, Completed, On Hold)
3. **Expandable Maintenance Logs** - Projects page now shows maintenance logs when you expand rows
4. **Reusable Components** - New components for building hierarchical entity pages

---

## Files You Need to Know

### Core Components
- `components/entity-table.tsx` - Universal table component with expandable rows
- `components/maintenance-table.tsx` - Maintenance logs display
- `components/entity-mini-dashboard.tsx` - Status breakdown dashboard
- `components/expandable-row.tsx` - Reusable expandable row

### Pages
- `app/(dashboard)/dashboard/page.tsx` - Main dashboard (UPDATED)
- `app/(dashboard)/projects/page.tsx` - Projects list (UPDATED with status filter & mini dashboard)
- `app/(dashboard)/projects/[id]/page.tsx` - Project detail page (needs implementation)
- Similar pattern for: systems, subsystems, modules, units, components

### Infrastructure
- `lib/data-store.tsx` - State management (updated with maintenance log CRUD)
- `lib/api.ts` - API endpoints

---

## How to Use EntityTable Component

```tsx
import { EntityTable } from '@/components/entity-table';

const MyEntityPage = () => {
  const { systems, createSystem, updateSystem, deleteSystem, getEntityMaintenanceLogs } = useDataStore();
  const router = useRouter();

  // Define what columns to show
  const columns = [
    { key: 'name', label: 'Name' },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val) => <StatusBadge status={val?.name} /> 
    },
    { key: 'created_at', label: 'Created', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <EntityTable
      columns={columns}
      data={systems}
      entityName="System"
      onView={(item) => router.push(`/dashboard/systems/${item.id}`)}
      onEdit={(item) => openEditDialog(item)}
      onDelete={(item) => deleteSystem(item.id)}
      getMaintenanceLogs={getEntityMaintenanceLogs}
      isLoading={loading}
    />
  );
};
```

---

## How to Implement a Detail Page

Create `app/(dashboard)/systems/[id]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { EntityTable } from '@/components/entity-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';

export default function SystemDetailPage() {
  const { id } = useParams();
  const systemId = parseInt(id as string);
  
  const { 
    systems, 
    getSystemSubsystems, 
    createSubsystem, 
    deleteSubsystem,
    inventory,
    updateInventoryItem,
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

  const columns = [
    { key: 'name', label: 'Name' },
    { 
      key: 'status', 
      label: 'Status', 
      render: (val) => <StatusBadge status={val?.name} /> 
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{system?.name}</h1>
        <p className="text-muted-foreground">{system?.description}</p>
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
              <p className="font-medium">{system?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={system?.status?.name} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subsystems Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subsystems</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityTable
            columns={columns}
            data={subsystems}
            entityName="Subsystem"
            onDelete={(item) => deleteSubsystem(item.id)}
            getMaintenanceLogs={getEntityMaintenanceLogs}
            isLoading={loadingSubsystems}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## How to Add Status Filter to a Page

```tsx
import { useSearchParams } from 'next/navigation';

const MyPage = () => {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status'); // Get ?status=value
  
  const filtered = items.filter(item => 
    statusFilter ? item.status?.name === statusFilter : true
  );
  
  // Rest of component...
};
```

---

## How to Sync Inventory When Adding Child Entities

```tsx
async function handleAddChildEntity(parentId: number, selectedInventoryId: number) {
  try {
    // 1. Create child entity
    const newChild = await createChildEntity({
      parent_id: parentId,
      // other fields...
    });

    // 2. Update inventory - decrease quantity
    const inventory = inventoryItems.find(i => i.id === selectedInventoryId);
    if (inventory) {
      await updateInventoryItem(selectedInventoryId, {
        quantity: inventory.quantity - 1,
      });
    }

    toast.success('Entity added successfully');
  } catch (error) {
    toast.error('Failed to add entity');
  }
}

async function handleDeleteChildEntity(childId: number, inventoryId?: number) {
  try {
    // 1. Delete child entity
    await deleteChildEntity(childId);

    // 2. Update inventory - increase quantity
    if (inventoryId) {
      const inventory = inventoryItems.find(i => i.id === inventoryId);
      if (inventory) {
        await updateInventoryItem(inventoryId, {
          quantity: inventory.quantity + 1,
        });
      }
    }

    toast.success('Entity deleted successfully');
  } catch (error) {
    toast.error('Failed to delete entity');
  }
}
```

---

## Status Colors & Icons

When creating status breakdown cards, use these consistently:

```tsx
const statusConfig = {
  'Initiation': { icon: Clock, color: 'text-blue-500' },
  'Planning': { icon: Rocket, color: 'text-amber-500' },
  'Execution': { icon: Zap, color: 'text-yellow-500' },
  'Monitoring': { icon: AlertTriangle, color: 'text-orange-500' },
  'Completed': { icon: CheckCircle, color: 'text-green-500' },
  'On Hold': { icon: Paused, color: 'text-red-500' },
};
```

---

## Maintenance Log Operations

Get logs for any entity:

```tsx
const logs = await getEntityMaintenanceLogs(entityId);
```

Create a new log:

```tsx
await createMaintenanceLog({
  entity_id: entityId,
  notes: 'Service completed',
  performed_by: 'John Doe',
  performed_at: new Date().toISOString(),
  status: 'Resolved',
});
```

Update a log:

```tsx
await updateMaintenanceLog(logId, {
  status: 'Monitoring',
});
```

Delete a log:

```tsx
await deleteMaintenanceLog(logId);
```

---

## Testing the Enhancements

1. **Dashboard Page** (`/dashboard`)
   - Click each KPI card to navigate to respective pages
   - Click status breakdown cards to filter projects
   - Verify correct navigation and filtering

2. **Projects Page** (`/dashboard/projects`)
   - Use search to filter by name/description
   - Click status cards to filter by status
   - Verify URL updates with ?status=value
   - Table should show only filtered projects

3. **Future Implementation** (follow the same patterns)
   - Create detail pages for each entity
   - Add child entity tables with expandable maintenance logs
   - Implement inventory sync on add/delete

---

## Key Principles

1. **Always use DataStore** - Never hardcode API calls in components
2. **Reuse EntityTable** - Don't create custom tables, use EntityTable with column config
3. **Status consistency** - Use StatusBadge component for all status displays
4. **Error handling** - DataStore handles toasts, just await the function
5. **Navigation** - Use router.push() with status query params for filtering
6. **Lazy loading** - Maintenance logs load on expand, not on page load
7. **Type safety** - All IDs are `number`, all statuses are from Models

---

## Quick Checklist for New Entity Pages

- [ ] Import EntityTable, StatusBadge, useDataStore, useRouter
- [ ] Define columns array with render functions for status
- [ ] Filter data by status from searchParams
- [ ] Use EntityTable with getMaintenanceLogs prop
- [ ] Add status breakdown cards above the table
- [ ] Implement detail page with child entity table
- [ ] Handle inventory sync in add/delete functions
- [ ] Test all navigation and filtering

---

## Common Mistakes to Avoid

- Don't use custom Table components - use EntityTable
- Don't hardcode status colors - use StatusBadge
- Don't make direct API calls - use DataStore methods
- Don't forget to handle loading states
- Don't forget inventory sync when adding/deleting
- Don't use string IDs - convert to numbers
- Don't forget error handling (DataStore provides toast)
