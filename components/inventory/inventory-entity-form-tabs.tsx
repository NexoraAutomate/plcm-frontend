'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityAttachmentsSection, type PendingAttachmentUpload } from '@/components/entity-attachments-section';
import {
  inventorySupportsQuantity,
  inventoryUsesInstances,
} from '@/lib/entity-hierarchy';
import type { InventoryEntityFormType } from '@/hooks/use-inventory-entity-form';
import type { emptyInventoryEntityForm } from '@/lib/inventory-entity-fields';

export type InventoryEntityFormData = typeof emptyInventoryEntityForm;

const formTabClassName =
  'mt-0 grid grid-cols-1 gap-x-6 gap-y-5 p-1 sm:grid-cols-2 [&>div]:space-y-2 [&>p]:col-span-full';

const formTabSingleClassName = 'mt-0 space-y-5 p-1 [&>div]:space-y-2';

export interface InventoryEntityFormTabsProps {
  mode: 'create' | 'edit';
  formTab: string;
  onFormTabChange: (tab: string) => void;
  selectedEntityType: InventoryEntityFormType;
  onEntityTypeChange?: (type: InventoryEntityFormType) => void;
  allowTypeChange?: boolean;
  formData: InventoryEntityFormData;
  onFormDataChange: (next: InventoryEntityFormData) => void;
  entityListNames: Array<{ id: number; name: string }>;
  entityLabel: (key: string, plural?: boolean) => string;
  inventoryHolderLabel: string;
  pendingAttachments: PendingAttachmentUpload[];
  onPendingAttachmentsChange: (attachments: PendingAttachmentUpload[]) => void;
  pendingPictureFile: File | null;
  onPendingPictureFileChange: (file: File | null) => void;
  removePicture: boolean;
  onRemovePictureChange: (remove: boolean) => void;
  onApplyDefinitionIdentifiers?: (
    type: InventoryEntityFormType,
    name: string,
    vendor: string,
    prev: InventoryEntityFormData
  ) => InventoryEntityFormData;
  statuses?: { id: number; status_name: string }[];
  users?: { id: number; full_name?: string; username: string }[];
  editingInstanceId?: number | null;
  /** inventory = full form; hierarchy = hide quantity and holder tab on project pages */
  context?: 'inventory' | 'hierarchy';
  lockEntityName?: boolean;
}

