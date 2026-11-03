'use client';

import {
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FileDropZone } from '@/components/ui/file-drop-zone';
import {
  AnimatedPillTabsList,
  animatedPillTabsTriggerClassName,
} from '@/components/ui/animated-pill-tabs';
import {
  EntityAttachmentsSection,
  type PendingAttachmentUpload,
} from '@/components/entity-attachments-section';
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import {
  InventoryCostTab,
  type InventoryCostTabValue,
} from '@/components/inventory/inventory-cost-tab';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { inventoryUsesInstances, type HierarchyEntityType } from '@/lib/entity-hierarchy';
import type { emptyInventoryEntityForm } from '@/lib/inventory-entity-fields';

export type InventoryStockFormData = typeof emptyInventoryEntityForm;

/** Shared dialog chrome for Add Inventory / Edit Inventory / Add stock for shortage. */
export const inventoryStockDialogClassName =
  'top-[4vh] flex max-h-[92vh] w-[min(100vw-1.5rem,56rem)] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl';

const formTabClassName =
  'mt-0 grid grid-cols-1 gap-x-6 gap-y-5 p-1 sm:grid-cols-2 [&>div]:space-y-2 [&>p]:col-span-full';

const formTabSingleClassName = 'mt-0 space-y-5 p-1 [&>div]:space-y-2';

type ExistingUnitCostRows = ComponentProps<typeof InventoryCostTab>['existingUnits'];

export interface InventoryStockFormTabsProps {
  mode: 'create' | 'edit' | 'shortage';
  formTab: string;
  onFormTabChange: (tab: string) => void;
  selectedEntityType: HierarchyEntityType;
  onEntityTypeChange?: (type: HierarchyEntityType) => void;
  formData: InventoryStockFormData;
  onFormDataChange: Dispatch<SetStateAction<InventoryStockFormData>>;
  entityListNames: Array<{ id: number; name: string }>;
  entityLabel: (key: string, plural?: boolean) => string;
  inventoryHolderLabel: string;
  pendingAttachments: PendingAttachmentUpload[];
  onPendingAttachmentsChange: (attachments: PendingAttachmentUpload[]) => void;
  pendingPictureFile: File | null;
  onPendingPictureFileChange: (file: File | null) => void;
  removePicture: boolean;
  onRemovePictureChange: (remove: boolean) => void;
  costValue: InventoryCostTabValue;
  onCostChange: (next: InventoryCostTabValue) => void;
  /** Overrides the quantity shown on the cost tab (edit uses unit count). */
  costQuantity?: number;
  costExistingUnits?: ExistingUnitCostRows;
  onExistingUnitCostChange?: (id: number | string, cost: string) => void;
  onApplyDefinitionIdentifiers?: (
    type: HierarchyEntityType,
    name: string,
    vendor: string,
    prev: InventoryStockFormData
  ) => InventoryStockFormData;
  /** Restock and shortage: inventory type and category cannot change. */
  lockTypeAndCategory?: boolean;
  /** Shortage: quantity is shown but not editable. */
  lockQuantity?: boolean;
  /** Disable interactive controls that support it (e.g. while submitting). */
  disabled?: boolean;
  stickyHeader?: ReactNode;

  // Edit-only
  users?: Array<{ id: number; full_name?: string; username: string }>;
  editingId?: number | null;
  editingInstanceId?: number | null;
  editingSerialOnly?: boolean;
  showEditStockQuantity?: boolean;
  installationDateLabel?: string;
  installerLabel?: string;
  shelfLifeExpired?: boolean;
  /** When set (edit only), a Units tab is shown with this content. */
  unitsTab?: ReactNode;
}

