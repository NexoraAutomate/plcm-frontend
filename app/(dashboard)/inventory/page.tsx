'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Plus, Edit, Trash2, Search, Layers } from 'lucide-react';
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
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  formatInventorySerialNumbers,
  inventorySupportsQuantity,
  inventoryUsesInstances,
  resolveInventoryQuantity,
} from '@/lib/entity-hierarchy';
import { canAddInventoryChildren } from '@/lib/inventory-child-install';
import { needsSerialSelection } from '@/lib/inventory-install';
import { InventorySerialSelectDialog } from '@/components/inventory-serial-select-dialog';

type EntityType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

interface InventoryItem extends Inventory {
  entityName?: string;
  serialNumber?: string;
  partNumber?: string;
  holderName?: string;
  displayLocation?: string;
}

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

function enrichInventoryItems(items: Inventory[], users: User[]): InventoryItem[] {
  return items.map((item) => {
    const holderId = resolveInventoryHolderId(item);
    const holder = holderId ? users.find((user) => user.id === holderId) : undefined;

    return {
      ...item,
      entityName: item.name,
      serialNumber: formatInventorySerialNumbers(item),
      partNumber: inventoryPartNumber(item),
      holderName: holder ? formatUserRef(holder) : '—',
      displayLocation: resolveInventoryLocation(item),
    };
  });
}

export default function InventoryPage() {
  const router = useRouter();
  const { users, statuses } = useDataStore();
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const inventoryTypeParam = entityTypeFilter !== 'all' ? entityTypeFilter : undefined;
  const pagination = usePaginatedList({
    queryKey: queryKeys.inventoryPage(inventoryTypeParam),
    fetchPage: (skip, limit) => fetchInventoryPage(skip, limit, inventoryTypeParam),
  });
  const inventory = useMemo(
    () => enrichInventoryItems(pagination.items, users),
    [pagination.items, users]
  );
  const loading = pagination.loading;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<Inventory | null>(null);
  const [instances, setInstances] = useState<InventoryInstance[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });
  const [addChildrenItem, setAddChildrenItem] = useState<InventoryItem | null>(null);

  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('component');
  const { data: hierarchyCategories = [] } = useHierarchiesQuery(selectedEntityType);
  const [formData, setFormData] = useState({ ...emptyInventoryEntityForm });
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [formTab, setFormTab] = useState('general');

  useEffect(() => {
    pagination.setPage(0);
  }, [search, entityTypeFilter]);

  const filtered = inventory.filter((item) => {
    const matchesType = entityTypeFilter === 'all' || item.inventory_type === entityTypeFilter;
    const matchesSearch =
      search === '' ||
      item.entityName?.toLowerCase().includes(search.toLowerCase()) ||
      item.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      item.partNumber?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

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

  async function confirmDelete() {
    if (deleteConfirm.id === null) return;

    try {
      await api.inventory.delete(deleteConfirm.id);
      toast.success('Inventory item deleted');
      pagination.invalidate();
    } catch (err) {
      console.error('Failed to delete inventory item:', err);
      toast.error('Failed to delete inventory item');
    } finally {
      setDeleteConfirm({ open: false, id: null });
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
    if (!editingId) return;
    if (!formData.location.trim()) {
      toast.error('Location is required for each serialized unit');
      return;
    }

    try {
      const created = await api.inventory.createInstance(editingId, buildInstancePayload());
      if (created.data?.id) {
        await syncMedia('inventory_instance', created.data.id);
      }
      const refreshed = await api.inventory.get(editingId);
      const nextInstances = refreshed.data?.instances ?? [];
      setInstances(nextInstances);
      if (created.data) {
        loadInstanceIntoForm(created.data, refreshed.data ?? undefined);
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
    'top-[8vh] max-h-[90vh] translate-y-0 overflow-y-auto sm:max-w-xl';

  const renderInventoryFormTabs = (mode: 'create' | 'edit') => (
    <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
      <TabsList className="flex h-auto w-full gap-0.5 p-1">
        <TabsTrigger value="general" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          General
        </TabsTrigger>
        <TabsTrigger value="part-number" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Part Number
        </TabsTrigger>
        <TabsTrigger value="holder" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Holder
        </TabsTrigger>
        <TabsTrigger value="install" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Install
        </TabsTrigger>
        <TabsTrigger value="picture" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Picture
        </TabsTrigger>
        <TabsTrigger value="attachments" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Attachments
        </TabsTrigger>
        {mode === 'edit' && inventoryUsesInstances(selectedEntityType) ? (
          <TabsTrigger value="units" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
            Units
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
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
            <p className="mt-1 text-xs text-muted-foreground">
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
            <p className="mt-1 text-xs text-muted-foreground">
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

        <div>
          <Label>Description</Label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Item description"
          />
        </div>
      </TabsContent>

      <TabsContent value="part-number" className="mt-4 space-y-4">
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
            <p className="mt-1 text-xs text-muted-foreground">
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

        <div>
          <Label>OEM Name</Label>
          <Input
            value={formData.oem_name}
            onChange={(e) => setFormData({ ...formData, oem_name: e.target.value })}
            placeholder="Original Equipment Manufacturer"
          />
        </div>
      </TabsContent>

      <TabsContent value="holder" className="mt-4 space-y-4">
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

      <TabsContent value="install" className="mt-4 space-y-4">
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

      <TabsContent value="picture" className="mt-4 space-y-4">
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
          <div>
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

      <TabsContent value="attachments" className="mt-4 space-y-4">
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
        <TabsContent value="units" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {instances.length} serialized unit{instances.length === 1 ? '' : 's'} in this group
            </p>
            <Button type="button" size="sm" variant="outline" onClick={handleAddInstance}>
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
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
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => editingGroup && loadInstanceIntoForm(instance, editingGroup)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteInstance(instance.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </Tabs>
  );

  const getEntityDisplayName = (entityType: EntityType) => {
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground mt-2">Manage inventory for all entity types</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, serial number, or part number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={entityTypeFilter} onValueChange={(value) => setEntityTypeFilter(value as EntityType | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="subsystem">Subsystem</SelectItem>
            <SelectItem value="module">Module</SelectItem>
            <SelectItem value="unit">Unit</SelectItem>
            <SelectItem value="component">Component</SelectItem>
          </SelectContent>
        </Select>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (open) setFormTab('general');
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className={inventoryDialogClassName}>
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
              <DialogDescription>Add a new inventory item for any entity type</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {renderInventoryFormTabs('create')}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Add</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Inventory Holder</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.entityName || 'N/A'}</TableCell>
                      <TableCell className="capitalize">{item.inventory_type}</TableCell>
                      <TableCell>{item.partNumber || '—'}</TableCell>
                      <TableCell>{item.serialNumber || '—'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.holderName || '—'}</TableCell>
                      <TableCell>{item.displayLocation || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {canAddInventoryChildren(item.inventory_type) ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAddChildrenClick(item)}
                            >
                              <Layers className="mr-1 h-4 w-4" />
                              Add Children
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ open: true, id: item.id })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
        <DialogContent className={inventoryDialogClassName}>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update inventory details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {renderInventoryFormTabs('edit')}

            <div className="flex gap-2 justify-end pt-4">
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

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, open, id: open ? prev.id : null }))
        }
        title="Delete Inventory Item"
        description="Are you sure you want to delete this inventory item? This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