export function InventoryEntityFormTabs({
  mode,
  formTab,
  onFormTabChange,
  selectedEntityType,
  onEntityTypeChange,
  allowTypeChange = false,
  formData,
  onFormDataChange,
  entityListNames,
  entityLabel,
  inventoryHolderLabel,
  pendingAttachments,
  onPendingAttachmentsChange,
  pendingPictureFile,
  onPendingPictureFileChange,
  removePicture,
  onRemovePictureChange,
  onApplyDefinitionIdentifiers,
  statuses = [],
  users = [],
  editingInstanceId = null,
  context = 'inventory',
  lockEntityName = false,
}: InventoryEntityFormTabsProps) {
  const getEntityDisplayName = (entityType: InventoryEntityFormType) => entityLabel(entityType);
  const isHierarchy = context === 'hierarchy';

  return (
    <Tabs value={formTab} onValueChange={onFormTabChange} className="w-full">
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
          {!isHierarchy ? (
            <TabsTrigger
              value="holder"
              className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Holder
            </TabsTrigger>
          ) : null}
          {mode === 'edit' ? (
            <TabsTrigger
              value="install"
              className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Install
            </TabsTrigger>
          ) : null}
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
        </TabsList>
      </div>

      <div className="px-6 py-6">
        <TabsContent value="general" className={formTabClassName}>
          <div>
            <Label>Inventory Type {mode === 'create' ? '*' : ''}</Label>
            {mode === 'create' && allowTypeChange ? (
              <Select
                value={selectedEntityType}
                onValueChange={(value) => onEntityTypeChange?.(value as InventoryEntityFormType)}
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
            ) : (
              <Input value={getEntityDisplayName(selectedEntityType)} disabled />
            )}
          </div>

          <div>
            <Label>
              {getEntityDisplayName(selectedEntityType)} Category
              {mode === 'create' ? ' (Entity List)' : ''} {mode === 'create' ? '*' : ''}
            </Label>
          <Select
            value={formData.name}
            disabled={lockEntityName}
            onValueChange={(value) => {
                if (mode === 'create' && onApplyDefinitionIdentifiers) {
                  onFormDataChange(
                    onApplyDefinitionIdentifiers(
                      selectedEntityType,
                      value,
                      formData.oem_name,
                      formData
                    )
                  );
                } else {
                  onFormDataChange({ ...formData, name: value });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    mode === 'create'
                      ? `Select from Entity List (${entityLabel(selectedEntityType)})`
                      : `Select ${selectedEntityType} name`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {entityListNames.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    {mode === 'create'
                      ? `No ${entityLabel(selectedEntityType, true).toLowerCase()} in Entity List — add in Settings → Definitions`
                      : 'No matching names in Entity List'}
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

          {inventorySupportsQuantity(selectedEntityType) && !isHierarchy ? (
            <div>
              <Label>Quantity {mode === 'create' ? '*' : ''}</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  onFormDataChange({ ...formData, quantity: Number.isNaN(val) ? 0 : val });
                }}
                placeholder="Enter quantity"
              />
              <p className="text-xs text-muted-foreground">
                Component inventory can be stocked in bulk.
              </p>
            </div>
          ) : !isHierarchy ? (
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
          ) : null}

        {mode === 'edit' ? (
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status_id || ''}
                onValueChange={(value) => onFormDataChange({ ...formData, status_id: value })}
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
                onChange={(e) =>
                  onFormDataChange({ ...formData, configuration_item: e.target.value })
                }
                placeholder="Defaults to part number or name"
              />
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="Item description"
            />
          </div>
        </TabsContent>

        <TabsContent value="part-number" className={formTabClassName}>
          <div>
            <Label>
              Serial Number
              {inventoryUsesInstances(selectedEntityType) &&
              selectedEntityType !== 'component' &&
              mode === 'create'
                ? ' *'
                : ''}
            </Label>
            <Input
              value={formData.serial_number}
              onChange={(e) => onFormDataChange({ ...formData, serial_number: e.target.value })}
              placeholder="e.g., SN-2024-001"
            />
            {inventoryUsesInstances(selectedEntityType) ? (
              <p className="text-xs text-muted-foreground">
                Each unit gets its own identity. Leave blank to generate one automatically.
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
              onChange={(e) => onFormDataChange({ ...formData, part_number: e.target.value })}
              placeholder="e.g., MPN-12345"
            />
          </div>

          {mode === 'edit' && selectedEntityType === 'component' ? (
            <div>
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => onFormDataChange({ ...formData, sku: e.target.value })}
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
                    onFormDataChange({ ...formData, original_part_number: e.target.value })
                  }
                  placeholder="Original part number from manufacturer"
                />
              </div>

              <div>
                <Label>Original Serial Number</Label>
                <Input
                  value={formData.original_serial_number}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, original_serial_number: e.target.value })
                  }
                  placeholder="Original serial number"
                />
              </div>
            </>
          ) : null}

          <div className={mode === 'edit' ? undefined : 'sm:col-span-2'}>
            <Label>Vendor / OEM acronym</Label>
            <Input
              value={formData.oem_name}
              onChange={(e) => {
                const vendor = e.target.value;
                if (mode === 'create' && formData.name && onApplyDefinitionIdentifiers) {
                  onFormDataChange(
                    onApplyDefinitionIdentifiers(selectedEntityType, formData.name, vendor, {
                      ...formData,
                      oem_name: vendor,
                    })
                  );
                } else {
                  onFormDataChange({ ...formData, oem_name: vendor });
                }
              }}
              placeholder="Short acronym for {vendor} token, e.g. AMP"
            />
            <p className="text-xs text-muted-foreground">
              Fills the {'{vendor}'} placeholder in Definitions SN/PN templates when stocking.
            </p>
          </div>
      </TabsContent>

      {!isHierarchy ? (
      <TabsContent value="holder" className={formTabClassName}>
          {inventoryUsesInstances(selectedEntityType) && mode === 'create' ? (
            <p className="text-sm text-muted-foreground">
              Holder details apply to the serialized unit being added.
            </p>
          ) : null}
          {inventoryUsesInstances(selectedEntityType) && mode === 'edit' && editingInstanceId ? (
            <p className="text-sm text-muted-foreground">
              Holder details apply to the selected serialized unit.
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
                onValueChange={(value) => onFormDataChange({ ...formData, holder_user_id: value })}
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
            )}
          </div>

          <div>
            <Label>Location {mode === 'create' ? '*' : ''}</Label>
            <Input
              value={formData.location}
              onChange={(e) => onFormDataChange({ ...formData, location: e.target.value })}
              placeholder="Warehouse location"
            />
          </div>

          <div>
            <Label>Added Date</Label>
            <Input
              type="date"
              value={formData.added_date}
              onChange={(e) => onFormDataChange({ ...formData, added_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Shelf Life Expires</Label>
            <Input
              type="date"
              value={formData.shelf_life_expires_at}
              onChange={(e) =>
                onFormDataChange({ ...formData, shelf_life_expires_at: e.target.value })
              }
            />
          </div>
        </TabsContent>
      ) : null}

        {mode === 'edit' ? (
          <TabsContent value="install" className={formTabClassName}>
            <div>
              <Label>Installation Date</Label>
              <Input
                type="date"
                value={formData.installation_date}
                onChange={(e) =>
                  onFormDataChange({ ...formData, installation_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Installed By</Label>
              <Select
                value={formData.installed_by_id || ''}
                onValueChange={(value) =>
                  onFormDataChange({ ...formData, installed_by_id: value })
                }
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
        ) : null}

        <TabsContent value="picture" className={formTabClassName}>
          <div>
            <Label>Picture</Label>
            <Input
              value={formData.picture_url}
              onChange={(e) => {
                onFormDataChange({ ...formData, picture_url: e.target.value });
                onRemovePictureChange(false);
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
                onPendingPictureFileChange(e.target.files?.[0] ?? null);
                onRemovePictureChange(false);
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
                  onFormDataChange({ ...formData, picture_url: '' });
                  onPendingPictureFileChange(null);
                  onRemovePictureChange(true);
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
            ownerType="inventory"
            ownerId={null}
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsChange={onPendingAttachmentsChange}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export const inventoryEntityDialogClassName =
  'top-[4vh] max-h-[92vh] w-[min(100vw-1.5rem,56rem)] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-4xl';
