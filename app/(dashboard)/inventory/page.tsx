'use client';

import { Fragment, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronDown, ListOrdered, Undo2, RefreshCw, Download, Upload, FileText, AlertCircle, CheckCircle2, Tag, ScanLine, QrCode, Lock, LockOpen, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { toastFulfillments } from '@/lib/fcfs-toast';
import * as api from '@/lib/api';
import { EntityAttachmentsSection, type PendingAttachmentUpload } from '@/components/entity-attachments-section';
import {
  buildInventoryCreatePayload,
  composeInventoryLocation,
  emptyInventoryEntityForm,
  formatInventoryLocationAbbrev,
  inventoryFormFromInstance,
  inventoryFormFromItem,
  inventoryGroupFieldsFromForm,
  inventoryInstanceFieldsFromForm,
  inventoryPartNumber,
} from '@/lib/inventory-entity-fields';
import type { Inventory, InventoryInstance, User } from '@/lib/models';
import { formatUserRef, displayUserName } from '@/lib/user-display';
import { useDataStore } from '@/lib/data-store';
import { useHierarchiesQuery } from '@/hooks/queries';
import { fetchAllMatchingInventoryIds, fetchInventoryPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useClientTableSort, useTableSorting } from '@/hooks/use-table-sorting';
import { sortRowsByState } from '@/lib/sorting';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import { useColumnVisibility, type ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import {
  getInventorySerialNumbers,
  inventoryUsesInstances,
} from '@/lib/entity-hierarchy';
import {
  calculateInventoryTotalUsed,
  canSuggestInventorySerial,
  inventoryEntitiesForType,
  suggestNextInventorySerial,
} from '@/lib/inventory-serial';
import { getAvailableInstances, isProjectReservedInstance } from '@/lib/inventory-install';
import { InventoryDeleteDialog } from '@/components/inventory-delete-dialog';
import { InventoryDeleteBlockedDialog } from '@/components/inventory-delete-blocked-dialog';
import { InventoryReservationHoldDialog } from '@/components/inventory-reservation-hold-dialog';
import { IssuanceRemarksDialog } from '@/components/inventory/issuance-remarks-dialog';
import { InventoryLabelDialog } from '@/components/inventory/inventory-label-dialog';
import { InventoryBulkLabelDialog } from '@/components/inventory/inventory-bulk-label-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Can } from '@/components/auth/can';
import { useAuth } from '@/lib/auth-context';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { validateInventoryForm } from '@/lib/form-validation';
import {
  buildEntityIdentifiersFromDefinitions,
  nextInventorySequences,
  suggestAbbreviation,
} from '@/lib/app-definitions';
import { P } from '@/lib/permission-codes';
import { workflowStatusColor, workflowStatusLabel } from '@/lib/workflow-status';
import { DEFAULT_STATUS_COLOR_BY_NAME, hexToRgba } from '@/lib/status-colors';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ListStatsVisibilityControls,
  useListStatsVisibility,
} from '@/components/list-stats-visibility';
import { InventoryKpiDashboard } from '@/components/inventory/inventory-kpi-dashboard';
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import { useInventoryStatsSummary } from '@/hooks/use-inventory-stats-summary';
import { FileDropZone } from '@/components/ui/file-drop-zone';
import {
  AnimatedPillTabsList,
  animatedPillTabsTriggerClassName,
} from '@/components/ui/animated-pill-tabs';
import { InventoryPictureThumb } from '@/components/inventory/inventory-picture-thumb';
import { EntityPicture } from '@/components/entity-picture';
import {
  costTabToPayload,
  InventoryCostTab,
  validateInventoryCostTab,
  type InventoryCostTabValue,
} from '@/components/inventory/inventory-cost-tab';
import { formatInventoryMoney } from '@/lib/inventory-currencies';

const ACTION_BTN =
  'h-7 w-7 bg-transparent shadow-none border-0 hover:bg-transparent';

/** Visible unit rows in the expanded inventory table before vertical scroll. */
const MAX_VISIBLE_EXPANDED_UNITS = 10;
const EXPANDED_UNITS_SCROLL_CLASS =
  'max-h-[calc(2.5rem+10*2.75rem)] overflow-y-auto overflow-x-hidden';
const EXPANDED_CELL_TRUNCATE = 'max-w-0 truncate';

const ACTION_ICON = {
  add: 'size-3.5 text-muted-foreground transition-colors group-hover/add:text-emerald-600',
  issue: 'size-3.5 text-muted-foreground transition-colors group-hover/issue:text-orange-600',
  edit: 'size-3.5 text-muted-foreground transition-colors group-hover/edit:text-blue-600',
  delete: 'size-3.5 text-muted-foreground transition-colors group-hover/delete:text-red-600',
} as const;

type EntityType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';
type StockFilter = 'all' | 'available' | 'reserved' | 'out_of_stock';

const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

function isStockFilter(value: string | null): value is StockFilter {
  return STOCK_FILTERS.some((filter) => filter.value === value);
}

const ENTITY_TYPE_FILTER_STYLES: {
  value: EntityType | 'all';
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: 'all',
    activeClass: 'border-primary bg-primary text-primary-foreground',
    inactiveClass: 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted',
  },
  {
    value: 'system',
    activeClass:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    inactiveClass:
      'border-blue-100/80 bg-blue-50/40 text-blue-600/70 hover:bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400/70 dark:hover:bg-blue-950/60',
  },
  {
    value: 'subsystem',
    activeClass:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    inactiveClass:
      'border-sky-100/80 bg-sky-50/40 text-sky-600/70 hover:bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400/70 dark:hover:bg-sky-950/60',
  },
  {
    value: 'module',
    activeClass:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    inactiveClass:
      'border-indigo-100/80 bg-indigo-50/40 text-indigo-600/70 hover:bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400/70 dark:hover:bg-indigo-950/60',
  },
  {
    value: 'unit',
    activeClass:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    inactiveClass:
      'border-cyan-100/80 bg-cyan-50/40 text-cyan-600/70 hover:bg-cyan-50/70 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-400/70 dark:hover:bg-cyan-950/60',
  },
  {
    value: 'component',
    activeClass:
      'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300',
    inactiveClass:
      'border-teal-100/80 bg-teal-50/40 text-teal-600/70 hover:bg-teal-50/70 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-400/70 dark:hover:bg-teal-950/60',
  },
];

interface InventoryItem extends Inventory {
  entityName?: string;
  serialNumber?: string;
  serialNumbers?: string[];
  partNumber?: string;
  holderName?: string;
  displayLocation?: string;
  totalUsed?: number;
}

type HierarchyEntityPools = {
  systems: { part_number?: string | null; original_part_number?: string | null; serial_number?: string | null; original_serial_number?: string | null }[];
  subsystems: { part_number?: string | null; original_part_number?: string | null; serial_number?: string | null; original_serial_number?: string | null }[];
  modules: { part_number?: string | null; original_part_number?: string | null; serial_number?: string | null; original_serial_number?: string | null }[];
  units: { part_number?: string | null; original_part_number?: string | null; serial_number?: string | null; original_serial_number?: string | null }[];
  components: { part_number?: string | null; original_part_number?: string | null; serial_number?: string | null; original_serial_number?: string | null }[];
};

function resolveInventoryHolderLabel(item: Inventory, users: User[]): string {
  const fromInstances = [
    ...new Set(
      (item.instances ?? [])
        .map((instance) =>
          displayUserName(users, instance.holder_user_id, instance.holder_name, '')
        )
        .filter(Boolean)
    ),
  ];
  if (fromInstances.length > 0) return fromInstances.join(', ');
  return displayUserName(users, item.holder_user_id, item.holder_name);
}

function resolveInventoryLocation(item: Inventory): string {
  const fromItem = formatInventoryLocationAbbrev(item);
  if (fromItem !== '—') return fromItem;
  const locations = (item.instances ?? [])
    .map((instance) => formatInventoryLocationAbbrev(instance))
    .filter((location) => location !== '—');
  if (locations.length === 0) return '—';
  return [...new Set(locations)].join(', ');
}

function getBlockedDeleteInstances(item: Inventory): InventoryInstance[] {
  const availableIds = new Set(getAvailableInstances(item).map((instance) => instance.id));
  return (item.instances ?? []).filter(
    (instance) => Boolean(instance.id) && !availableIds.has(instance.id)
  );
}

function canDeleteInventoryItem(item: Inventory): boolean {
  const instances = (item.instances ?? []).filter((instance) => Boolean(instance.id));
  if (instances.length > 0) {
    return getAvailableInstances(item).length > 0;
  }
  const reserved = item.reserved_quantity ?? 0;
  const available = item.available_quantity ?? Math.max(0, item.quantity - reserved);
  return available > 0 || item.quantity === 0;
}

/** True when the whole catalog row (every unit) may be bulk-deleted. */
function isInventoryFullyDeletable(item: Inventory): boolean {
  const instances = (item.instances ?? []).filter((instance) => Boolean(instance.id));
  if (instances.length === 0) {
    return (item.reserved_quantity ?? 0) === 0;
  }
  return getAvailableInstances(item).length === instances.length;
}

function isInstanceDeletable(instance: InventoryInstance): boolean {
  return isInventoryInstanceAvailable(instance);
}

/** True when the unit is free warehouse stock (not reserved / issued / return-pending). */
function isInventoryInstanceAvailable(instance?: InventoryInstance | null): boolean {
  if (!instance?.id) return false;
  return (
    !instance.is_reserved &&
    !isProjectReservedInstance(instance) &&
    instance.open_issuance_status !== 'return_pending'
  );
}

/**
 * Utilization status for table + edit header.
 * Driven by reservation/issuance flags — not stale status_id on the form.
 */
