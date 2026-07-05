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
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { ATTACHMENT_TYPES, type AttachmentType } from '@/lib/attachment-types';
import type { EntityAttachmentMetadata, Inventory } from '@/lib/models';
import { useDataStore } from '@/lib/data-store';
import { useHierarchiesQuery } from '@/hooks/queries';
import { fetchInventoryPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ConfirmDialog } from '@/components/confirm-dialog';

type EntityType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

interface InventoryItem extends Inventory {
  entityName?: string;
  serialNumber?: string;
  partNumber?: string;
}

function enrichInventoryItems(items: Inventory[]): InventoryItem[] {
  return items.map((item) => ({
    ...item,
    entityName: item.name,
    serialNumber: item.serial_number || '',
    partNumber: item.manufacturer_part_number || '',
  }));
}

export default function InventoryPage() {
  const { users } = useDataStore();
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');
  const inventoryTypeParam = entityTypeFilter !== 'all' ? entityTypeFilter : undefined;
  const pagination = usePaginatedList({
    queryKey: queryKeys.inventoryPage(inventoryTypeParam),
    fetchPage: (skip, limit) => fetchInventoryPage(skip, limit, inventoryTypeParam),
  });
  const inventory = useMemo(
    () => enrichInventoryItems(pagination.items),
    [pagination.items]
  );
  const loading = pagination.loading;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('component');
  const { data: hierarchyCategories = [] } = useHierarchiesQuery(selectedEntityType);
  const [formData, setFormData] = useState({
    name: '',
    inventory_type: 'component',
    serial_number: '',
    quantity: 0,
    description: '',
    oem_name: '',
    manufacturer_part_number: '',
    location: '',
    holder_user_id: '',
    added_date: '',
    shelf_life_expires_at: '',
    picture_url: '',
  });
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [pendingAttachmentMeta, setPendingAttachmentMeta] = useState<EntityAttachmentMetadata>({
    attachment_type: 'other',
    description: '',
  });
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

  const resetForm = () => {
    setFormData({
      name: '',
      inventory_type: 'component',
      serial_number: '',
      quantity: 0,
      description: '',
      oem_name: '',
      manufacturer_part_number: '',
      location: '',
      holder_user_id: '',
      added_date: '',
      shelf_life_expires_at: '',
      picture_url: '',
    });
    setPendingAttachment(null);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setPendingAttachmentMeta({ attachment_type: 'other', description: '' });
    setSelectedEntityType('component');
    setFormTab('general');
  };

  const buildInventoryPayload = () => ({
    name: formData.name,
    inventory_type: selectedEntityType,
    serial_number: formData.serial_number,
    quantity: formData.quantity,
    description: formData.description,
    oem_name: formData.oem_name,
    manufacturer_part_number: formData.manufacturer_part_number,
    location: formData.location,
    holder_user_id: formData.holder_user_id ? Number(formData.holder_user_id) : undefined,
    added_date: formData.added_date
      ? new Date(formData.added_date).toISOString()
      : undefined,
    shelf_life_expires_at: formData.shelf_life_expires_at
      ? new Date(formData.shelf_life_expires_at).toISOString()
      : undefined,
    picture_url: removePicture ? null : formData.picture_url || undefined,
  });

  async function handleCreate() {
    if (!formData.name.trim() || formData.quantity <= 0 || !formData.location.trim()) {
      toast.error(`Please fill in required fields: ${getEntityDisplayName(selectedEntityType)} category, Quantity (>0), and Location`);
      return;
    }

    try {
      const payload = buildInventoryPayload();

      const created = await api.inventory.create(payload);
      if (created.data?.id) {
        if (removePicture) {
          await api.pictures.remove('inventory', created.data.id);
        } else if (pendingPictureFile) {
          await api.pictures.upload('inventory', created.data.id, pendingPictureFile);
        }
        if (pendingAttachment) {
          await api.attachments.upload('inventory', created.data.id, pendingAttachment, {
            attachment_type: pendingAttachmentMeta.attachment_type,
            description: pendingAttachmentMeta.description,
          });
        }
      }
      toast.success('Inventory item created');
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
    if (!formData.name.trim() || formData.quantity <= 0 || !formData.location.trim()) {
      toast.error('Please fill in required fields: Name, Quantity (>0), and Location');
      return;
    }

    try {
      const payload = buildInventoryPayload();

      await api.inventory.update(editingId, payload);
      if (removePicture) {
        await api.pictures.remove('inventory', editingId);
      } else if (pendingPictureFile) {
        await api.pictures.upload('inventory', editingId, pendingPictureFile);
      }
      if (pendingAttachment) {
        await api.attachments.upload('inventory', editingId, pendingAttachment, {
          attachment_type: pendingAttachmentMeta.attachment_type,
          description: pendingAttachmentMeta.description,
        });
      }
      toast.success('Inventory item updated');
      pagination.invalidate();

      resetForm();
      setEditingId(null);
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

  function openEdit(item: InventoryItem) {
    setEditingId(item.id);
    setFormTab('general');
    setSelectedEntityType(item.inventory_type as EntityType);
    setPendingAttachment(null);
    setPendingPictureFile(null);
    setRemovePicture(false);
    setFormData({
      name: item.name || '',
      inventory_type: item.inventory_type,
      serial_number: item.serial_number || '',
      quantity: item.quantity,
      description: item.description || '',
      oem_name: item.oem_name || '',
      manufacturer_part_number: item.manufacturer_part_number || '',
      location: item.location || '',
      holder_user_id: item.holder_user_id ? String(item.holder_user_id) : '',
      added_date: item.added_date ? item.added_date.slice(0, 10) : '',
      shelf_life_expires_at: item.shelf_life_expires_at
        ? item.shelf_life_expires_at.slice(0, 10)
        : '',
      picture_url: item.picture_url || '',
    });
    setIsEditOpen(true);
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
        <TabsTrigger value="picture" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Picture
        </TabsTrigger>
        <TabsTrigger value="attachments" className="min-w-0 flex-1 px-2 text-xs sm:text-sm">
          Attachments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
        <div>
          <Label>Inventory Type {mode === 'create' ? '*' : ''}</Label>
          {mode === 'create' ? (
            <Select
              value={selectedEntityType}
              onValueChange={(value) => {
                setSelectedEntityType(value as EntityType);
                setFormData({ ...formData, inventory_type: value, name: '' });
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
        </div>

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
          <Label>Serial Number</Label>
          <Input
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            placeholder="e.g., SN-2024-001"
          />
        </div>

        <div>
          <Label>Manufacturer Part Number</Label>
          <Input
            value={formData.manufacturer_part_number}
            onChange={(e) =>
              setFormData({ ...formData, manufacturer_part_number: e.target.value })
            }
            placeholder="e.g., MPN-12345"
          />
        </div>

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
        <div>
          <Label>Attachment Type</Label>
          <Select
            value={pendingAttachmentMeta.attachment_type}
            onValueChange={(value) =>
              setPendingAttachmentMeta((prev) => ({
                ...prev,
                attachment_type: value as AttachmentType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select attachment type" />
            </SelectTrigger>
            <SelectContent>
              {ATTACHMENT_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Attachment Name / Description</Label>
          <Input
            value={pendingAttachmentMeta.description ?? ''}
            onChange={(e) =>
              setPendingAttachmentMeta((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="e.g. Test Report for VSWR"
          />
        </div>

        <div>
          <Label>Attachment File</Label>
          <Input
            type="file"
            onChange={(e) => setPendingAttachment(e.target.files?.[0] ?? null)}
          />
        </div>
      </TabsContent>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="capitalize font-medium">{item.inventory_type}</TableCell>
                      <TableCell>{item.entityName || 'N/A'}</TableCell>
                      <TableCell>{item.serialNumber || '—'}</TableCell>
                      <TableCell>{item.partNumber || '—'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
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
