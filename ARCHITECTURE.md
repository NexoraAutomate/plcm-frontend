# SatLife Dashboard Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Dashboard (/dashboard)                 │
│  ┌──────────┬──────────┬─────────┬──────────────────────────┐  │
│  │ Projects │  Orders  │ Inventory│ Maintenance Logs         │  │
│  │ [Clickable KPI Cards]                                    │  │
│  └──────────┴──────────┴─────────┴──────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    Project Status Breakdown (6 Status Cards)            │   │
│  │  Initiation │ Planning │ Execution │ Monitoring │ ...   │   │
│  │   [Clickable - filters to projects page]                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          ↓
   Navigation by Status
   ?status=Planning
          ↓
┌─────────────────────────────────────────────────────────────────┐
│              Projects List (/dashboard/projects)                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Status Overview (Mini Dashboard)                │   │
│  │  All │ Initiation │ Planning │ Execution │ ...          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Projects Table (with EntityTable)                      │   │
│  │  ├─ Name │ Owner │ Status │ Dates │ Actions             │   │
│  │  ├─ Project 1 [Expand ▼] | View | Edit | Delete        │   │
│  │  │  └─ Maintenance Logs [lazy load on expand]          │   │
│  │  │     ├─ Notes │ Performed By │ Date │ Status        │   │
│  │  │     └─ Edit/Delete buttons for each log            │   │
│  │  └─ Project 2                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          ↓
    Click "View"
          ↓
┌─────────────────────────────────────────────────────────────────┐
│          Projects Detail (/dashboard/projects/[id])              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Project Info Card                                      │   │
│  │  Name │ Status │ Owner │ Dates │ Description            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Systems Table (with EntityTable)                       │   │
│  │  ├─ Name │ Status │ Actions                             │   │
│  │  ├─ System 1 [Expand ▼] | View | Edit | Delete        │   │
│  │  │  └─ Maintenance Logs                                │   │
│  │  └─ System 2                                            │   │
│  │                                                         │   │
│  │  [+ Add System] (with inventory selection)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          ↓
    Click System View
          ↓
┌─────────────────────────────────────────────────────────────────┐
│          Systems Detail (/dashboard/systems/[id])                │
│         (Same pattern repeats for Systems → Subsystems)         │
│         (And Subsystems → Modules, Modules → Units, etc.)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
DataStore (Global State)
├── projects: Project[]
├── systems: System[]
├── subsystems: Subsystem[]
├── modules: Module[]
├── units: Unit[]
├── components: Component[]
├── inventory: Inventory[]
├── maintenanceLogs: MaintenanceLog[]
└── Methods:
    ├── Create/Update/Delete for each entity
    ├── getEntityMaintenanceLogs(id)
    ├── getProjectSystems(id)
    ├── getSystemSubsystems(id)
    ├── getSubsystemModules(id)
    ├── getModuleUnits(id)
    └── getUnitComponents(id)

      ↓

Page Components
├── Dashboard (/dashboard)
│   └── Uses: KPI Cards (clickable), Status Breakdown Cards
│
├── Projects List (/dashboard/projects)
│   ├── Uses: EntityMiniDashboard (status breakdown)
│   ├── Uses: EntityTable (main table)
│   └── Expandable Rows: MaintenanceTable (lazy loaded)
│
├── Projects Detail (/dashboard/projects/[id])
│   ├── Uses: EntityMiniDashboard (for systems)
│   ├── Uses: EntityTable (systems table)
│   └── Same pattern repeats for Systems → Subsystems, etc.
│
└── (Same pattern for: Systems, Subsystems, Modules, Units, Components)

      ↓

Reusable Components
├── EntityTable
│   ├── Configurable columns
│   ├── Expandable rows
│   ├── MaintenanceTable (embedded when expanded)
│   └── Actions: View, Edit, Delete
│
├── MaintenanceTable
│   ├── Notes, Performed By, Date, Status
│   └── Edit/Delete buttons
│
├── EntityMiniDashboard
│   ├── Total count display
│   ├── Status breakdown cards
│   └── Clickable for filtering
│
├── StatusBadge
│   ├── Colored by status type
│   └── Used in all tables
│
└── ConfirmDialog
    └── For delete confirmations

      ↓