function resolveInventoryInstanceStatus(instance?: InventoryInstance | null): string {
  if (!instance) return '—';
  if (instance.is_reserved) {
    return workflowStatusLabel(instance.status_name?.trim() || 'ISSUED');
  }
  if (isProjectReservedInstance(instance)) {
    return workflowStatusLabel('RESERVED');
  }
  return workflowStatusLabel('AVAILABLE');
}

function instanceSerialNumber(instance: InventoryInstance): string {
  return instance.serial_number?.trim() || instance.original_serial_number?.trim() || '';
}

type ExpandedInventoryUnitsTableProps = {
  serialInstances: InventoryInstance[];
  users: User[];
  containerClassName?: string;
  children: (sortedInstances: InventoryInstance[]) => ReactNode;
};

function ExpandedInventoryUnitsTable({
  serialInstances,
  users,
  containerClassName,
  children,
}: ExpandedInventoryUnitsTableProps) {
  const { sort, cycleSort } = useTableSorting();
  const sortedInstances = useMemo(
    () =>
      sortRowsByState(
        serialInstances as unknown as Record<string, unknown>[],
        sort,
        {
          serial_number: (row) => instanceSerialNumber(row as unknown as InventoryInstance),
          holder_user_id: (row) =>
            displayUserName(
              users,
              (row as unknown as InventoryInstance).holder_user_id,
              (row as unknown as InventoryInstance).holder_name
            ),
          location: (row) =>
            formatInventoryLocationAbbrev(row as unknown as InventoryInstance),
          status: (row) =>
            resolveInventoryInstanceStatus(row as unknown as InventoryInstance),
        }
      ) as unknown as InventoryInstance[],
    [serialInstances, sort, users]
  );

  return (
    <Table className="table-fixed" containerClassName={containerClassName}>
      <colgroup>
        <col style={{ width: '30%' }} />
        <col style={{ width: '26%' }} />
        <col />
        <col style={{ width: '7rem' }} />
        <col style={{ width: '11rem' }} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <SortableTableHead column="serial_number" sort={sort} onSort={cycleSort}>
            Unit Identity
          </SortableTableHead>
          <SortableTableHead column="holder_user_id" sort={sort} onSort={cycleSort}>
            Inventory Holder
          </SortableTableHead>
          <SortableTableHead column="location" sort={sort} onSort={cycleSort}>
            Location
          </SortableTableHead>
          <SortableTableHead column="status" sort={sort} onSort={cycleSort} className="w-28">
            Status
          </SortableTableHead>
          <TableHead className="w-44 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children(sortedInstances)}</TableBody>
    </Table>
  );
}

/** Serial numbers for expandable rows, optionally scoped to the active stock quick-filter. */
function getExpandableSerialInstances(
  item: Inventory,
  stockFilter: StockFilter = 'all'
): InventoryInstance[] {
  const all = (item.instances ?? []).filter((instance) => Boolean(instance?.id));
  if (stockFilter === 'reserved') {
    return all.filter(isProjectReservedInstance);
  }
  if (stockFilter === 'available') {
    return getAvailableInstances(item);
  }
  return all;
}

function enrichInventoryItems(
  items: Inventory[],
  users: User[],
  entityPools: HierarchyEntityPools,
  stockFilter: StockFilter = 'all'
): InventoryItem[] {
  return items.map((item) => {
    const serialNumbers = getInventorySerialNumbers(item);
    const firstAvailable =
      getExpandableSerialInstances(item, stockFilter)
        .map(instanceSerialNumber)
        .find(Boolean) || serialNumbers[0];
    const relatedEntities = inventoryEntitiesForType(item.inventory_type, entityPools);

    return {
      ...item,
      entityName: item.name,
      serialNumbers,
      serialNumber: firstAvailable || '—',
      partNumber: inventoryPartNumber(item),
      holderName: resolveInventoryHolderLabel(item, users),
      displayLocation: resolveInventoryLocation(item),
      totalUsed: Math.max(
        item.total_used ?? 0,
        calculateInventoryTotalUsed(item, relatedEntities)
      ),
    };
  });
}

const COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'name', label: 'Category', alwaysVisible: true },
  { id: 'inventory_type', label: 'Type' },
  { id: 'total_used', label: 'Total Used' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'total_stock_cost', label: 'Total Cost' },
  { id: 'holder_user_id', label: 'Inventory Holder' },
  { id: 'location', label: 'Location' },
];