export function InventoryStockFormTabs({
  mode,
  formTab,
  onFormTabChange,
  selectedEntityType,
  onEntityTypeChange,
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
  costValue,
  onCostChange,
  costQuantity,
  costExistingUnits,
  onExistingUnitCostChange,
  onApplyDefinitionIdentifiers,
  lockTypeAndCategory = false,
  lockQuantity = false,
  disabled = false,
  stickyHeader,
  users = [],
  editingId = null,
  editingInstanceId = null,
  editingSerialOnly = false,
  showEditStockQuantity = true,
  installationDateLabel = '—',
  installerLabel = '—',
  shelfLifeExpired = false,
  unitsTab,
}: InventoryStockFormTabsProps) {
  const { definitions } = useAppDefinitions();
  const isEdit = mode === 'edit';
  const isShortage = mode === 'shortage';
  const showUnitsTab = isEdit && unitsTab != null;

  return (
    <Tabs
      value={formTab}
      onValueChange={onFormTabChange}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        {stickyHeader}
        <div className="px-6 py-3">
          <AnimatedPillTabsList value={formTab}>
            <TabsTrigger value="general" className={animatedPillTabsTriggerClassName}>
              General
            </TabsTrigger>
            <TabsTrigger value="holder" className={animatedPillTabsTriggerClassName}>
              Location
            </TabsTrigger>
            <TabsTrigger value="cost" className={animatedPillTabsTriggerClassName}>
              Cost
            </TabsTrigger>
            <TabsTrigger value="attachments" className={animatedPillTabsTriggerClassName}>
              Attachments
            </TabsTrigger>
            {showUnitsTab ? (
              <TabsTrigger value="units" className={animatedPillTabsTriggerClassName}>
                Units
              </TabsTrigger>
            ) : null}
          </AnimatedPillTabsList>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <TabsContent value="general" className={formTabClassName}>
          {!isEdit ? (
            <>
              <div>
                <Label>Inventory Type *</Label>
                {isShortage ? (
                  <Input value={entityLabel(selectedEntityType)} disabled />
                ) : (
                  <Select
                    value={selectedEntityType}
                    disabled={lockTypeAndCategory}
                    onValueChange={(value) => {
                      const newType = value as HierarchyEntityType;
                      onEntityTypeChange?.(newType);
                      onFormDataChange({
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
                )}
              </div>

              <div>
                <Label>{entityLabel(selectedEntityType)} Category *</Label>
                {isShortage ? (
                  <Input value={formData.name} disabled />
                ) : (
                  <Select
                    value={formData.name}
                    disabled={lockTypeAndCategory}
                    onValueChange={(value) => {
                      onFormDataChange((prev) =>
                        onApplyDefinitionIdentifiers
                          ? onApplyDefinitionIdentifiers(
                              selectedEntityType,
                              value,
                              prev.oem_name,
                              prev
                            )
                          : { ...prev, name: value }
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
                )}
              </div>

              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity || ''}
                  disabled={lockQuantity}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    onFormDataChange({ ...formData, quantity: isNaN(val) ? 0 : val });
                  }}
                  placeholder="Enter quantity"
                />
                {lockQuantity ? (
                  <p className="text-xs text-muted-foreground">
                    Shortage receipts add one unit at a time.
                  </p>
                ) : null}
              </div>

              {isShortage ? (
                <>
                  <div>
                    <Label>PLCM Part Number</Label>
                    <Input value={formData.part_number} disabled />
                    <p className="text-xs text-muted-foreground">
                      Stays the same as the product part number.
                    </p>
                  </div>
                  <div>
                    <Label>PLCM Serial Number *</Label>
                    <Input
                      value={formData.serial_number}
                      disabled={disabled}
                      onChange={(e) =>
                        onFormDataChange({ ...formData, serial_number: e.target.value })
                      }
                      placeholder="Next serial (+1)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-suggested as next available (+1). Must be unique and different
                      from the part number.
                    </p>
                  </div>
                </>
              ) : null}
            </>
          ) : showEditStockQuantity ? (
            <div>
              <Label>Quantity in stock</Label>
              <Input value={String(formData.quantity || 0)} disabled />
              <p className="text-xs text-muted-foreground">
                Use + on the inventory list to restock (opens Add Item with this item).
              </p>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="Short description of this item"
            />
          </div>

          <div>
            <Label>Supplier acronym</Label>
            <Input
              value={formData.oem_name}
              onChange={(e) => onFormDataChange({ ...formData, oem_name: e.target.value })}
              placeholder="e.g. AMP"
            />
            <p className="text-xs text-muted-foreground">
              {isShortage
                ? 'Stored on the inventory group for reference.'
                : 'Used when generating part and serial numbers.'}
            </p>
          </div>

          {isEdit && selectedEntityType === 'component' ? (
            <div>
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => onFormDataChange({ ...formData, sku: e.target.value })}
                placeholder="Component SKU"
              />
            </div>
          ) : null}

          {isEdit && editingSerialOnly ? (
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

          {!isEdit || editingInstanceId != null ? (
            <>
              <div>
                <Label>Supplier Part Number</Label>
                <Input
                  value={formData.original_part_number}
                  disabled={disabled}
                  onChange={(e) =>
                    onFormDataChange({
                      ...formData,
                      original_part_number: e.target.value,
                    })
                  }
                  placeholder="Manufacturer / supplier part number (reference)"
                />
                <p className="text-xs text-muted-foreground">
                  {isShortage
                    ? 'Defaults to the product part number; you can edit it.'
                    : 'Stored for reference only. PLCM part numbers stay system-generated.'}
                </p>
              </div>
              <div>
                <Label>Supplier Serial Number</Label>
                <Input
                  value={formData.original_serial_number}
                  disabled={disabled}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, original_serial_number: e.target.value })
                  }
                  placeholder="Manufacturer / supplier serial (reference)"
                />
                <p className="text-xs text-muted-foreground">
                  {isShortage
                    ? 'Auto-suggested as next available (+1). Must be unique and different from the part number.'
                    : 'Best used when adding a single unit; multi-unit receipts keep PLCM serials.'}
                </p>
              </div>
            </>
          ) : null}

          <div>
            <div className="flex items-center gap-2">
              <Label>Shelf Life Expires</Label>
              {isEdit && editingSerialOnly && shelfLifeExpired ? (
                <Badge
                  variant="outline"
                  className="h-5 border-rose-300 bg-rose-100/80 px-1.5 text-[10px] font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
                >
                  Expired
                </Badge>
              ) : null}
            </div>
            <Input
              type="date"
              value={formData.shelf_life_expires_at}
              onChange={(e) =>
                onFormDataChange({ ...formData, shelf_life_expires_at: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Optional. Highlighted for warehouse stock only — issued and installed-verified
              units are excluded.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="inventory-warranty-toggle">Supplier warranty</Label>
                <p className="text-xs text-muted-foreground">
                  Turn on when the supplier provides a warranty period for this stock.
                </p>
              </div>
              <Switch
                id="inventory-warranty-toggle"
                checked={formData.warranty_provided}
                onCheckedChange={(checked) =>
                  onFormDataChange({
                    ...formData,
                    warranty_provided: checked,
                    warranty_expires_at: checked ? formData.warranty_expires_at : '',
                  })
                }
              />
            </div>
            {formData.warranty_provided ? (
              <div>
                <Label>Warranty expires *</Label>
                <Input
                  type="date"
                  value={formData.warranty_expires_at}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, warranty_expires_at: e.target.value })
                  }
                />
              </div>
            ) : null}
          </div>

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
                onFormDataChange({ ...formData, picture_url: '' });
                onPendingPictureFileChange(null);
                onRemovePictureChange(true);
              }}
              onFiles={(files) => {
                onPendingPictureFileChange(files[0] ?? null);
                onRemovePictureChange(false);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="holder" className={formTabClassName}>
          {inventoryUsesInstances(selectedEntityType) && isEdit && editingInstanceId ? (
            <p className="text-sm text-muted-foreground">
              Location and holder apply to the selected unit.
            </p>
          ) : null}
          {inventoryUsesInstances(selectedEntityType) && !isEdit ? (
            <p className="text-sm text-muted-foreground">
              Location and holder apply to each new unit being added.
            </p>
          ) : null}
          <div>
            <Label>Inventory Holder</Label>
            {!isEdit ? (
              <>
                <Input value={inventoryHolderLabel} disabled />
                <p className="text-xs text-muted-foreground">
                  Warehouse stock is held by the Inventory Manager who adds the item.
                </p>
              </>
            ) : (
              <Select
                value={formData.holder_user_id || ''}
                onValueChange={(value) =>
                  onFormDataChange({ ...formData, holder_user_id: value })
                }
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
            required={mode === 'create' || (isShortage && selectedEntityType !== 'component')}
            disabled={disabled}
            value={{
              location_room: formData.location_room,
              location_cabinet: formData.location_cabinet,
              location_rack: formData.location_rack,
            }}
            onChange={(next) => onFormDataChange({ ...formData, ...next })}
          />

          <div>
            <Label>Added Date</Label>
            <Input
              type="date"
              value={formData.added_date}
              onChange={(e) => onFormDataChange({ ...formData, added_date: e.target.value })}
            />
          </div>
        </TabsContent>

        <TabsContent value="cost" className={formTabSingleClassName}>
          <InventoryCostTab
            quantity={costQuantity ?? (formData.quantity || 1)}
            value={costValue}
            onChange={onCostChange}
            disabled={disabled}
            existingUnits={costExistingUnits}
            onExistingUnitCostChange={onExistingUnitCostChange}
          />
        </TabsContent>

        <TabsContent value="attachments" className={formTabSingleClassName}>
          <EntityAttachmentsSection
            ownerType={
              inventoryUsesInstances(selectedEntityType) && editingInstanceId
                ? 'inventory_instance'
                : 'inventory'
            }
            ownerId={
              isEdit
                ? inventoryUsesInstances(selectedEntityType)
                  ? editingInstanceId
                  : editingId
                : null
            }
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsChange={onPendingAttachmentsChange}
          />
        </TabsContent>

        {showUnitsTab ? (
          <TabsContent value="units" className={formTabSingleClassName}>
            {unitsTab}
          </TabsContent>
        ) : null}
      </div>
    </Tabs>
  );
}