UI Components (shadcn/ui)
├── Card, CardHeader, CardContent
├── Button
├── Input, Select, Dialog
├── Table, TableBody, TableCell, etc.
├── Badge
└── (All other shadcn components as needed)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User Interaction                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            Page Component (React State)                    │
│  ├── Local state: search, statusFilter, isOpen, etc.      │
│  └── Gets data from: useDataStore()                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              DataStore (Zustand-like)                      │
│  ├── Fetches from API on mount                            │
│  ├── Caches all entity data                               │
│  ├── Provides CRUD methods                                │
│  └── Shows toasts on success/error                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                               │
│  ├── api.users.list/get/create/update/delete              │
│  ├── api.projects.list/getSystems(id)                     │
│  ├── api.systems.list/getSubsystems(id)                   │
│  └── api.maintenanceLogs.list/create/update/delete        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend API (FastAPI)                         │
│  ├── /api/projects                                        │
│  ├── /api/projects/{id}/systems                           │
│  ├── /api/systems/{id}/subsystems                         │
│  └── /api/entities/{id}/maintenanceLogs-logs              │
└─────────────────────────────────────────────────────────────┘
```

---

## Hierarchical Entity Structure

```
                          Project
                             │
                             ├─ status_id
                             ├─ owner_id
                             ├─ order_id
                             └─ getProjectSystems(id)
                                      ↓
                                   System
                                      │
                                      ├─ project_id
                                      ├─ status_id
                                      └─ getSystemSubsystems(id)
                                              ↓
                                        Subsystem
                                              │
                                              ├─ system_id
                                              ├─ status_id
                                              └─ getSubsystemModules(id)
                                                      ↓
                                                  Module
                                                      │
                                                      ├─ subsystem_id
                                                      ├─ status_id
                                                      └─ getModuleUnits(id)
                                                              ↓
                                                           Unit
                                                              │
                                                              ├─ module_id
                                                              ├─ status_id
                                                              └─ getUnitComponents(id)
                                                                      ↓
                                                                 Component
                                                                      │
                                                                      └─ unit_id
                                                                      └─ status_id

Each level can have:
  ├─ Maintenance Logs (getEntityMaintenanceLogs(id))
  ├─ Status History (getEntityStatusHistory(id))
  └─ Custom properties (description, dates, etc.)
```

---

## Status Lifecycle

```
                    Project Created
                           │
                    Initiation Phase
                    └─ Initial setup
                           │
                         ↓
                    Planning Phase
                    └─ Detailed planning
                           │
                         ↓
                    Execution Phase
                    └─ Active work
                           │
                         ↓
                    Monitoring Phase
                    └─ Quality checks
                           │
                         ↓
                    Completed Phase
                    └─ Final delivery

                         OR

                    On Hold Status
                    └─ Paused at any phase
                    └─ Can return to previous phase

Each status change creates a:
  ├─ EntityStatusHistory record
  └─ MaintenanceLog entry (if logged)
```

---

## Routing Structure

```
/dashboard
├── /dashboard/dashboard              [Main Dashboard]
├── /dashboard/projects               [Projects List]
│   └── /dashboard/projects/[id]      [Projects Detail]
├── /dashboard/systems                [Systems List]
│   └── /dashboard/systems/[id]       [Systems Detail]
├── /dashboard/subsystems             [Subsystems List]
│   └── /dashboard/subsystems/[id]    [Subsystems Detail]
├── /dashboard/modules                [Modules List]
│   └── /dashboard/modules/[id]       [Modules Detail]
├── /dashboard/units                  [Units List]
│   └── /dashboard/units/[id]         [Units Detail]
├── /dashboard/components             [Components List]
├── /dashboard/orders                 [Orders List]
├── /dashboard/inventory              [Inventory List]
├── /dashboard/maintenanceLogs        [Maintenance Logs List]
└── /dashboard/hierarchy              [Hierarchy View]