export default function InventoryPage() {
  const { definitions, entityLabel } = useAppDefinitions();
  const { visibleIds, isVisible, toggleColumn, resetColumns } = useColumnVisibility('inventory-list', COLUMN_DEFS);
  const { showStats, setShowStats } = useListStatsVisibility();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  // [select checkbox] + expand + visible data columns + actions
  const inventoryTableColSpan = (inventoryManager ? 1 : 0) + 1 + visibleIds.length + 1;
  const canCreateInventory = inventoryManager && can(P.create_inventory);
  const canEditInventory = inventoryManager && can(P.edit_inventory);
  const canAddStock = canCreateInventory || canEditInventory;
  const ENTITY_TYPE_FILTERS = useMemo(
    () =>
      ENTITY_TYPE_FILTER_STYLES.map((filter) => ({
        ...filter,
        label:
          filter.value === 'all'
            ? 'All Types'
            : entityLabel(filter.value),
      })),
    [entityLabel]
  );
  const { users, statuses, systems, subsystems, modules, units, components } =
    useDataStore();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const { sort, cycleSort, listFilterPatch } = useTableSorting();

  useEffect(() => {
    const stock = searchParams.get('stock');
    if (isStockFilter(stock)) setStockFilter(stock);
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  function applyStockFilter(value: StockFilter) {
    setStockFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('stock');
    else params.set('stock', value);
    const qs = params.toString();
    router.replace(qs ? `/inventory?${qs}` : '/inventory', { scroll: false });
  }
  const inventoryTypeParam = entityTypeFilter !== 'all' ? entityTypeFilter : undefined;
  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        inventoryType: inventoryTypeParam,
        stock: stockFilter !== 'all' ? stockFilter : undefined,
        ...listFilterPatch,
      }),
    [debouncedSearch, inventoryTypeParam, stockFilter, listFilterPatch]
  );
  const pagination = usePaginatedList({
    queryKey: queryKeys.inventoryPage(inventoryTypeParam, listFilters),
    fetchPage: (skip, limit, filters) =>
      fetchInventoryPage(skip, limit, inventoryTypeParam, filters),
    filters: listFilters,
  });
  const {
    data: inventoryStats,
    isFetching: inventoryStatsFetching,
    refetch: refetchInventoryStats,
  } = useInventoryStatsSummary(showStats);
  const entityPools = useMemo(
    () => ({ systems, subsystems, modules, units, components }),
    [systems, subsystems, modules, units, components]
  );
  const inventory = useMemo(
    () => enrichInventoryItems(pagination.items, users, entityPools, stockFilter),
    [pagination.items, users, entityPools, stockFilter]
  );
  const loading = pagination.loading;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<number | null>(null);
  /** True when opened from a specific serial — show that unit only (no Units tab / stock qty). */
  const [editingSerialOnly, setEditingSerialOnly] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Inventory | null>(null);
  const [instances, setInstances] = useState<InventoryInstance[]>([]);
  const {
    sort: instanceEditorSort,
    cycleSort: cycleInstanceEditorSort,
    sortedRows: sortedEditorInstances,
  } = useClientTableSort(instances);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleteBlockedTarget, setDeleteBlockedTarget] = useState<{
    item: InventoryItem;
    instances: InventoryInstance[];
  } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  /** When set, create dialog is restocking this catalog row (same UI as Add Item). */
  const [restockInventoryId, setRestockInventoryId] = useState<number | null>(null);
  const openingRestockRef = useRef(false);
  const [unitCostLines, setUnitCostLines] = useState<string[]>([]);
  const [existingUnitCostEdits, setExistingUnitCostEdits] = useState<
    Record<number, string>
  >({});
  const [reservationHoldInstance, setReservationHoldInstance] =
    useState<InventoryInstance | null>(null);
  const [returnIssuanceId, setReturnIssuanceId] = useState<number | null>(null);
  const [returnRemarksBusy, setReturnRemarksBusy] = useState(false);
  const [labelTarget, setLabelTarget] = useState<{
    item: InventoryItem;
    instance?: InventoryInstance;
  } | null>(null);
  const [instanceDeleteTarget, setInstanceDeleteTarget] = useState<{
    item: InventoryItem;
    instance: InventoryInstance;
  } | null>(null);
  const [bulkLabelsOpen, setBulkLabelsOpen] = useState(false);

  // CSV import/export state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    valid_rows: number;
    groups?: number;
    instances?: number;
    errors: { row: number; errors: string[] }[];
  } | null>(null);
  const [importValidating, setImportValidating] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectAllRequestId = useRef(0);

  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('component');
  const { data: entityListNames = [] } = useHierarchiesQuery(selectedEntityType);
  const inventoryHolderUserId = user?.id ? String(user.id) : '';
  const inventoryHolderLabel = user ? formatUserRef(user) : 'Inventory Manager';
  const [formData, setFormData] = useState({ ...emptyInventoryEntityForm });
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [formTab, setFormTab] = useState('general');

  const pageIds = useMemo(() => inventory.map((item) => item.id), [inventory]);
  const selectedCount = selectedIds.size;
  const allMatchingSelected =
    pagination.total > 0 && selectedCount === pagination.total;
  const someSelected = selectedCount > 0;

  useEffect(() => {
    selectAllRequestId.current += 1;
    setSelectingAll(false);
    setSelectedIds(new Set());
  }, [debouncedSearch, entityTypeFilter, stockFilter]);

  function toggleRowSelected(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    selectAllRequestId.current += 1;
    setSelectingAll(false);
    setSelectedIds(new Set());
  }

  async function selectAllMatching() {
    const requestId = ++selectAllRequestId.current;
    if (pagination.total > 0 && pagination.total === pageIds.length) {
      setSelectedIds(new Set(pageIds));
      return;
    }
    setSelectingAll(true);
    try {
      const ids = await fetchAllMatchingInventoryIds(inventoryTypeParam, listFilters);
      if (requestId !== selectAllRequestId.current) return;
      setSelectedIds(new Set(ids));
    } catch {
      if (requestId !== selectAllRequestId.current) return;
      toast.error('Failed to select all inventory items');
    } finally {
      if (requestId === selectAllRequestId.current) setSelectingAll(false);
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      clearSelection();
      return;
    }
    void selectAllMatching();
  }

  async function handleExport(format: 'csv' | 'json') {
    setExportBusy(true);
    try {
      const params = {
        inventory_type: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
        search: search || undefined,
      };
      const res =
        format === 'json'
          ? await api.inventory.exportJson(params)
          : await api.inventory.exportCsv(params);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'json' ? 'inventory_export.json' : 'inventory_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export inventory');
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImportFileSelected(file: File | null) {
    setImportFile(file);
    setImportPreview(null);
    if (!file) return;
    setImportValidating(true);
    try {
      const res = await api.inventory.importFile(file, true);
      setImportPreview({
        valid_rows: res.data.valid_rows ?? res.data.groups ?? 0,
        groups: res.data.groups,
        instances: res.data.instances,
        errors: res.data.errors ?? [],
      });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { errors?: { row: number; errors: string[] }[] } } } })?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.errors) {
        setImportPreview({ valid_rows: 0, errors: detail.errors });
      } else {
        toast.error('Failed to validate import file');
        setImportPreview(null);
      }
    } finally {
      setImportValidating(false);
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImportSubmitting(true);
    try {
      const res = await api.inventory.importFile(importFile, false);
      const groups = res.data.imported ?? res.data.groups_created ?? 0;
      const serials = res.data.instances_created ?? 0;
      toast.success(
        serials > 0
          ? `Imported ${groups} part number${groups === 1 ? '' : 's'} with ${serials} serial${serials === 1 ? '' : 's'}`
          : `Imported ${groups} inventory item${groups === 1 ? '' : 's'}`
      );
      setIsImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      clearSelection();
      void pagination.invalidate();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { errors?: { row: number; errors: string[] }[] } } } })?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.errors) {
        setImportPreview({ valid_rows: 0, errors: detail.errors });
        toast.error('Import failed with validation errors');
      } else {
        toast.error('Failed to import inventory');
      }
    } finally {
      setImportSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const chunkSize = 100;
      let deleted = 0;
      let failed = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const res = await api.inventory.bulkDelete(chunk);
        deleted += res.data.deleted ?? 0;
        failed += res.data.not_found?.length ?? 0;
      }
      clearSelection();
      void pagination.invalidate();
      if (failed === 0) {
        toast.success(`Deleted ${deleted} inventory item${deleted === 1 ? '' : 's'}`);
      } else if (deleted === 0) {
        toast.error('Failed to delete selected inventory items');
      } else {
        toast.error(`Deleted ${deleted}, ${failed} not found`);
      }
    } catch {
      toast.error('Failed to delete selected inventory items');
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  }

  function toggleExpandedRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openAddMore(item: InventoryItem) {
    openingRestockRef.current = true;
    setFormTab('general');
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setEditingId(null);
    setEditingInstanceId(null);
    setEditingSerialOnly(false);
    setRestockInventoryId(item.id);
    setSelectedEntityType(item.inventory_type as EntityType);
    try {
      const res = await api.inventory.get(item.id);
      const full = res.data ?? item;
      setEditingGroup(full);
      setInstances(full.instances ?? []);
      const nextForm = {
        ...inventoryFormFromItem(full),
        quantity: 1,
        holder_user_id: inventoryHolderUserId,
        cost_mode: 'batch' as const,
      };
      setFormData(nextForm);
      setUnitCostLines(
        nextForm.unit_cost ? [nextForm.unit_cost] : ['']
      );
      setExistingUnitCostEdits({});
      setIsCreateOpen(true);
    } catch (err) {
      console.error('Failed to load inventory for restock:', err);
      toast.error('Failed to load inventory details');
      setRestockInventoryId(null);
    }
  }

  function costTabValueFromForm(): InventoryCostTabValue {
    return {
      currency: formData.currency || 'PKR',
      costMode: formData.cost_mode === 'unit' ? 'unit' : 'batch',
      bulkQuoteCost: formData.bulk_quote_cost,
      unitCost: formData.unit_cost,
      unitCosts: unitCostLines,
    };
  }

  function applyCostTabValue(next: InventoryCostTabValue) {
    setFormData((prev) => ({
      ...prev,
      currency: next.currency,
      cost_mode: next.costMode,
      bulk_quote_cost: next.bulkQuoteCost,
      unit_cost: next.unitCost || next.unitCosts[0] || prev.unit_cost,
    }));
    setUnitCostLines(next.unitCosts);
  }

  function requestDeleteItem(item: InventoryItem) {
    if (canDeleteInventoryItem(item)) {
      setDeleteTarget(item);
      return;
    }
    setDeleteBlockedTarget({
      item,
      instances: getBlockedDeleteInstances(item),
    });
  }

  function requestDeleteInstance(item: InventoryItem, instance: InventoryInstance) {
    if (isInstanceDeletable(instance)) {
      setInstanceDeleteTarget({ item, instance });
      return;
    }
    setDeleteBlockedTarget({ item, instances: [instance] });
  }

  function apiErrorDetail(err: unknown, fallback: string): string {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
      ?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object' && 'msg' in entry) {
            return String((entry as { msg?: unknown }).msg ?? '');
          }
          return '';
        })
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    if (err instanceof Error && /network error/i.test(err.message)) {
      return 'Could not reach the server. Check that the API is running and try again.';
    }
    return fallback;
  }

  const resetForm = (options?: { forCreate?: boolean }) => {
    setFormData({
      ...emptyInventoryEntityForm,
      holder_user_id: options?.forCreate ? inventoryHolderUserId : '',
    });
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setSelectedEntityType('component');
    setEditingInstanceId(null);
    setEditingSerialOnly(false);
    setEditingGroup(null);
    setInstances([]);
    setRestockInventoryId(null);
    setUnitCostLines([]);
    setExistingUnitCostEdits({});
    setFormTab('general');
  };

  const buildGroupPayload = () =>
    inventoryGroupFieldsFromForm(formData, selectedEntityType, removePicture);

  const buildInstancePayload = () =>
    inventoryInstanceFieldsFromForm(formData, removePicture);

  const getLatestInstanceId = (item: Inventory) => {
    const itemInstances = item.instances ?? [];
    return itemInstances[itemInstances.length - 1]?.id;
  };

  async function syncCatalogPicture(inventoryId: number) {
    if (removePicture) {
      await api.pictures.remove('inventory', inventoryId);
    } else if (pendingPictureFile) {
      await api.pictures.upload('inventory', inventoryId, pendingPictureFile);
    }
  }

  async function syncAttachments(
    ownerType: 'inventory' | 'inventory_instance',
    ownerId: number
  ) {
    if (pendingAttachments.length === 0) return;
    for (const attachment of pendingAttachments) {
      await api.attachments.upload(ownerType, ownerId, attachment.file, {
        attachment_type: attachment.attachment_type,
        description: attachment.description,
      });
    }
  }

  const buildInventoryPayload = () =>
    buildInventoryCreatePayload(formData, selectedEntityType, removePicture);

  async function handleCreate() {
    const usesInstances = inventoryUsesInstances(selectedEntityType);
    const location = composeInventoryLocation(
      formData.location_room,
      formData.location_cabinet,
      formData.location_rack,
      formData.location
    );
    const isRestock = restockInventoryId != null;

    const validationError = validateInventoryForm({
      name: formData.name,
      partNumber: formData.part_number,
      location,
      quantity: formData.quantity,
      usesInstances,
      supportsQuantity: true,
      isComponent: selectedEntityType === 'component',
      entityCategoryLabel: getEntityDisplayName(selectedEntityType),
      locationLabel: 'Room / Cabinet / Rack',
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const costError = validateInventoryCostTab(
      costTabValueFromForm(),
      formData.quantity
    );
    if (costError) {
      toast.error(costError);
      setFormTab('cost');
      return;
    }

    try {
      const costPayload = costTabToPayload(costTabValueFromForm(), formData.quantity);
      const payload = {
        ...buildInventoryPayload(),
        ...costPayload,
        currency: costPayload.currency,
      };
      const created = await api.inventory.create(payload);
      if (created.data?.id) {
        await syncCatalogPicture(created.data.id);
        const attachOwnerType = usesInstances ? 'inventory_instance' : 'inventory';
        const attachOwnerId = usesInstances
          ? getLatestInstanceId(created.data)
          : created.data.id;
        if (attachOwnerId) {
          await syncAttachments(attachOwnerType, attachOwnerId);
        }
      }
      toastFulfillments(created.data?.fcfs_fulfillments);
      toast.success(
        isRestock
          ? `Added stock to ${formData.name}`
          : usesInstances
            ? 'Serialized unit added to inventory group'
            : 'Inventory item created'
      );
      pagination.invalidate();

      resetForm();
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Failed to create inventory item:', err);
      toast.error(apiErrorDetail(err, 'Failed to create inventory item'));
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    const usesInstances = inventoryUsesInstances(selectedEntityType);
    const location = composeInventoryLocation(
      formData.location_room,
      formData.location_cabinet,
      formData.location_rack,
      formData.location
    );

    const validationError = validateInventoryForm({
      name: formData.name,
      partNumber: formData.part_number,
      location,
      quantity: formData.quantity,
      usesInstances,
      // Quantity is not editable on edit (including components); only create / Add Stock.
      supportsQuantity: false,
      isComponent: selectedEntityType === 'component' || (usesInstances && !editingInstanceId),
      entityCategoryLabel: getEntityDisplayName(selectedEntityType),
      locationLabel: 'Room / Cabinet / Rack',
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const bulkRaw = formData.bulk_quote_cost.trim();
      const bulk =
        bulkRaw !== '' && Number.isFinite(Number(bulkRaw))
          ? Number(bulkRaw)
          : undefined;
      const updated = await api.inventory.update(editingId, {
        ...buildGroupPayload(),
        currency: (formData.currency || 'PKR').trim().toUpperCase() || 'PKR',
        ...(bulk !== undefined ? { bulk_quote_cost: bulk } : {}),
      });
      toastFulfillments(updated.data?.fcfs_fulfillments);

      await syncCatalogPicture(editingId);

      for (const [instanceId, costRaw] of Object.entries(existingUnitCostEdits)) {
        const cost = Number(costRaw);
        if (!Number.isFinite(cost) || cost < 0) continue;
        await api.inventory.updateInstance(Number(instanceId), { unit_cost: cost });
      }

      if (usesInstances && editingInstanceId) {
        const instancePayload = buildInstancePayload();
        const {
          status_id: _statusId,
          installation_date: _installationDate,
          installed_by_id: _installedById,
          ...editableInstanceFields
        } = instancePayload;
        await api.inventory.updateInstance(editingInstanceId, editableInstanceFields);
        await syncAttachments('inventory_instance', editingInstanceId);
      } else if (!usesInstances) {
        await syncAttachments('inventory', editingId);
      }

      toast.success('Inventory item updated');
      pagination.invalidate();

      resetForm();
      setEditingId(null);
      setEditingInstanceId(null);
      setEditingGroup(null);
      setInstances([]);
      setIsEditOpen(false);
    } catch (err) {
      console.error('Failed to update inventory item:', err);
      toast.error('Failed to update inventory item');
    }
  }

  async function handleDeleteAll(inventoryId: number) {
    try {
      await api.inventory.delete(inventoryId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(inventoryId);
        return next;
      });
      toast.success('Inventory item deleted');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to delete inventory item:', err);
      toast.error('Failed to delete inventory item');
      throw err;
    }
  }

  async function handleDeleteOneSerial(instanceId: number) {
    try {
      await api.inventory.deleteInstance(instanceId);
      toast.success('Serial number deleted');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to delete inventory serial:', err);
      toast.error('Failed to delete serial number');
      throw err;
    }
  }

  function loadInstanceIntoForm(instance: InventoryInstance, group: Inventory) {
    setEditingInstanceId(instance.id);
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setFormData(inventoryFormFromInstance(instance, group));
  }

  async function handleAddInstance() {
    if (!editingId || !editingGroup) return;
    const location = composeInventoryLocation(
      formData.location_room,
      formData.location_cabinet,
      formData.location_rack,
      formData.location
    );
    if (editingGroup.inventory_type !== 'component' && !location) {
      toast.error('Room / Cabinet / Rack are required for each serialized unit');
      return;
    }

    const relatedEntities = inventoryEntitiesForType(editingGroup.inventory_type, entityPools);
    const groupWithInstances = { ...editingGroup, instances };
    const nextSerial = suggestNextInventorySerial(groupWithInstances, relatedEntities);

    if (!nextSerial) {
      toast.error('Could not determine the next serial number');
      return;
    }

    try {
      const created = await api.inventory.createInstance(editingId, {
        ...buildInstancePayload(),
        serial_number: nextSerial,
        original_serial_number: nextSerial,
        holder_user_id: inventoryHolderUserId ? Number(inventoryHolderUserId) : undefined,
      });
      if (created.data?.id) {
        await syncMedia('inventory_instance', created.data.id);
      }
      toastFulfillments(created.data?.fcfs_fulfillments);
      const refreshed = await api.inventory.get(editingId);
      const nextInstances = refreshed.data?.instances ?? [];
      setInstances(nextInstances);
      if (refreshed.data) {
        setEditingGroup(refreshed.data);
      }
      if (created.data) {
        loadInstanceIntoForm(created.data, refreshed.data ?? editingGroup);
      }
      toast.success('Serialized unit added');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to add inventory unit:', err);
      toast.error('Failed to add serialized unit');
    }
  }

  async function handleDeleteInstance(instanceId: number) {
    try {
      await api.inventory.deleteInstance(instanceId);
      if (!editingId) {
        toast.success('Serialized unit removed');
        pagination.invalidate();
        return;
      }
      const refreshed = await api.inventory.get(editingId);
      if (!refreshed?.data) {
        pagination.invalidate();
        resetForm();
        setEditingId(null);
        setEditingInstanceId(null);
        setEditingGroup(null);
        setInstances([]);
        setIsEditOpen(false);
        toast.success('Inventory group removed');
        return;
      }
      const nextInstances = refreshed.data.instances ?? [];
      setInstances(nextInstances);
      setEditingGroup(refreshed.data);
      if (nextInstances.length > 0) {
        loadInstanceIntoForm(nextInstances[0], refreshed.data);
      } else {
        setEditingInstanceId(null);
      }
      toast.success('Serialized unit removed');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to delete inventory unit:', err);
      const detail = apiErrorDetail(err, 'Failed to delete serialized unit');
      if (/reserved|issued|installed/i.test(detail) && editingGroup) {
        const blocked = (editingGroup.instances ?? []).find(
          (instance) => instance.id === instanceId
        );
        setDeleteBlockedTarget({
          item: editingGroup,
          instances: blocked ? [blocked] : getBlockedDeleteInstances(editingGroup),
        });
        return;
      }
      toast.error(detail);
    }
  }

  async function openEdit(item: InventoryItem, instanceId?: number) {
    setEditingId(item.id);
    setFormTab('general');
    setSelectedEntityType(item.inventory_type as EntityType);
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setRestockInventoryId(null);
    setUnitCostLines([]);
    const serialOnly = instanceId != null;
    setEditingSerialOnly(serialOnly);

    try {
      const res = await api.inventory.get(item.id);
      const fullItem = res.data ?? item;
      setEditingGroup(fullItem);
      const itemInstances = fullItem.instances ?? [];
      setInstances(itemInstances);
      setExistingUnitCostEdits(
        Object.fromEntries(
          itemInstances.map((instance) => [
            instance.id,
            instance.unit_cost != null ? String(instance.unit_cost) : '',
          ])
        )
      );
      setFormData(inventoryFormFromItem(fullItem));

      if (inventoryUsesInstances(fullItem.inventory_type as EntityType) && itemInstances.length > 0) {
        const selectedInstance = serialOnly
          ? itemInstances.find((instance) => instance.id === instanceId) ?? itemInstances[0]
          : itemInstances[0];
        loadInstanceIntoForm(selectedInstance, fullItem);
      } else {
        setEditingInstanceId(null);
      }
      setIsEditOpen(true);
    } catch (err) {
      console.error('Failed to load inventory item:', err);
      toast.error('Failed to load inventory details');
    }
  }

  const inventoryDialogClassName =
    'top-[4vh] flex max-h-[92vh] w-[min(100vw-1.5rem,56rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl';

  const formTabClassName =
    'mt-0 grid grid-cols-1 gap-x-6 gap-y-5 p-1 sm:grid-cols-2 [&>div]:space-y-2 [&>p]:col-span-full';

  const formTabSingleClassName = 'mt-0 space-y-5 p-1 [&>div]:space-y-2';

  const tabTriggerClassName = animatedPillTabsTriggerClassName;

  const getEntityDisplayName = (entityType: EntityType) => entityLabel(entityType);

  const headerPicturePending =
    !removePicture && pendingPictureFile ? pendingPictureFile : null;
  const headerPictureUrl =
    !removePicture && !pendingPictureFile ? formData.picture_url || null : null;

  const editingInstance = instances.find((instance) => instance.id === editingInstanceId) ?? null;
  const editStatusLabel = resolveInventoryInstanceStatus(editingInstance);
  const editStatusAvailable = isInventoryInstanceAvailable(editingInstance);

  const installerLabel = (() => {
    if (!formData.installed_by_id) return '—';
    const user = users.find((entry) => String(entry.id) === formData.installed_by_id);
    return user ? user.full_name || user.username : '—';
  })();

  const installationDateLabel = formData.installation_date
    ? new Date(`${formData.installation_date}T00:00:00`).toLocaleDateString()
    : '—';

  const editingSerialLabel =
    formData.serial_number?.trim() ||
    instances.find((instance) => instance.id === editingInstanceId)?.serial_number?.trim() ||
    '';

  const showEditUnitsTab =
    inventoryUsesInstances(selectedEntityType) &&
    !editingSerialOnly &&
    instances.length > 1;

  const showEditStockQuantity = !editingSerialOnly;

  const editStatusSoftStyle = (() => {
    if (!editStatusLabel || editStatusLabel === '—') return undefined;
    const hex =
      workflowStatusColor(editStatusLabel) ||
      DEFAULT_STATUS_COLOR_BY_NAME[editStatusLabel] ||
      '#5B9BD5';
    return {
      backgroundColor: hexToRgba(hex, 0.16),
      color: hex,
      borderColor: hexToRgba(hex, 0.35),
    } as const;
  })();

  const renderInventoryFormTabs = (
    mode: 'create' | 'edit',
    options?: { stickyHeader?: ReactNode }
  ) => (
    <Tabs
      value={formTab}
      onValueChange={setFormTab}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        {options?.stickyHeader}
        <div className="px-6 py-3">
          <AnimatedPillTabsList value={formTab}>
            <TabsTrigger value="general" className={tabTriggerClassName}>
              General
            </TabsTrigger>
            <TabsTrigger value="holder" className={tabTriggerClassName}>
              Location
            </TabsTrigger>
            <TabsTrigger value="cost" className={tabTriggerClassName}>
              Cost
            </TabsTrigger>
            <TabsTrigger value="attachments" className={tabTriggerClassName}>
              Attachments
            </TabsTrigger>
            {mode === 'edit' && showEditUnitsTab ? (
              <TabsTrigger value="units" className={tabTriggerClassName}>
                Units
              </TabsTrigger>
            ) : null}
          </AnimatedPillTabsList>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <TabsContent value="general" className={formTabClassName}>
          {mode === 'create' ? (
            <>
              <div>
                <Label>Inventory Type *</Label>
                <Select
                  value={selectedEntityType}
                  disabled={restockInventoryId != null}
                  onValueChange={(value) => {
                    const newType = value as EntityType;
                    setSelectedEntityType(newType);
                    setFormData({
                      ...formData,
                      inventory_type: value,
                      name: '',
                      part_number: '',
                      serial_number: '',
                      quantity: formData.quantity || 1,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{entityLabel('system')}</SelectItem>
                    <SelectItem value="subsystem">{entityLabel('subsystem')}</SelectItem>
                    <SelectItem value="module">{entityLabel('module')}</SelectItem>
                    <SelectItem value="unit">{entityLabel('unit')}</SelectItem>
                    <SelectItem value="component">{entityLabel('component')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{getEntityDisplayName(selectedEntityType)} Category *</Label>
                <Select
                  value={formData.name}
                  disabled={restockInventoryId != null}
                  onValueChange={(value) => {
                    setFormData((prev) =>
                      applyDefinitionIdentifiers(selectedEntityType, value, prev.oem_name, prev)
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`Select from Entity List (${entityLabel(selectedEntityType)})`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {entityListNames.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        {`No ${entityLabel(selectedEntityType, true).toLowerCase()} in Entity List — add in Definitions`}
                      </SelectItem>
                    ) : (
                      entityListNames.map((entry) => (
                        <SelectItem key={entry.id} value={entry.name}>
                          {entry.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity || ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setFormData({ ...formData, quantity: isNaN(val) ? 0 : val });
                  }}
                  placeholder="Enter quantity"
                />
              </div>
            </>
          ) : showEditStockQuantity ? (
            <div>
              <Label>Quantity in stock</Label>
              <Input value={String(formData.quantity || 0)} disabled />
              <p className="text-xs text-muted-foreground">
                Use + on the inventory list to restock (opens Add Inventory with this item).
              </p>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Short description of this item"
            />
          </div>

          <div>
            <Label>Vendor / OEM acronym</Label>
            <Input
              value={formData.oem_name}
              onChange={(e) => setFormData({ ...formData, oem_name: e.target.value })}
              placeholder="e.g. AMP"
            />
            <p className="text-xs text-muted-foreground">
              Used when generating part and serial numbers.
            </p>
          </div>

          {mode === 'edit' && selectedEntityType === 'component' ? (
            <div>
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Component SKU"
              />
            </div>
          ) : null}

          {mode === 'edit' && editingSerialOnly ? (
            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Installation</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Installation date
                  </p>
                  <p className="text-sm">{installationDateLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Installed by
                  </p>
                  <p className="text-sm">{installerLabel}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Filled automatically when a developer starts install and HM/PD verifies it.
              </p>
            </div>
          ) : null}

          <div className="sm:col-span-2 space-y-3">
            <Label>Picture</Label>
            <FileDropZone
              accept="image/*"
              restLabel="photo files or drop"
              hint="(jpg, png, webp, etc)"
              selectedLabel={
                removePicture
                  ? null
                  : pendingPictureFile?.name ||
                    (formData.picture_url ? 'Current photo on file' : null)
              }
              onClear={() => {
                setFormData({ ...formData, picture_url: '' });
                setPendingPictureFile(null);
                setRemovePicture(true);
              }}
              onFiles={(files) => {
                setPendingPictureFile(files[0] ?? null);
                setRemovePicture(false);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="holder" className={formTabClassName}>
          {inventoryUsesInstances(selectedEntityType) && mode === 'edit' && editingInstanceId ? (
            <p className="text-sm text-muted-foreground">
              Location and holder apply to the selected unit.
            </p>
          ) : null}
          {inventoryUsesInstances(selectedEntityType) && mode === 'create' ? (
            <p className="text-sm text-muted-foreground">
              Location and holder apply to each new unit being added.
            </p>
          ) : null}
          <div>
            <Label>Inventory Holder</Label>
            {mode === 'create' ? (
              <>
                <Input value={inventoryHolderLabel} disabled />
                <p className="text-xs text-muted-foreground">
                  Warehouse stock is held by the Inventory Manager who adds the item.
                </p>
              </>
            ) : (
              <Select
                value={formData.holder_user_id || ''}
                onValueChange={(value) => setFormData({ ...formData, holder_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inventory holder" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <CascadingLocationSelects
            tree={definitions.inventory_location_tree}
            required={mode === 'create'}
            value={{
              location_room: formData.location_room,
              location_cabinet: formData.location_cabinet,
              location_rack: formData.location_rack,
            }}
            onChange={(next) => setFormData({ ...formData, ...next })}
          />

          <div>
            <Label>Added Date</Label>
            <Input
              type="date"
              value={formData.added_date}
              onChange={(e) => setFormData({ ...formData, added_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Shelf Life Expires</Label>
            <Input
              type="date"
              value={formData.shelf_life_expires_at}
              onChange={(e) =>
                setFormData({ ...formData, shelf_life_expires_at: e.target.value })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="cost" className={formTabSingleClassName}>
          {mode === 'edit' && !restockInventoryId ? (
            <InventoryCostTab
              quantity={Math.max(instances.length, 1)}
              value={costTabValueFromForm()}
              onChange={applyCostTabValue}
              existingUnits={
                instances.length > 0
                  ? instances.map((instance) => ({
                      id: instance.id,
                      label:
                        instance.serial_number ||
                        `Unit #${instance.id}`,
                      cost:
                        existingUnitCostEdits[instance.id] ??
                        (instance.unit_cost != null
                          ? String(instance.unit_cost)
                          : ''),
                    }))
                  : undefined
              }
              onExistingUnitCostChange={(id, cost) => {
                setExistingUnitCostEdits((prev) => ({
                  ...prev,
                  [Number(id)]: cost,
                }));
              }}
            />
          ) : (
            <InventoryCostTab
              quantity={formData.quantity || 1}
              value={costTabValueFromForm()}
              onChange={applyCostTabValue}
            />
          )}
        </TabsContent>

        <TabsContent value="attachments" className={formTabSingleClassName}>
          <EntityAttachmentsSection
            ownerType={
              inventoryUsesInstances(selectedEntityType) && editingInstanceId
                ? 'inventory_instance'
                : 'inventory'
            }
            ownerId={
              mode === 'edit'
                ? inventoryUsesInstances(selectedEntityType)
                  ? editingInstanceId
                  : editingId
                : null
            }
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsChange={setPendingAttachments}
          />
        </TabsContent>

        {mode === 'edit' && showEditUnitsTab ? (
          <TabsContent value="units" className={formTabSingleClassName}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {instances.length} unit{instances.length === 1 ? '' : 's'} in this group
              </p>
              {canCreateInventory ? (
                <Button type="button" size="sm" variant="outline" onClick={handleAddInstance}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Unit
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-visible rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="serial_number"
                      sort={instanceEditorSort}
                      onSort={cycleInstanceEditorSort}
                    >
                      Unit Identity
                    </SortableTableHead>
                    <SortableTableHead
                      column="location"
                      sort={instanceEditorSort}
                      onSort={cycleInstanceEditorSort}
                    >
                      Location
                    </SortableTableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        No inventory units yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEditorInstances.map((instance) => {
                      const unitStatus = resolveInventoryInstanceStatus(instance);
                      return (
                        <TableRow
                          key={instance.id}
                          className={
                            editingInstanceId === instance.id ? 'bg-muted/50' : undefined
                          }
                        >
                          <TableCell className="font-mono text-sm">
                            {instance.serial_number || '—'}
                          </TableCell>
                          <TableCell title={instance.location || undefined}>
                            {formatInventoryLocationAbbrev(instance)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={unitStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Can permission={P.edit_inventory}>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    editingGroup && loadInstanceIntoForm(instance, editingGroup)
                                  }
                                >
                                  Edit
                                </Button>
                              </Can>
                              <Can permission={P.delete_inventory}>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (!editingGroup) return;
                                    requestDeleteInstance(editingGroup, instance);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          </TabsContent>
        ) : null}
      </div>
    </Tabs>
  );


  function findExistingStockGroup(type: EntityType, name: string): InventoryItem | undefined {
    const normalized = name.trim().toLowerCase();
    return inventory.find(
      (item) =>
        item.inventory_type === type &&
        (item.entityName || item.name || '').trim().toLowerCase() === normalized
    );
  }

  function applyDefinitionIdentifiers(
    type: EntityType,
    name: string,
    vendor: string,
    prev: typeof formData
  ): typeof formData {
    if (!name.trim()) return prev;
    const entityListHit = entityListNames.find((entry) => entry.name === name);
    const existing = findExistingStockGroup(type, name);

    if (existing) {
      const partNumber = inventoryPartNumber(existing) || existing.part_number || '';
      const relatedEntities = inventoryEntitiesForType(type, entityPools);
      const serial_number = canSuggestInventorySerial(existing)
        ? suggestNextInventorySerial(existing, relatedEntities)
        : prev.serial_number;
      return {
        ...prev,
        name,
        part_number: partNumber,
        serial_number,
        configuration_item: existing.configuration_item || partNumber || prev.configuration_item,
        sku: type === 'component' ? existing.sku || prev.sku : prev.sku,
      };
    }

    const { pnSeq, snSeq } = nextInventorySequences(inventory, type, name);
    const ids = buildEntityIdentifiersFromDefinitions(definitions, {
      name,
      level: type,
      entityAbbr: entityListHit?.abbreviation || suggestAbbreviation(name),
      vendor: vendor.trim() || prev.oem_name.trim(),
      seq: snSeq,
      pnSeq,
    });
    return {
      ...prev,
      name,
      part_number: ids.part_number,
      serial_number: ids.serial_number,
      configuration_item: ids.configuration_item || ids.part_number,
      sku: type === 'component' ? ids.sku : prev.sku,
    };
  }

  if (loading && inventory.length === 0) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-2">
            {inventoryManager
              ? 'Manage warehouse inventory for all entity types'
              : 'Items currently issued to you — return unused stock to Admin when finished'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {inventoryManager && (selectedCount > 0 || selectingAll) ? (
            <Can permission={P.delete_inventory}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectingAll
                    ? 'Selecting all…'
                    : allMatchingSelected
                      ? `All ${selectedCount} selected`
                      : `${selectedCount} selected`}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const knownSelected = inventory.filter((item) => selectedIds.has(item.id));
                    const blocked = knownSelected.filter((item) => !isInventoryFullyDeletable(item));
                    if (blocked.length > 0) {
                      setDeleteBlockedTarget({
                        item: blocked[0],
                        instances: getBlockedDeleteInstances(blocked[0]),
                      });
                      return;
                    }
                    setBulkDeleteOpen(true);
                  }}
                  disabled={bulkDeleting || selectingAll || selectedCount === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={bulkDeleting || selectingAll}
                >
                  Clear
                </Button>
              </div>
            </Can>
          ) : null}
          <Can permission={P.view_inventory}>
            <Button variant="outline" size="sm" asChild>
              <Link href="/scan">
                <ScanLine className="mr-2 h-4 w-4" />
                Scan
              </Link>
            </Button>
          </Can>
          <Can permission={P.view_inventory}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exportBusy}>
                  <Download className="mr-2 h-4 w-4" />
                  {exportBusy ? 'Exporting…' : 'Export'}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleExport('csv')}>
                  Export CSV (one row per part number)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExport('json')}>
                  Export JSON (part number + child serials)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
          {canCreateInventory && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportFile(null);
                setImportPreview(null);
                setIsImportOpen(true);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          {inventoryManager ? (
            <Can permission={P.inventory_label_generate}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkLabelsOpen(true)}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Generate all labels
              </Button>
            </Can>
          ) : null}
          <Can permission={P.view_inventory_issuances}>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory/issuances">
                <ListOrdered className="mr-2 h-4 w-4" />
                Issuances
              </Link>
            </Button>
          </Can>
          <Can permission={[P.inventory_issue_workflow, P.issue_inventory]}>
            <Button variant="outline" size="sm" asChild>
              <Link href="/issue-queue">Issue queue</Link>
            </Button>
          </Can>
          <ListStatsVisibilityControls
            className="contents"
            checkboxLabel="Show KPIs"
            checkboxPosition="end"
            showStats={showStats}
            onShowStatsChange={setShowStats}
            onRefresh={async () => {
              await Promise.all([pagination.refetch(), refetchInventoryStats()]);
            }}
          />
        </div>
      </div>

      {showStats ? (
        <ListContentSuspense loading={inventoryStatsFetching && !inventoryStats}>
          <InventoryKpiDashboard
            stats={inventoryStats}
            loading={inventoryStatsFetching}
          />
        </ListContentSuspense>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-50 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, serial number, or part number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STOCK_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => applyStockFilter(value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  stockFilter === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (open) {
                if (!openingRestockRef.current) {
                  resetForm({ forCreate: true });
                }
                openingRestockRef.current = false;
              } else {
                resetForm();
              }
            }}
          >
            {canCreateInventory ? (
              <Can permission={P.create_inventory}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
              </Can>
            ) : null}
            <DialogContent className={inventoryDialogClassName}>
              {renderInventoryFormTabs('create', {
                stickyHeader: (
                  <DialogHeader className="space-y-1 px-6 pt-5 pb-1 text-left">
                    <div className="flex items-start gap-3">
                      <InventoryPictureThumb
                        pendingFile={headerPicturePending}
                        pictureUrl={
                          restockInventoryId && !removePicture
                            ? formData.picture_url || null
                            : null
                        }
                        ownerType="inventory"
                        ownerId={restockInventoryId}
                        alt={formData.name || 'New inventory item'}
                        size="md"
                        showPlaceholder
                      />
                      <div className="min-w-0 space-y-1">
                        <DialogTitle>
                          {restockInventoryId
                            ? `Add stock — ${formData.name || 'Inventory'}`
                            : 'Add Inventory Item'}
                        </DialogTitle>
                        <DialogDescription>
                          {restockInventoryId
                            ? 'Quantity, location, and cost apply to the new units for this catalog item.'
                            : 'Choose the type and category, then set quantity, location, and cost for the new stock.'}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                ),
              })}
              <div className="flex shrink-0 justify-end gap-3 border-t bg-background px-6 py-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>
                  {restockInventoryId ? 'Add stock' : 'Add to inventory'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          {ENTITY_TYPE_FILTERS.map(({ value, label, activeClass, inactiveClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => setEntityTypeFilter(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                entityTypeFilter === value ? activeClass : inactiveClass
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
          <CardDescription>
            Showing {inventory.length} on this page · {pagination.total} total in database
          </CardDescription>
          <CardAction>
            <ColumnVisibilityMenu
              columns={COLUMN_DEFS}
              visibleIds={visibleIds}
              onToggle={toggleColumn}
              onReset={resetColumns}
            />
          </CardAction>
          {inventoryManager && selectingAll ? (
            <p className="text-sm text-muted-foreground pt-2">
              Selecting all {pagination.total} matching items…
            </p>
          ) : inventoryManager && allMatchingSelected ? (
            <p className="text-sm text-muted-foreground pt-2">
              All {pagination.total} matching items selected across every page
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <Table
            className="table-fixed"
            containerClassName="rounded-md border"
          >
              <TableHeader>
                <TableRow>
                  {inventoryManager ? (
                    <TableHead className="w-10 pl-2">
                      <Can permission={P.delete_inventory}>
                        <Checkbox
                          checked={
                            allMatchingSelected
                              ? true
                              : someSelected || selectingAll
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                          aria-label="Select all inventory items across all pages"
                          disabled={inventory.length === 0 || selectingAll}
                        />
                      </Can>
                    </TableHead>
                  ) : null}
                  <TableHead className="w-10" />
                  {isVisible('name') && (
                    <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Category</SortableTableHead>
                  )}
                  {isVisible('inventory_type') && (
                    <SortableTableHead className="w-28" column="inventory_type" sort={sort} onSort={cycleSort}>Type</SortableTableHead>
                  )}
                  {isVisible('total_used') && (
                    <TableHead className="w-24" title="Units of this part number already installed into entities">
                      Total Used
                    </TableHead>
                  )}
                  {isVisible('quantity') && (
                    <SortableTableHead className="w-28" column="quantity" sort={sort} onSort={cycleSort}>Quantity</SortableTableHead>
                  )}
                  {isVisible('total_stock_cost') && (
                    <SortableTableHead
                      className="w-32"
                      column="total_stock_cost"
                      sort={sort}
                      onSort={cycleSort}
                    >
                      Total Cost
                    </SortableTableHead>
                  )}
                  {isVisible('holder_user_id') && (
                    <SortableTableHead column="holder_user_id" sort={sort} onSort={cycleSort}>Inventory Holder</SortableTableHead>
                  )}
                  {isVisible('location') && (
                    <SortableTableHead column="location" sort={sort} onSort={cycleSort}>Location</SortableTableHead>
                  )}
                  <TableHead className="sticky right-0 top-0 z-30 w-64 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={inventoryTableColSpan} className="text-center text-muted-foreground py-8">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.map((item) => {
                    const serialInstances = getExpandableSerialInstances(item, stockFilter);
                    const isExpandable = serialInstances.length >= 1;
                    const isExpanded = expandedRows.has(item.id);
                    const isSelected = selectedIds.has(item.id);

                    return (
                      <Fragment key={item.id}>
                        <TableRow
                          className={cn(
                            'group',
                            isExpanded && 'bg-muted/30',
                            isSelected && 'bg-muted/50'
                          )}
                          data-state={isSelected ? 'selected' : undefined}
                        >
                          {inventoryManager ? (
                            <TableCell className="p-2 w-10 pl-2">
                              <Can permission={P.delete_inventory}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) =>
                                    toggleRowSelected(item.id, checked === true)
                                  }
                                  aria-label={`Select ${item.entityName || item.name}`}
                                />
                              </Can>
                            </TableCell>
                          ) : null}
                          <TableCell className="p-2 w-10">
                            {isExpandable ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleExpandedRow(item.id)}
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? 'Collapse inventory units'
                                    : `Expand ${serialInstances.length} inventory units`
                                }
                                title={
                                  isExpanded
                                    ? 'Collapse'
                                    : `Show all ${serialInstances.length} inventory units`
                                }
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              </Button>
                            ) : null}
                          </TableCell>
                          {isVisible('name') && (
                            <TableCell
                              className="max-w-0"
                              title={item.entityName || 'N/A'}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {item.picture_url ? (
                                  <EntityPicture
                                    src={item.picture_url}
                                    ownerType="inventory"
                                    ownerId={item.id}
                                    alt={item.entityName || item.name || 'Inventory'}
                                    className="h-7 w-7 shrink-0 rounded-md border object-cover"
                                  />
                                ) : null}
                                <span className="truncate font-medium">
                                  {item.entityName || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          {isVisible('inventory_type') && (
                            <TableCell>
                              {item.inventory_type ? (
                                <StatusBadge
                                  status={
                                    item.inventory_type.charAt(0).toUpperCase() +
                                    item.inventory_type.slice(1)
                                  }
                                />
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          )}
                          {isVisible('total_used') && <TableCell>{item.totalUsed ?? 0}</TableCell>}
                          {isVisible('quantity') && (
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span>{item.quantity}</span>
                                {(item.reserved_quantity ?? 0) > 0 ||
                                (item.instances ?? []).some(isProjectReservedInstance) ? (
                                  <Badge variant="secondary" className="w-fit text-[10px]">
                                    {item.available_quantity ??
                                      Math.max(0, item.quantity - (item.reserved_quantity ?? 0))}{' '}
                                    avail
                                    {(item.instances ?? []).filter(isProjectReservedInstance).length >
                                    0
                                      ? ` · ${(item.instances ?? []).filter(isProjectReservedInstance).length} reserved`
                                      : ''}
                                    {(item.reserved_quantity ?? 0) > 0
                                      ? ` · ${item.reserved_quantity} issued`
                                      : ''}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                          )}
                          {isVisible('total_stock_cost') && (
                            <TableCell className="tabular-nums">
                              {formatInventoryMoney(
                                item.total_stock_cost,
                                item.currency || 'PKR'
                              )}
                            </TableCell>
                          )}
                          {isVisible('holder_user_id') && (
                            <TableCell className="max-w-0 truncate" title={item.holderName || '—'}>
                              {item.holderName || '—'}
                            </TableCell>
                          )}
                          {isVisible('location') && (
                            <TableCell
                              className="max-w-0 truncate"
                              title={
                                item.location?.trim() ||
                                [
                                  item.location_room,
                                  item.location_cabinet,
                                  item.location_rack,
                                ]
                                  .map((part) => part?.trim())
                                  .filter(Boolean)
                                  .join(' / ') ||
                                item.displayLocation ||
                                '—'
                              }
                            >
                              {item.displayLocation || '—'}
                            </TableCell>
                          )}
                          <TableCell
                            className={cn(
                              'sticky right-0 z-10 w-64 text-right group-hover:bg-muted/50',
                              isSelected ? 'bg-muted/50' : isExpanded ? 'bg-muted/30' : 'bg-background'
                            )}
                          >
                            <div className="flex shrink-0 justify-end gap-0.5">
                              {item.quantity >= 0 && canAddStock ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/add')}
                                  onClick={() => openAddMore(item)}
                                  title="Add More"
                                  aria-label="Add More"
                                >
                                  <Plus className={ACTION_ICON.add} />
                                </Button>
                              ) : null}
                              <Can permission={[P.inventory_label_generate, P.inventory_label_print]}>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/label')}
                                  onClick={() => setLabelTarget({ item })}
                                  title="Generate, print, or view labels"
                                  aria-label="Generate, print, or view labels"
                                >
                                  <Tag className="size-3.5 text-muted-foreground transition-colors group-hover/label:text-violet-600" />
                                </Button>
                              </Can>
                              {!inventoryManager &&
                              ((item.instances ?? []).some(
                                (i) =>
                                  i.open_issuance_id &&
                                  i.open_issuance_status !== 'return_pending'
                              ) ||
                                (!(item.instances ?? []).length &&
                                  (item.available_quantity ?? item.quantity) > 0)) ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/issue')}
                                  title="Request return to admin"
                                  aria-label="Request return to admin"
                                  onClick={async () => {
                                    try {
                                      let id =
                                        (item.instances ?? []).find(
                                          (i) =>
                                            i.open_issuance_id &&
                                            i.open_issuance_status !== 'return_pending'
                                        )?.open_issuance_id ?? null;
                                      if (!id) {
                                        const res = await api.inventory.listIssuances({
                                          inventory_id: item.id,
                                          status: 'issued',
                                        });
                                        id = res.data?.[0]?.id ?? null;
                                      }
                                      if (!id) {
                                        toast.error('No open issuance found to return');
                                        return;
                                      }
                                      setReturnIssuanceId(id);
                                    } catch (err: unknown) {
                                      const detail =
                                        (err as { response?: { data?: { detail?: string } } })
                                          ?.response?.data?.detail || 'Failed to prepare return';
                                      toast.error(
                                        typeof detail === 'string' ? detail : 'Failed to prepare return'
                                      );
                                    }
                                  }}
                                >
                                  <Undo2 className={ACTION_ICON.issue} />
                                </Button>
                              ) : null}
                              {!inventoryManager &&
                              (item.instances ?? []).some(
                                (i) => i.open_issuance_status === 'return_pending'
                              ) &&
                              !(item.instances ?? []).some(
                                (i) =>
                                  i.open_issuance_id &&
                                  i.open_issuance_status !== 'return_pending'
                              ) ? (
                                <span
                                  className="px-1 text-[10px] text-muted-foreground"
                                  title="Awaiting admin acceptance"
                                >
                                  Pending
                                </span>
                              ) : null}
                              <Can permission={P.edit_inventory}>
                                {canEditInventory ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/edit')}
                                  onClick={() => openEdit(item)}
                                  title="Edit"
                                  aria-label="Edit"
                                >
                                  <Edit className={ACTION_ICON.edit} />
                                </Button>
                                ) : null}
                              </Can>
                              <Can permission={P.delete_inventory}>
                                {inventoryManager ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/delete')}
                                  onClick={() => requestDeleteItem(item)}
                                  title="Delete"
                                  aria-label="Delete"
                                >
                                  <Trash2 className={ACTION_ICON.delete} />
                                </Button>
                                ) : null}
                              </Can>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && isExpandable ? (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={inventoryTableColSpan} className="min-w-0 overflow-x-hidden p-0">
                              <div className="min-w-0 overflow-x-hidden px-4 py-3">
                                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                  <h4 className="text-sm font-semibold">
                                    Part Number{' '}
                                    <span className="font-mono">
                                      {item.partNumber || '—'}
                                    </span>
                                  </h4>
                                  <span className="text-xs text-muted-foreground">
                                    {serialInstances.length} unit
                                    {serialInstances.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                                <ExpandedInventoryUnitsTable
                                  serialInstances={serialInstances}
                                  users={users}
                                  containerClassName={cn(
                                    'min-w-0 rounded-md border bg-background overflow-x-hidden',
                                    serialInstances.length > MAX_VISIBLE_EXPANDED_UNITS &&
                                      EXPANDED_UNITS_SCROLL_CLASS
                                  )}
                                >
                                  {(sortedSerialInstances) =>
                                    sortedSerialInstances.map((instance, index) => {
                                      const serialLabel =
                                        instanceSerialNumber(instance) || `Unit ${index + 1}`;
                                      const holderLabel = displayUserName(
                                        users,
                                        instance.holder_user_id,
                                        instance.holder_name
                                      );
                                      const locationLabel = formatInventoryLocationAbbrev(instance);
                                      const locationTitle =
                                        instance.location?.trim() ||
                                        [
                                          instance.location_room,
                                          instance.location_cabinet,
                                          instance.location_rack,
                                        ]
                                          .map((part) => part?.trim())
                                          .filter(Boolean)
                                          .join(' / ') ||
                                        locationLabel;
                                      return (
                                        <TableRow key={instance.id}>
                                          <TableCell
                                            className={cn(EXPANDED_CELL_TRUNCATE, 'font-mono text-sm')}
                                            title={serialLabel}
                                          >
                                            {canEditInventory ? (
                                              <button
                                                type="button"
                                                className="block w-full truncate text-left cursor-pointer"
                                                onClick={() => void openEdit(item, instance.id)}
                                                title={`Edit ${serialLabel}`}
                                              >
                                                {serialLabel}
                                              </button>
                                            ) : isProjectReservedInstance(instance) ? (
                                              <button
                                                type="button"
                                                className="block w-full truncate text-left cursor-pointer"
                                                onClick={() =>
                                                  setReservationHoldInstance(instance)
                                                }
                                                title="View reservation details"
                                              >
                                                {serialLabel}
                                              </button>
                                            ) : (
                                              serialLabel
                                            )}
                                          </TableCell>
                                          <TableCell
                                            className={EXPANDED_CELL_TRUNCATE}
                                            title={holderLabel}
                                          >
                                            {holderLabel}
                                          </TableCell>
                                          <TableCell
                                            className={EXPANDED_CELL_TRUNCATE}
                                            title={locationTitle}
                                          >
                                            {locationLabel}
                                          </TableCell>
                                          <TableCell className="w-28 overflow-hidden">
                                            {isProjectReservedInstance(instance) &&
                                            !instance.is_reserved ? (
                                              <button
                                                type="button"
                                                className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                onClick={() =>
                                                  setReservationHoldInstance(instance)
                                                }
                                                title="View reservation details"
                                              >
                                                <StatusBadge
                                                  status={resolveInventoryInstanceStatus(instance)}
                                                />
                                              </button>
                                            ) : (
                                              <StatusBadge
                                                status={resolveInventoryInstanceStatus(instance)}
                                              />
                                            )}
                                          </TableCell>
                                          <TableCell className="w-44 p-1 text-right">
                                            <div className="flex flex-nowrap justify-end">
                                              <Can permission={[P.inventory_label_generate, P.inventory_label_print]}>
                                                <Button
                                                  size="icon-sm"
                                                  variant="ghost"
                                                  className={cn(ACTION_BTN, 'group/label')}
                                                  title="Generate, print, or view this serial label"
                                                  aria-label="Generate, print, or view this serial label"
                                                  onClick={() => setLabelTarget({ item, instance })}
                                                >
                                                  <Tag className="size-3.5 text-muted-foreground transition-colors group-hover/label:text-violet-600" />
                                                </Button>
                                              </Can>
                                              <Can permission={P.edit_inventory}>
                                                {canEditInventory ? (
                                                  <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className={cn(ACTION_BTN, 'group/edit')}
                                                    title="Edit this unit"
                                                    aria-label={`Edit ${serialLabel}`}
                                                    onClick={() => void openEdit(item, instance.id)}
                                                  >
                                                    <Edit className={ACTION_ICON.edit} />
                                                  </Button>
                                                ) : null}
                                              </Can>
                                              <Can permission={P.delete_inventory}>
                                                {inventoryManager ? (
                                                  <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className={cn(ACTION_BTN, 'group/delete')}
                                                    title="Delete this unit"
                                                    aria-label={`Delete ${serialLabel}`}
                                                    onClick={() =>
                                                      requestDeleteInstance(item, instance)
                                                    }
                                                  >
                                                    <Trash2 className={ACTION_ICON.delete} />
                                                  </Button>
                                                ) : null}
                                              </Can>
                                              {instance.is_reserved &&
                                              instance.open_issuance_id &&
                                              instance.open_issuance_status !== 'return_pending' &&
                                              !inventoryManager ? (
                                                <Button
                                                  size="icon-sm"
                                                  variant="ghost"
                                                  className={cn(ACTION_BTN, 'group/issue')}
                                                  title="Request return to admin"
                                                  aria-label="Request return to admin"
                                                  onClick={() => {
                                                    if (instance.open_issuance_id) {
                                                      setReturnIssuanceId(instance.open_issuance_id);
                                                    }
                                                  }}
                                                >
                                                  <Undo2 className={ACTION_ICON.issue} />
                                                </Button>
                                              ) : null}
                                              {instance.open_issuance_status === 'return_pending' &&
                                              !inventoryManager ? (
                                                <span
                                                  className="text-[10px] text-muted-foreground"
                                                  title="Awaiting admin acceptance"
                                                >
                                                  Pending
                                                </span>
                                              ) : null}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })
                                  }
                                </ExpandedInventoryUnitsTable>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
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

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingSerialOnly(false);
          }
        }}
      >
        <DialogContent className={inventoryDialogClassName}>
          {renderInventoryFormTabs('edit', {
            stickyHeader: (
              <DialogHeader className="space-y-2 bg-sky-50/40 px-6 pt-5 pb-1 text-left dark:bg-sky-950/20">
                <div className="flex items-start gap-3">
                  <InventoryPictureThumb
                    pendingFile={headerPicturePending}
                    pictureUrl={headerPictureUrl}
                    ownerType="inventory"
                    ownerId={editingId}
                    alt={formData.name || 'Inventory item'}
                    size="md"
                    showPlaceholder
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <DialogTitle>Edit Inventory Item</DialogTitle>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {getEntityDisplayName(selectedEntityType)}
                      </span>
                      <span className="text-base font-semibold tracking-tight text-foreground">
                        {formData.name || '—'}
                      </span>
                      {editingSerialOnly && editStatusLabel !== '—' ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                          style={editStatusSoftStyle}
                        >
                          {editStatusAvailable ? (
                            <LockOpen className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <Lock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                          )}
                          {editStatusLabel}
                        </span>
                      ) : null}
                      {editingSerialOnly ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex text-muted-foreground/70 hover:text-muted-foreground"
                                aria-label="Status is managed by workflow"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              {editStatusAvailable
                                ? 'Available for use (unlocked). Status changes automatically when reserved, issued, or installed.'
                                : 'Not available (locked) because this unit is reserved, issued, or installed. Status is set by workflow.'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </div>
                    {editingSerialOnly && editingSerialLabel ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        Serial {editingSerialLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                <DialogDescription className="sr-only">
                  Edit {getEntityDisplayName(selectedEntityType)}
                  {formData.name ? ` ${formData.name}` : ''}
                  {editingSerialOnly && editingSerialLabel
                    ? `, serial ${editingSerialLabel}`
                    : ''}
                </DialogDescription>
              </DialogHeader>
            ),
          })}
          <div className="flex shrink-0 justify-end gap-3 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <InventoryDeleteDialog
        item={deleteTarget}
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleteAll={handleDeleteAll}
        onDeleteOne={handleDeleteOneSerial}
      />

      <InventoryDeleteBlockedDialog
        item={deleteBlockedTarget?.item ?? null}
        instances={deleteBlockedTarget?.instances ?? []}
        open={deleteBlockedTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteBlockedTarget(null);
        }}
      />

      <InventoryReservationHoldDialog
        instance={reservationHoldInstance}
        open={reservationHoldInstance != null}
        onOpenChange={(open) => {
          if (!open) setReservationHoldInstance(null);
        }}
      />

      {labelTarget ? (
        <InventoryLabelDialog
          item={labelTarget.item}
          instance={labelTarget.instance}
          open
          onOpenChange={(open) => {
            if (!open) setLabelTarget(null);
          }}
        />
      ) : null}

      <InventoryBulkLabelDialog
        open={bulkLabelsOpen}
        onOpenChange={setBulkLabelsOpen}
      />

      <IssuanceRemarksDialog
        open={returnIssuanceId != null}
        onOpenChange={(open) => {
          if (!open && !returnRemarksBusy) setReturnIssuanceId(null);
        }}
        action="return"
        busy={returnRemarksBusy}
        onConfirm={async (notes) => {
          if (returnIssuanceId == null) return;
          setReturnRemarksBusy(true);
          try {
            await api.inventory.returnIssuance(returnIssuanceId, notes);
            toast.success('Return requested — waiting for admin acceptance');
            setReturnIssuanceId(null);
            void pagination.invalidate();
          } catch (err: unknown) {
            const detail =
              (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
              'Failed to return';
            toast.error(typeof detail === 'string' ? detail : 'Failed to return');
          } finally {
            setReturnRemarksBusy(false);
          }
        }}
      />

      {/* Inventory Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!importSubmitting) setIsImportOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>
              Upload CSV or JSON. One catalog row is created per part number; extra serials
              become child units under that part. Required fields:{' '}
              <code className="text-xs font-mono bg-muted px-1 rounded">name</code>,{' '}
              <code className="text-xs font-mono bg-muted px-1 rounded">inventory_type</code>,{' '}
              <code className="text-xs font-mono bg-muted px-1 rounded">part_number</code>.
              Serials: <code className="text-xs font-mono bg-muted px-1 rounded">serial_numbers</code>{' '}
              (CSV, semicolon-separated) or nested <code className="text-xs font-mono bg-muted px-1 rounded">instances[]</code> (JSON).
              Duplicate rows with the same part number are merged instead of creating new items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <FileDropZone
              accept=".csv,.json,text/csv,application/json"
              disabled={importSubmitting || importValidating}
              restLabel="CSV or JSON files or drop"
              hint="(.csv, .json)"
              selectedLabel={importFile?.name ?? null}
              onClear={() => {
                setImportFile(null);
                setImportPreview(null);
              }}
              onFiles={(files) => void handleImportFileSelected(files[0] ?? null)}
            />

            {importValidating && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Validating…
              </p>
            )}

            {importPreview && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                {importPreview.valid_rows > 0 && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {importPreview.groups ?? importPreview.valid_rows} part number
                      {(importPreview.groups ?? importPreview.valid_rows) !== 1 ? 's' : ''} ready
                      {(importPreview.instances ?? 0) > 0
                        ? ` · ${importPreview.instances} serial${importPreview.instances === 1 ? '' : 's'}`
                        : ''}
                    </span>
                  </div>
                )}
                {importPreview.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{importPreview.errors.length} row{importPreview.errors.length !== 1 ? 's' : ''} with errors</span>
                    </div>
                    <ul className="ml-6 list-disc text-destructive/80 space-y-0.5 max-h-36 overflow-y-auto">
                      {importPreview.errors.map((e) => (
                        <li key={e.row}>
                          Row {e.row}: {e.errors.join('; ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={importSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleImportConfirm()}
              disabled={
                !importFile ||
                importValidating ||
                importSubmitting ||
                (importPreview?.errors.length ?? 0) > 0
              }
            >
              {importSubmitting ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (bulkDeleting) return;
          setBulkDeleteOpen(open);
        }}
        title="Delete selected inventory"
        description={`Delete ${selectedCount} selected inventory item${selectedCount === 1 ? '' : 's'} and all of their serial numbers? This cannot be undone.`}
        onConfirm={() => void handleBulkDelete()}
      />

      <ConfirmDialog
        open={instanceDeleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setInstanceDeleteTarget(null);
        }}
        title="Delete inventory unit"
        description={
          instanceDeleteTarget
            ? `Delete unit ${instanceSerialNumber(instanceDeleteTarget.instance) || `#${instanceDeleteTarget.instance.id}`} from ${instanceDeleteTarget.item.name}? This cannot be undone.`
            : ''
        }
        confirmValue={
          instanceDeleteTarget
            ? instanceSerialNumber(instanceDeleteTarget.instance) || `Unit ${instanceDeleteTarget.instance.id}`
            : undefined
        }
        confirmPrompt="To confirm deletion, type this unit identity:"
        confirmInputLabel="Unit identity"
        confirmPlaceholder="Enter unit identity"
        onConfirm={() => {
          if (!instanceDeleteTarget) return;
          const instanceId = instanceDeleteTarget.instance.id;
          setInstanceDeleteTarget(null);
          void handleDeleteInstance(instanceId);
        }}
      />
    </div>
  );
}
