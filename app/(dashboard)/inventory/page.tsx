'use client';

import { Fragment, useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, Layers, Network, Copy, ChevronDown, PackageMinus, ListOrdered, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { EntityAttachmentsSection, type PendingAttachmentUpload } from '@/components/entity-attachments-section';
import {
  emptyInventoryEntityForm,
  inventoryFormFromInstance,
  inventoryFormFromItem,
  inventoryGroupFieldsFromForm,
  inventoryInstanceFieldsFromForm,
  inventoryPartNumber,
} from '@/lib/inventory-entity-fields';
import type { Inventory, InventoryInstance, User } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { useDataStore } from '@/lib/data-store';
import { useHierarchiesQuery } from '@/hooks/queries';
import { fetchInventoryPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import {
  getInventorySerialNumbers,
  inventorySupportsQuantity,
  inventoryUsesInstances,
  resolveInventoryQuantity,
} from '@/lib/entity-hierarchy';
import {
  calculateInventoryTotalUsed,
  canSuggestInventorySerial,
  inventoryEntitiesForType,
  suggestNextInventorySerial,
} from '@/lib/inventory-serial';
import {
  canAddInventoryChildren,
  resolveInventoryInstanceSerial,
} from '@/lib/inventory-child-install';
import { getSelectableInstances, needsSerialSelection } from '@/lib/inventory-install';
import { duplicateInventoryEntity } from '@/lib/inventory-duplicate';
import { InventorySerialSelectDialog } from '@/components/inventory-serial-select-dialog';
import { InventoryDeleteDialog } from '@/components/inventory-delete-dialog';
import { InventoryHierarchyDialog } from '@/components/inventory-hierarchy-dialog';
import { InventoryIssueDialog } from '@/components/inventory-issue-dialog';
import { isInventoryInStock } from '@/lib/inventory-filter';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Can } from '@/components/auth/can';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

const ACTION_BTN =
  'h-7 w-7 bg-transparent shadow-none border-0 hover:bg-transparent';

const ACTION_ICON = {
  add: 'size-3.5 text-muted-foreground transition-colors group-hover/add:text-emerald-600',
  children: 'size-3.5 text-muted-foreground transition-colors group-hover/children:text-violet-600',
  hierarchy: 'size-3.5 text-muted-foreground transition-colors group-hover/hierarchy:text-cyan-600',
  duplicate: 'size-3.5 text-muted-foreground transition-colors group-hover/duplicate:text-amber-600',
  issue: 'size-3.5 text-muted-foreground transition-colors group-hover/issue:text-orange-600',
  edit: 'size-3.5 text-muted-foreground transition-colors group-hover/edit:text-blue-600',
  delete: 'size-3.5 text-muted-foreground transition-colors group-hover/delete:text-red-600',
} as const;

type EntityType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';
type StockFilter = 'all' | 'available' | 'out_of_stock';

const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const ENTITY_TYPE_FILTERS: {
  value: EntityType | 'all';
  label: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: 'all',
    label: 'All Types',
    activeClass: 'border-primary bg-primary text-primary-foreground',
    inactiveClass: 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted',
  },
  {
    value: 'system',
    label: 'System',
    activeClass:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    inactiveClass:
      'border-blue-100/80 bg-blue-50/40 text-blue-600/70 hover:bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400/70 dark:hover:bg-blue-950/60',
  },
  {
    value: 'subsystem',
    label: 'Subsystem',
    activeClass:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    inactiveClass:
      'border-sky-100/80 bg-sky-50/40 text-sky-600/70 hover:bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400/70 dark:hover:bg-sky-950/60',
  },
  {
    value: 'module',
    label: 'Module',
    activeClass:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    inactiveClass:
      'border-indigo-100/80 bg-indigo-50/40 text-indigo-600/70 hover:bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400/70 dark:hover:bg-indigo-950/60',
  },
  {
    value: 'unit',
    label: 'Unit',
    activeClass:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    inactiveClass:
      'border-cyan-100/80 bg-cyan-50/40 text-cyan-600/70 hover:bg-cyan-50/70 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-400/70 dark:hover:bg-cyan-950/60',
  },
  {
    value: 'component',
    label: 'Component',
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

function resolveInventoryHolderId(item: Inventory): number | undefined {
  if (item.holder_user_id) return item.holder_user_id;
  return item.instances?.find((instance) => instance.holder_user_id)?.holder_user_id;
}

function resolveInventoryLocation(item: Inventory): string {
  if (item.location?.trim()) return item.location;
  const locations = (item.instances ?? [])
    .map((instance) => instance.location?.trim())
    .filter((location): location is string => Boolean(location));
  if (locations.length === 0) return '—';
  return [...new Set(locations)].join(', ');
}

function instanceSerialNumber(instance: InventoryInstance): string {
  return instance.original_serial_number?.trim() || instance.serial_number?.trim() || '';
}

/** Serial numbers for expandable rows: one per in-stock instance when present. */
function getExpandableSerialInstances(item: Inventory): InventoryInstance[] {
  if (!inventoryUsesInstances(item.inventory_type as EntityType)) return [];
  const all = (item.instances ?? []).filter((instance) => Boolean(instance?.id));
  return all.filter((instance) => Boolean(instanceSerialNumber(instance)));
}

function enrichInventoryItems(
  items: Inventory[],
  users: User[],
  entityPools: HierarchyEntityPools
): InventoryItem[] {
  return items.map((item) => {
    const holderId = resolveInventoryHolderId(item);
    const holder = holderId ? users.find((user) => user.id === holderId) : undefined;

    const serialNumbers = getInventorySerialNumbers(item);
    const firstAvailable =
      getExpandableSerialInstances(item)
        .map(instanceSerialNumber)
        .find(Boolean) || serialNumbers[0];
    const relatedEntities = inventoryEntitiesForType(item.inventory_type, entityPools);

    return {
      ...item,
      entityName: item.name,
      serialNumbers,
      serialNumber: firstAvailable || '—',
      partNumber: inventoryPartNumber(item),
      holderName: holder ? formatUserRef(holder) : '—',
      displayLocation: resolveInventoryLocation(item),
      totalUsed: calculateInventoryTotalUsed(item, relatedEntities),
    };
  });
}

export default function InventoryPage() {
  const router = useRouter();
  const { can, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const canCreateInventory = inventoryManager && can(P.create_inventory);
  const canEditInventory = inventoryManager && can(P.edit_inventory);
  const canAddStock = canCreateInventory || canEditInventory;
  const canIssue = inventoryManager && can(P.issue_inventory);
  const { users, statuses, systems, subsystems, modules, units, components, ensureHierarchyLoaded } =
    useDataStore();
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const inventoryTypeParam = entityTypeFilter !== 'all' ? entityTypeFilter : undefined;
  const listFilters = useMemo(() => ({ ...listFilterPatch }), [listFilterPatch]);
  const pagination = usePaginatedList({
    queryKey: queryKeys.inventoryPage(inventoryTypeParam, listFilters),
    fetchPage: (skip, limit, filters) =>
      fetchInventoryPage(skip, limit, inventoryTypeParam, filters),
    filters: listFilters,
  });
  const entityPools = useMemo(
    () => ({ systems, subsystems, modules, units, components }),
    [systems, subsystems, modules, units, components]
  );
  const inventory = useMemo(
    () => enrichInventoryItems(pagination.items, users, entityPools),
    [pagination.items, users, entityPools]
  );
  const loading = pagination.loading;

  useEffect(() => {
    void ensureHierarchyLoaded();
  }, [ensureHierarchyLoaded]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<Inventory | null>(null);
  const [instances, setInstances] = useState<InventoryInstance[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [addChildrenItem, setAddChildrenItem] = useState<InventoryItem | null>(null);
  const [hierarchySerialSelectItem, setHierarchySerialSelectItem] = useState<InventoryItem | null>(
    null
  );
  const [hierarchyView, setHierarchyView] = useState<{
    item: InventoryItem;
    instanceId?: number;
  } | null>(null);
  const [duplicateSerialSelectItem, setDuplicateSerialSelectItem] = useState<InventoryItem | null>(
    null
  );
  const [duplicateTarget, setDuplicateTarget] = useState<{
    item: InventoryItem;
    instanceId?: number;
  } | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateForm, setDuplicateForm] = useState({
    serial_number: '',
    holder_user_id: '',
    location: '',
  });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [addMoreItem, setAddMoreItem] = useState<InventoryItem | null>(null);
  const [addMoreSubmitting, setAddMoreSubmitting] = useState(false);
  const [addMoreForm, setAddMoreForm] = useState({
    serial_number: '',
    holder_user_id: '',
    location: '',
  });
  const [issueTarget, setIssueTarget] = useState<{
    item: InventoryItem;
    instanceId?: number;
  } | null>(null);

  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('component');
  const { data: hierarchyCategories = [] } = useHierarchiesQuery(selectedEntityType);
  const [formData, setFormData] = useState({ ...emptyInventoryEntityForm });
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [formTab, setFormTab] = useState('general');

  useEffect(() => {
    pagination.setPage(0);
  }, [search, entityTypeFilter, stockFilter]);

  const filtered = inventory.filter((item) => {
    const searchLower = search.toLowerCase();
    const matchesType = entityTypeFilter === 'all' || item.inventory_type === entityTypeFilter;
    const matchesSearch =
      search === '' ||
      item.entityName?.toLowerCase().includes(searchLower) ||
      item.serialNumber?.toLowerCase().includes(searchLower) ||
      item.serialNumbers?.some((serial) => serial.toLowerCase().includes(searchLower)) ||
      item.partNumber?.toLowerCase().includes(searchLower);
    const inStock = isInventoryInStock(item);
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'available' && inStock) ||
      (stockFilter === 'out_of_stock' && !inStock);
    return matchesType && matchesSearch && matchesStock;
  });

  function toggleExpandedRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function navigateToAddChildren(item: InventoryItem, instanceId?: number) {
    const query = instanceId != null ? `?instanceId=${instanceId}` : '';
    router.push(`/inventory/${item.id}/add-children${query}`);
  }

  function handleAddChildrenClick(item: InventoryItem) {
    if (needsSerialSelection(item)) {
      setAddChildrenItem(item);
      return;
    }
    navigateToAddChildren(item);
  }

  function openHierarchyView(item: InventoryItem, instanceId?: number) {
    setHierarchyView({ item, instanceId });
  }

  function handleViewHierarchyClick(item: InventoryItem) {
    if (needsSerialSelection(item)) {
      setHierarchySerialSelectItem(item);
      return;
    }
    const instances = getSelectableInstances(item);
    const instanceId = instances.length === 1 ? instances[0].id : undefined;
    openHierarchyView(item, instanceId);
  }

  function openDuplicateForm(item: InventoryItem, instanceId?: number) {
    const instance =
      instanceId != null
        ? item.instances?.find((entry) => entry.id === instanceId)
        : item.instances?.length === 1
          ? item.instances[0]
          : undefined;
    const holderId =
      instance?.holder_user_id ?? resolveInventoryHolderId(item) ?? undefined;
    const location =
      instance?.location?.trim() ||
      (item.location?.trim() && item.location !== '—' ? item.location.trim() : '') ||
      '';

    setDuplicateTarget({ item, instanceId });
    setDuplicateForm({
      serial_number: '',
      holder_user_id: holderId != null ? String(holderId) : '',
      location,
    });
  }

  async function handleDuplicateConfirm() {
    if (!duplicateTarget) return;

    const serialNumber = duplicateForm.serial_number.trim();
    const location = duplicateForm.location.trim();
    if (!serialNumber || !location) {
      toast.error('Serial number and location are required');
      return;
    }
    if (!duplicateForm.holder_user_id) {
      toast.error('Inventory holder is required');
      return;
    }

    const holderUserId = Number(duplicateForm.holder_user_id);
    const { item, instanceId } = duplicateTarget;
    setDuplicating(true);
    try {
      const result = await duplicateInventoryEntity(item, {
        instanceId,
        overrides: {
          serialNumber,
          holderUserId,
          location,
        },
      });
      toast.success(
        result.serial
          ? `Duplicated ${item.name} as ${result.serial}`
          : `Duplicated ${item.name}`
      );
      setDuplicateTarget(null);
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to duplicate inventory item:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate inventory item');
    } finally {
      setDuplicating(false);
    }
  }

  function handleDuplicateClick(item: InventoryItem) {
    if (duplicating) return;
    if (needsSerialSelection(item)) {
      setDuplicateSerialSelectItem(item);
      return;
    }
    const instances = getSelectableInstances(item);
    const instanceId = instances.length === 1 ? instances[0].id : undefined;
    openDuplicateForm(item, instanceId);
  }

  function openAddMore(item: InventoryItem) {
    const relatedEntities = inventoryEntitiesForType(item.inventory_type, entityPools);
    const nextSerial = canSuggestInventorySerial(item)
      ? suggestNextInventorySerial(item, relatedEntities)
      : '';
    setAddMoreItem(item);
    setAddMoreForm({
      serial_number: nextSerial,
      holder_user_id: '',
      location: '',
    });
  }

  async function handleAddMore() {
    if (!addMoreItem) return;

    const serialNumber = addMoreForm.serial_number.trim();
    const location = addMoreForm.location.trim();
    if (!serialNumber || !location) {
      toast.error('Serial number and location are required');
      return;
    }
    if (!addMoreForm.holder_user_id) {
      toast.error('Inventory holder is required');
      return;
    }

    const holderUserId = Number(addMoreForm.holder_user_id);
    setAddMoreSubmitting(true);
    try {
      if (inventoryUsesInstances(addMoreItem.inventory_type as EntityType)) {
        await api.inventory.createInstance(addMoreItem.id, {
          serial_number: serialNumber,
          holder_user_id: holderUserId,
          location,
        });
      } else {
        await api.inventory.create({
          name: addMoreItem.name,
          inventory_type: addMoreItem.inventory_type,
          description: addMoreItem.description,
          oem_name: addMoreItem.oem_name,
          part_number: addMoreItem.part_number,
          configuration_item: addMoreItem.configuration_item,
          status_id: addMoreItem.status_id,
          sku: addMoreItem.sku,
          quantity: 1,
          serial_number: serialNumber,
          holder_user_id: holderUserId,
          location,
        });
      }
      toast.success(`Added another ${addMoreItem.name} to inventory`);
      setAddMoreItem(null);
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to add more inventory:', err);
      toast.error('Failed to add inventory unit');
    } finally {
      setAddMoreSubmitting(false);
    }
  }

  const resetForm = () => {
    setFormData({ ...emptyInventoryEntityForm });
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setSelectedEntityType('component');
    setEditingInstanceId(null);
    setEditingGroup(null);
    setInstances([]);
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

  async function syncMedia(ownerType: 'inventory' | 'inventory_instance', ownerId: number) {
    if (removePicture) {
      await api.pictures.remove(ownerType, ownerId);
    } else if (pendingPictureFile) {
      await api.pictures.upload(ownerType, ownerId, pendingPictureFile);
    }
    if (pendingAttachments.length > 0) {
      for (const attachment of pendingAttachments) {
        await api.attachments.upload(ownerType, ownerId, attachment.file, {
          attachment_type: attachment.attachment_type,
          description: attachment.description,
        });
      }
    }
  }

  const buildInventoryPayload = () => ({
    ...buildGroupPayload(),
    ...(inventoryUsesInstances(selectedEntityType) ? buildInstancePayload() : {}),
  });

  async function handleCreate() {
    const usesInstances = inventoryUsesInstances(selectedEntityType);

    if (!formData.name.trim() || (!usesInstances && !formData.location.trim())) {
      toast.error(
        `Please fill in required fields: ${getEntityDisplayName(selectedEntityType)} category${
          usesInstances ? '' : ' and Location'
        }`
      );
      return;
    }
    if (usesInstances && !formData.part_number.trim()) {
      toast.error('Part number is required for serialized inventory');
      return;
    }
    if (usesInstances && !formData.location.trim()) {
      toast.error('Location is required for each serialized unit');
      return;
    }
    if (inventorySupportsQuantity(selectedEntityType) && formData.quantity <= 0) {
      toast.error('Please enter a quantity greater than 0 for component inventory');
      return;
    }

    try {
      const payload = buildInventoryPayload();
      const created = await api.inventory.create(payload);
      if (created.data?.id) {
        const mediaOwnerType = usesInstances ? 'inventory_instance' : 'inventory';
        const mediaOwnerId = usesInstances
          ? getLatestInstanceId(created.data)
          : created.data.id;
        if (mediaOwnerId) {
          await syncMedia(mediaOwnerType, mediaOwnerId);
        }
      }
      toast.success(
        usesInstances
          ? 'Serialized unit added to inventory group'
          : 'Inventory item created'
      );
      pagination.invalidate();

      resetForm();
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Failed to create inventory item:', err);
      toast.error('Failed to create inventory item');
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    const usesInstances = inventoryUsesInstances(selectedEntityType);

    if (!formData.name.trim() || (!usesInstances && !formData.location.trim())) {
      toast.error(
        `Please fill in required fields: Name${usesInstances ? '' : ' and Location'}`
      );
      return;
    }
    if (usesInstances && editingInstanceId && !formData.location.trim()) {
      toast.error('Location is required for each serialized unit');
      return;
    }
    if (inventorySupportsQuantity(selectedEntityType) && formData.quantity <= 0) {
      toast.error('Please enter a quantity greater than 0 for component inventory');
      return;
    }

    try {
      await api.inventory.update(editingId, buildGroupPayload());

      if (usesInstances && editingInstanceId) {
        await api.inventory.updateInstance(editingInstanceId, buildInstancePayload());
        const mediaOwnerId = editingInstanceId;
        await syncMedia('inventory_instance', mediaOwnerId);
      } else if (!usesInstances) {
        await syncMedia('inventory', editingId);
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
    if (!formData.location.trim()) {
      toast.error('Location is required for each serialized unit');
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
        original_serial_number: formData.original_serial_number.trim() || nextSerial,
      });
      if (created.data?.id) {
        await syncMedia('inventory_instance', created.data.id);
      }
      const refreshed = await api.inventory.get(editingId);
      const nextInstances = refreshed.data?.instances ?? [];
      setInstances(nextInstances);
      if (refreshed.data) {
        setEditingGroup(refreshed.data);
      }
      if (created.data) {
        loadInstanceIntoForm(created.data, refreshed.data ?? undefined);
      }
      const suggested = suggestNextInventorySerial(
        { ...(refreshed.data ?? editingGroup), instances: nextInstances },
        relatedEntities
      );
      if (suggested) {
        setFormData((prev) => ({
          ...prev,
          serial_number: suggested,
          original_serial_number: suggested,
        }));
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
      const refreshed = editingId ? await api.inventory.get(editingId) : null;
      if (!refreshed?.data) {
        pagination.invalidate();
        resetForm();
        setEditingId(null);
        setIsEditOpen(false);
        toast.success('Inventory group removed');
        return;
      }
      const nextInstances = refreshed.data.instances ?? [];
      setInstances(nextInstances);
      if (nextInstances.length > 0 && refreshed.data) {
        loadInstanceIntoForm(nextInstances[0], refreshed.data);
      } else {
        setEditingInstanceId(null);
      }
      toast.success('Serialized unit removed');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to delete inventory unit:', err);
      toast.error('Failed to delete serialized unit');
    }
  }

  async function openEdit(item: InventoryItem) {
    setEditingId(item.id);
    setFormTab('general');
    setSelectedEntityType(item.inventory_type as EntityType);
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setRemovePicture(false);

    try {
      const res = await api.inventory.get(item.id);
      const fullItem = res.data ?? item;
      setEditingGroup(fullItem);
      const itemInstances = fullItem.instances ?? [];
      setInstances(itemInstances);
      setFormData(inventoryFormFromItem(fullItem));

      if (inventoryUsesInstances(fullItem.inventory_type as EntityType) && itemInstances.length > 0) {
        loadInstanceIntoForm(itemInstances[0], fullItem);
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
    'top-[4vh] max-h-[92vh] w-[min(100vw-1.5rem,56rem)] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-4xl';

  const formTabClassName =
    'mt-0 grid grid-cols-1 gap-x-6 gap-y-5 p-1 sm:grid-cols-2 [&>div]:space-y-2 [&>p]:col-span-full';

  const formTabSingleClassName = 'mt-0 space-y-5 p-1 [&>div]:space-y-2';

  const renderInventoryFormTabs = (mode: 'create' | 'edit') => (
    <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
      <div className="border-b bg-muted/30 px-6 pt-2 pb-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-none bg-transparent p-0">
          <TabsTrigger
            value="general"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="part-number"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Part Number
          </TabsTrigger>
          <TabsTrigger
            value="holder"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Holder
          </TabsTrigger>
          <TabsTrigger
            value="install"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Install
          </TabsTrigger>
          <TabsTrigger
            value="picture"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Picture
          </TabsTrigger>
          <TabsTrigger
            value="attachments"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Attachments
          </TabsTrigger>
          {mode === 'edit' && inventoryUsesInstances(selectedEntityType) ? (
            <TabsTrigger
              value="units"
              className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Units
            </TabsTrigger>
          ) : null}
        </TabsList>
      </div>

      <div className="px-6 py-6">
      <TabsContent value="general" className={formTabClassName}>
        <div>
          <Label>Inventory Type {mode === 'create' ? '*' : ''}</Label>
          {mode === 'create' ? (
            <Select
              value={selectedEntityType}
              onValueChange={(value) => {
                const newType = value as EntityType;
                setSelectedEntityType(newType);
                setFormData({
                  ...formData,
                  inventory_type: value,
                  name: '',
                  quantity: inventorySupportsQuantity(newType) ? formData.quantity : 1,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="subsystem">Subsystem</SelectItem>
                <SelectItem value="module">Module</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="component">Component</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input value={getEntityDisplayName(selectedEntityType)} disabled />
          )}
        </div>

        <div>
          <Label>
            {getEntityDisplayName(selectedEntityType)} Category {mode === 'create' ? '*' : ''}
          </Label>
          <Select
            value={formData.name}
            onValueChange={(value) => setFormData({ ...formData, name: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${selectedEntityType} from hierarchy`} />
            </SelectTrigger>
            <SelectContent>
              {hierarchyCategories.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No categories defined in hierarchy
                </SelectItem>
              ) : (
                hierarchyCategories.map((hierarchy) => (
                  <SelectItem key={hierarchy.id} value={hierarchy.name}>
                    {hierarchy.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {inventorySupportsQuantity(selectedEntityType) ? (
          <div>
            <Label>Quantity {mode === 'create' ? '*' : ''}</Label>
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
            <p className="text-xs text-muted-foreground">
              Component inventory can be stocked in bulk.
            </p>
          </div>
        ) : (
          <div>
            <Label>Quantity</Label>
            <Input
              value={mode === 'edit' ? String(formData.quantity || 0) : 'Calculated automatically'}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Quantity is the total number of serialized units sharing this part number.
            </p>
          </div>
        )}

        {mode === 'edit' ? (
          <div>
            <Label>Status</Label>
            <Select
              value={formData.status_id || ''}
              onValueChange={(value) => setFormData({ ...formData, status_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.id} value={String(status.id)}>
                    {status.status_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {mode === 'edit' ? (
          <div>
            <Label>Configuration Item</Label>
            <Input
              value={formData.configuration_item}
              onChange={(e) => setFormData({ ...formData, configuration_item: e.target.value })}
              placeholder="Defaults to part number or name"
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Item description"
          />
        </div>
      </TabsContent>

      <TabsContent value="part-number" className={formTabClassName}>
        <div>
          <Label>
            Serial Number
            {inventoryUsesInstances(selectedEntityType) && mode === 'create' ? ' *' : ''}
          </Label>
          <Input
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            placeholder="e.g., SN-2024-001"
          />
          {inventoryUsesInstances(selectedEntityType) ? (
            <p className="text-xs text-muted-foreground">
              Each serialized unit gets its own serial number.
            </p>
          ) : null}
        </div>

        <div>
          <Label>
            Part Number
            {inventoryUsesInstances(selectedEntityType) ? ' *' : ''}
          </Label>
          <Input
            value={formData.part_number}
            onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
            placeholder="e.g., MPN-12345"
          />
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

        {mode === 'edit' ? (
          <>
            <div>
              <Label>Original Part Number</Label>
              <Input
                value={formData.original_part_number}
                onChange={(e) =>
                  setFormData({ ...formData, original_part_number: e.target.value })
                }
                placeholder="Original part number from manufacturer"
              />
            </div>

            <div>
              <Label>Original Serial Number</Label>
              <Input
                value={formData.original_serial_number}
                onChange={(e) =>
                  setFormData({ ...formData, original_serial_number: e.target.value })
                }
                placeholder="Original serial number"
              />
            </div>
          </>
        ) : null}

        <div className={mode === 'edit' ? undefined : 'sm:col-span-2'}>
          <Label>OEM Name</Label>
          <Input
            value={formData.oem_name}
            onChange={(e) => setFormData({ ...formData, oem_name: e.target.value })}
            placeholder="Original Equipment Manufacturer"
          />
        </div>
      </TabsContent>

      <TabsContent value="holder" className={formTabClassName}>
        {inventoryUsesInstances(selectedEntityType) && mode === 'edit' && editingInstanceId ? (
          <p className="text-sm text-muted-foreground">
            Holder details apply to the selected serialized unit.
          </p>
        ) : null}
        {inventoryUsesInstances(selectedEntityType) && mode === 'create' ? (
          <p className="text-sm text-muted-foreground">
            Holder details apply to the serialized unit being added.
          </p>
        ) : null}
        <div>
          <Label>Inventory Holder</Label>
          <Select
            value={formData.holder_user_id || ''}
            onValueChange={(value) => setFormData({ ...formData, holder_user_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select custodian" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.full_name || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Location {mode === 'create' ? '*' : ''}</Label>
          <Input
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Warehouse location"
          />
        </div>

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

      <TabsContent value="install" className={formTabClassName}>
        <div>
          <Label>Installation Date</Label>
          <Input
            type="date"
            value={formData.installation_date}
            onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
          />
        </div>
        <div>
          <Label>Installed By</Label>
          <Select
            value={formData.installed_by_id || ''}
            onValueChange={(value) => setFormData({ ...formData, installed_by_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select installer" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.full_name || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="picture" className={formTabClassName}>
        <div>
          <Label>Picture</Label>
          <Input
            value={formData.picture_url}
            onChange={(e) => {
              setFormData({ ...formData, picture_url: e.target.value });
              setRemovePicture(false);
            }}
            placeholder="Path or URL to item photo"
          />
        </div>

        <div>
          <Label>Or Upload Photo</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setPendingPictureFile(e.target.files?.[0] ?? null);
              setRemovePicture(false);
            }}
          />
        </div>

        {(formData.picture_url || pendingPictureFile) && !removePicture ? (
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFormData({ ...formData, picture_url: '' });
                setPendingPictureFile(null);
                setRemovePicture(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove photo
            </Button>
          </div>
        ) : null}
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

      {mode === 'edit' && inventoryUsesInstances(selectedEntityType) ? (
        <TabsContent value="units" className={formTabSingleClassName}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {instances.length} serialized unit{instances.length === 1 ? '' : 's'} in this group
            </p>
            {canCreateInventory ? (
              <Button type="button" size="sm" variant="outline" onClick={handleAddInstance}>
                <Plus className="mr-2 h-4 w-4" />
                Add Unit
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No serialized units yet
                    </TableCell>
                  </TableRow>
                ) : (
                  instances.map((instance) => (
                    <TableRow
                      key={instance.id}
                      className={editingInstanceId === instance.id ? 'bg-muted/50' : undefined}
                    >
                      <TableCell>{instance.serial_number || '—'}</TableCell>
                      <TableCell>{instance.location || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Can permission={P.edit_inventory}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => editingGroup && loadInstanceIntoForm(instance, editingGroup)}
                            >
                              Edit
                            </Button>
                          </Can>
                          <Can permission={P.delete_inventory}>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteInstance(instance.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      ) : null}
      </div>
    </Tabs>
  );

  const getEntityDisplayName = (entityType: EntityType) => {
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  };

  if (loading) return <PageLoader />;

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
        <Button variant="outline" asChild>
          <Link href="/inventory/issuances">
            <ListOrdered className="mr-2 h-4 w-4" />
            Issuances
          </Link>
        </Button>
      </div>

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
                onClick={() => setStockFilter(value)}
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
              if (open) setFormTab('general');
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
              <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
                <DialogTitle>Add Inventory Item</DialogTitle>
                <DialogDescription>Add a new inventory item for any entity type</DialogDescription>
              </DialogHeader>
              <div>
                {renderInventoryFormTabs('create')}

                <div className="flex justify-end gap-3 border-t px-6 py-4">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Add</Button>
                </div>
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
            Showing {filtered.length} on this page · {pagination.total} total in database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Category</SortableTableHead>
                  <SortableTableHead column="inventory_type" sort={sort} onSort={cycleSort}>Type</SortableTableHead>
                  <SortableTableHead column="part_number" sort={sort} onSort={cycleSort}>Part Number</SortableTableHead>
                  <TableHead title="Units of this part number already installed into entities">
                    Total Used
                  </TableHead>
                  <SortableTableHead column="quantity" sort={sort} onSort={cycleSort}>Quantity</SortableTableHead>
                  <SortableTableHead column="holder_user_id" sort={sort} onSort={cycleSort}>Inventory Holder</SortableTableHead>
                  <SortableTableHead column="location" sort={sort} onSort={cycleSort}>Location</SortableTableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => {
                    const serialInstances = getExpandableSerialInstances(item);
                    const isExpandable = serialInstances.length > 1;
                    const isExpanded = expandedRows.has(item.id);

                    return (
                      <Fragment key={item.id}>
                        <TableRow className={cn(isExpanded && 'bg-muted/30')}>
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
                                    ? 'Collapse serial numbers'
                                    : `Expand ${serialInstances.length} serial numbers`
                                }
                                title={
                                  isExpanded
                                    ? 'Collapse'
                                    : `Show all ${serialInstances.length} serial numbers`
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
                          <TableCell className="font-medium">{item.entityName || 'N/A'}</TableCell>
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
                          <TableCell>{item.partNumber || '—'}</TableCell>
                          <TableCell>{item.totalUsed ?? 0}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span>{item.quantity}</span>
                              {(item.reserved_quantity ?? 0) > 0 ? (
                                <Badge variant="secondary" className="w-fit text-[10px]">
                                  {item.available_quantity ?? Math.max(0, item.quantity - (item.reserved_quantity ?? 0))} avail ·{' '}
                                  {item.reserved_quantity} issued
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{item.holderName || '—'}</TableCell>
                          <TableCell>{item.displayLocation || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-0.5 justify-end">
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
                              {canAddInventoryChildren(item.inventory_type) && canAddStock ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/children')}
                                  onClick={() => handleAddChildrenClick(item)}
                                  title="Add Children"
                                  aria-label="Add Children"
                                >
                                  <Layers className={ACTION_ICON.children} />
                                </Button>
                              ) : null}
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className={cn(ACTION_BTN, 'group/hierarchy')}
                                onClick={() => handleViewHierarchyClick(item)}
                                title="View Hierarchy"
                                aria-label="View Hierarchy"
                              >
                                <Network className={ACTION_ICON.hierarchy} />
                              </Button>
                              {canAddStock ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/duplicate')}
                                  onClick={() => handleDuplicateClick(item)}
                                  disabled={duplicating}
                                  title="Duplicate"
                                  aria-label="Duplicate"
                                >
                                  <Copy className={ACTION_ICON.duplicate} />
                                </Button>
                              ) : null}
                              <Can permission={P.issue_inventory}>
                                {canIssue ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/issue')}
                                  onClick={() => setIssueTarget({ item })}
                                  title="Issue to developer"
                                  aria-label="Issue to developer"
                                  disabled={
                                    (item.available_quantity ?? item.quantity) <= 0 &&
                                    !(item.instances ?? []).some((i) => i.id && !i.is_reserved)
                                  }
                                >
                                  <PackageMinus className={ACTION_ICON.issue} />
                                </Button>
                                ) : null}
                              </Can>
                              {!inventoryManager &&
                              ((item.reserved_quantity ?? 0) > 0 ||
                                (item.instances ?? []).some((i) => i.open_issuance_id)) ? (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className={cn(ACTION_BTN, 'group/issue')}
                                  title="Return to admin"
                                  aria-label="Return to admin"
                                  onClick={async () => {
                                    try {
                                      let id =
                                        (item.instances ?? []).find((i) => i.open_issuance_id)
                                          ?.open_issuance_id ?? null;
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
                                      await api.inventory.returnIssuance(id);
                                      toast.success('Returned to admin warehouse');
                                      void pagination.invalidate();
                                    } catch (err: unknown) {
                                      const detail =
                                        (err as { response?: { data?: { detail?: string } } })
                                          ?.response?.data?.detail || 'Failed to return';
                                      toast.error(
                                        typeof detail === 'string' ? detail : 'Failed to return'
                                      );
                                    }
                                  }}
                                >
                                  <Undo2 className={ACTION_ICON.issue} />
                                </Button>
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
                                  onClick={() => setDeleteTarget(item)}
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
                            <TableCell colSpan={10} className="p-0">
                              <div className="px-6 py-3">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                  All serial numbers for part {item.partNumber || item.entityName || '—'}
                                </p>
                                <div className="overflow-x-auto rounded-md border bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Serial Number</TableHead>
                                        <TableHead>Inventory Holder</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-15" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {serialInstances.map((instance) => {
                                        const holder = instance.holder_user_id
                                          ? users.find((user) => user.id === instance.holder_user_id)
                                          : undefined;
                                        return (
                                          <TableRow key={instance.id}>
                                            <TableCell className="font-mono text-sm">
                                              {instanceSerialNumber(instance) || '—'}
                                            </TableCell>
                                            <TableCell>
                                              {holder ? formatUserRef(holder) : '—'}
                                            </TableCell>
                                            <TableCell>{instance.location?.trim() || '—'}</TableCell>
                                            <TableCell>
                                              {instance.is_reserved ? (
                                                <Badge variant="secondary">Issued</Badge>
                                              ) : (
                                                <span className="text-muted-foreground text-xs">Available</span>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {!instance.is_reserved && canIssue ? (
                                                <Can permission={P.issue_inventory}>
                                                  <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    className={cn(ACTION_BTN, 'group/issue')}
                                                    title="Issue this serial"
                                                    aria-label="Issue this serial"
                                                    onClick={() =>
                                                      setIssueTarget({ item, instanceId: instance.id })
                                                    }
                                                  >
                                                    <PackageMinus className={ACTION_ICON.issue} />
                                                  </Button>
                                                </Can>
                                              ) : null}
                                              {instance.is_reserved &&
                                              instance.open_issuance_id &&
                                              !inventoryManager ? (
                                                <Button
                                                  size="icon-sm"
                                                  variant="ghost"
                                                  className={cn(ACTION_BTN, 'group/issue')}
                                                  title="Return to admin"
                                                  aria-label="Return to admin"
                                                  onClick={async () => {
                                                    try {
                                                      await api.inventory.returnIssuance(
                                                        instance.open_issuance_id!
                                                      );
                                                      toast.success('Returned to admin warehouse');
                                                      void pagination.invalidate();
                                                    } catch (err: unknown) {
                                                      const detail =
                                                        (err as {
                                                          response?: { data?: { detail?: string } };
                                                        })?.response?.data?.detail ||
                                                        'Failed to return';
                                                      toast.error(
                                                        typeof detail === 'string'
                                                          ? detail
                                                          : 'Failed to return'
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <Undo2 className={ACTION_ICON.issue} />
                                                </Button>
                                              ) : null}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
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
        <DialogContent className={inventoryDialogClassName}>
          <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update inventory details</DialogDescription>
          </DialogHeader>
          <div>
            {renderInventoryFormTabs('edit')}

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <InventorySerialSelectDialog
        item={addChildrenItem}
        open={addChildrenItem != null}
        onOpenChange={(open) => {
          if (!open) setAddChildrenItem(null);
        }}
        confirmLabel="Continue"
        description={
          addChildrenItem
            ? `${addChildrenItem.name} has ${addChildrenItem.quantity} units in stock. Choose which serial number to add children under.`
            : undefined
        }
        onConfirm={(instanceId) => {
          if (addChildrenItem) {
            navigateToAddChildren(addChildrenItem, instanceId);
            setAddChildrenItem(null);
          }
        }}
      />

      <InventorySerialSelectDialog
        item={hierarchySerialSelectItem}
        open={hierarchySerialSelectItem != null}
        onOpenChange={(open) => {
          if (!open) setHierarchySerialSelectItem(null);
        }}
        confirmLabel="View Hierarchy"
        description={
          hierarchySerialSelectItem
            ? `${hierarchySerialSelectItem.name} has ${hierarchySerialSelectItem.quantity} units in stock. Choose which serial number to view in the hierarchy graph.`
            : undefined
        }
        onConfirm={(instanceId) => {
          if (hierarchySerialSelectItem) {
            openHierarchyView(hierarchySerialSelectItem, instanceId);
            setHierarchySerialSelectItem(null);
          }
        }}
      />

      <InventoryHierarchyDialog
        item={hierarchyView?.item ?? null}
        instanceId={hierarchyView?.instanceId}
        open={hierarchyView != null}
        onOpenChange={(open) => {
          if (!open) setHierarchyView(null);
        }}
      />

      <InventorySerialSelectDialog
        item={duplicateSerialSelectItem}
        open={duplicateSerialSelectItem != null}
        onOpenChange={(open) => {
          if (!open) setDuplicateSerialSelectItem(null);
        }}
        confirmLabel="Continue"
        description={
          duplicateSerialSelectItem
            ? `${duplicateSerialSelectItem.name} has ${duplicateSerialSelectItem.quantity} units in stock. Choose which serial number to duplicate (including children).`
            : undefined
        }
        onConfirm={(instanceId) => {
          if (!duplicateSerialSelectItem) return;
          const item = duplicateSerialSelectItem;
          setDuplicateSerialSelectItem(null);
          openDuplicateForm(item, instanceId);
        }}
      />

      <Dialog
        open={duplicateTarget != null}
        onOpenChange={(open) => {
          if (!open && !duplicating) setDuplicateTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Inventory Item</DialogTitle>
            <DialogDescription>
              {duplicateTarget
                ? (() => {
                    const sourceSerial = resolveInventoryInstanceSerial(
                      duplicateTarget.item,
                      duplicateTarget.instanceId ?? null
                    );
                    return `Create a copy of ${duplicateTarget.item.name}${
                      sourceSerial ? ` (from ${sourceSerial})` : ''
                    }, including any children. Enter the new serial number, holder, and location.`;
                  })()
                : 'Enter details for the duplicated inventory item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="duplicate-serial">Serial Number *</Label>
              <Input
                id="duplicate-serial"
                value={duplicateForm.serial_number}
                onChange={(e) =>
                  setDuplicateForm((prev) => ({ ...prev, serial_number: e.target.value }))
                }
                placeholder="e.g., SN-2024-001"
                disabled={duplicating}
              />
            </div>
            <div>
              <Label>Inventory Holder *</Label>
              <Select
                value={duplicateForm.holder_user_id || ''}
                onValueChange={(value) =>
                  setDuplicateForm((prev) => ({ ...prev, holder_user_id: value }))
                }
                disabled={duplicating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select custodian" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="duplicate-location">Location *</Label>
              <Input
                id="duplicate-location"
                value={duplicateForm.location}
                onChange={(e) =>
                  setDuplicateForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Warehouse location"
                disabled={duplicating}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDuplicateTarget(null)}
                disabled={duplicating}
              >
                Cancel
              </Button>
              <Button onClick={handleDuplicateConfirm} disabled={duplicating}>
                {duplicating ? 'Duplicating…' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMoreItem != null}
        onOpenChange={(open) => {
          if (!open && !addMoreSubmitting) setAddMoreItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add More Stock</DialogTitle>
            <DialogDescription>
              {addMoreItem
                ? `Add another ${addMoreItem.name} (${addMoreItem.inventory_type}). Serial number is suggested as one greater than the last existing unit.`
                : 'Add another unit of this inventory item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-more-serial">Serial Number *</Label>
              <Input
                id="add-more-serial"
                value={addMoreForm.serial_number}
                onChange={(e) =>
                  setAddMoreForm((prev) => ({ ...prev, serial_number: e.target.value }))
                }
                placeholder="Auto-suggested from last serial"
                disabled={addMoreSubmitting}
              />
            </div>
            <div>
              <Label>Inventory Holder *</Label>
              <Select
                value={addMoreForm.holder_user_id || ''}
                onValueChange={(value) =>
                  setAddMoreForm((prev) => ({ ...prev, holder_user_id: value }))
                }
                disabled={addMoreSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select custodian" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-more-location">Location *</Label>
              <Input
                id="add-more-location"
                value={addMoreForm.location}
                onChange={(e) =>
                  setAddMoreForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Warehouse location"
                disabled={addMoreSubmitting}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddMoreItem(null)}
                disabled={addMoreSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAddMore} disabled={addMoreSubmitting}>
                {addMoreSubmitting ? 'Adding…' : 'Add'}
              </Button>
            </div>
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

      <InventoryIssueDialog
        open={issueTarget != null}
        onOpenChange={(open) => {
          if (!open) setIssueTarget(null);
        }}
        item={issueTarget?.item ?? null}
        users={users}
        presetInstanceId={issueTarget?.instanceId}
        onIssued={() => {
          void pagination.invalidate();
        }}
      />
    </div>
  );
}