Query Parameters:
  ?status=StatusName                  [Filter by status]
```

---

## Component Props Reference

### EntityTable Props
```typescript
interface EntityTableProps {
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, row: any) => ReactNode;
  }>;
  data: any[];
  entityName: string;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  getMaintenanceLogs?: (id: number) => Promise<MaintenanceLog[]>;
  isLoading?: boolean;
}
```

### EntityMiniDashboard Props
```typescript
interface EntityMiniDashboardProps {
  totalCount: number;
  totalIcon: LucideIcon;
  statusCounts: Array<{
    status: string;
    count: number;
    icon: LucideIcon;
    color: 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate';
  }>;
  filterPath?: (status: string) => string;
  showTotalCard?: boolean;
}
```

---

## Key Data Models

```typescript
// Main entities follow this pattern:
interface Entity {
  id: number;
  name: string;
  description: string;
  status_id: number;
  parent_id?: number;  // For hierarchy
  status?: Status;      // Populated by API
  created_at: string;
  updated_at?: string;
}

// Maintenance logs
interface MaintenanceLog {
  id: number;
  entity_id: number;
  notes: string;
  performed_by: string;
  performed_at: string;
  next_due?: string;
  status: string;  // 'Open', 'Resolved', 'Monitoring'
}

// Status type
interface Status {
  id: number;
  name: string;
  description: string;
}

// Inventory for parent-child sync
interface Inventory {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}
```

---

## Performance Considerations

```
Data Loading Strategy:
  ├── Initial Load
  │   └── DataStore fetches all entities on mount
  │       └── Cached in React state
  │
  ├── Nested Data
  │   └── Child entities fetched lazily per page
  │       └── Maintained Logs loaded on expand (lazy)
  │
  └── Optimization
      ├── Avoid refetching if data exists
      ├── Expand only loads logs for one row at a time
      └── Search/filter uses in-memory filtering (no API)

Component Memoization:
  └── EntityTable memoizes expensive renders
```

---

## Inventory Sync Flow

```
Adding Child Entity:
  1. User selects inventory item from dropdown
  2. Create child entity with parent_id and inventory_id
  3. Update inventory: quantity - 1
  4. Reload child entities list
  5. Show success toast

Deleting Child Entity:
  1. User confirms delete
  2. Delete child entity
  3. If had inventory_id: Update inventory: quantity + 1
  4. Reload child entities list
  5. Show success toast

Edge Cases Handled:
  ├── Child without inventory (no sync needed)
  ├── Inventory already at 0 (show warning)
  └── Multiple children using same inventory (decrements per child)
```

---

## Error Handling

```
API Errors:
  ├── 401 Unauthorized
  │   └── Clear auth tokens, redirect to login
  │
  ├── 404 Not Found
  │   └── Show "Item not found" message
  │
  ├── 400 Bad Request
  │   └── Show validation errors from API
  │
  └── 500 Server Error
      └── Show generic "Something went wrong" toast

DataStore Errors:
  ├── Catch all API errors
  ├── Show appropriate toast message
  └── Provide error context in console.error

UI Error States:
  ├── Loading spinner during fetch
  ├── Empty state when no data
  ├── Confirmation dialogs for destructive actions
  └── Toast notifications for all operations
```

---

## Summary

This architecture provides:
- Single source of truth (DataStore)
- Reusable components (EntityTable, MaintenanceTable, etc.)
- Hierarchical navigation with lazy loading
- Status-based filtering with URL parameters
- Inventory synchronization on entity add/delete
- Comprehensive error handling and user feedback
- Type-safe TypeScript throughout
- Production-ready code quality

The pattern established in the Dashboard and Projects pages can be replicated identically for all other entities (Systems, Subsystems, Modules, Units, Components).
