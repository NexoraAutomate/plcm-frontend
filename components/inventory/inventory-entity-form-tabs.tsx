'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityAttachmentsSection, type PendingAttachmentUpload } from '@/components/entity-attachments-section';
import { EntityPicture } from '@/components/entity-picture';
import {
  inventoryUsesInstances,
} from '@/lib/entity-hierarchy';
import type { InventoryEntityFormType } from '@/hooks/use-inventory-entity-form';
import type { emptyInventoryEntityForm } from '@/lib/inventory-entity-fields';
import { workflowStatusLabel } from '@/lib/workflow-status';
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import { FileDropZone } from '@/components/ui/file-drop-zone';
import { useAppDefinitions } from '@/lib/app-definitions-context';

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
  pendingPictureFiles?: File[];
  onPendingPictureFilesChange?: (files: File[]) => void;
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
  /** Hierarchy entity id — used to load the existing primary photo. */
  entityId?: number;
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
  pendingPictureFiles = [],
  onPendingPictureFilesChange,
  removePicture,
  onRemovePictureChange,
  onApplyDefinitionIdentifiers,
  statuses = [],
  users = [],
  editingInstanceId = null,
  context = 'inventory',
  lockEntityName = false,
  entityId,
}: InventoryEntityFormTabsProps) {
  const { definitions } = useAppDefinitions();
  const getEntityDisplayName = (entityType: InventoryEntityFormType) => entityLabel(entityType);
  const isHierarchy = context === 'hierarchy';
  /** Existing-project edit: no General tab; Description lives on Part Number. */
  const hideGeneralTab = isHierarchy;
  const pendingFile = pendingPictureFiles[0] ?? pendingPictureFile ?? null;
  const selectedPictures = pendingFile ? [pendingFile] : [];
  const pendingPreviewSrc = useMemo(() => {
    return pendingFile ? URL.createObjectURL(pendingFile) : null;
  }, [pendingFile]);

  useEffect(() => {
    return () => {
      if (pendingPreviewSrc) URL.revokeObjectURL(pendingPreviewSrc);
    };
  }, [pendingPreviewSrc]);

  const hasExistingPicture = Boolean(formData.picture_url?.trim()) && !removePicture;
  const showHierarchyPicture = Boolean(pendingPreviewSrc || hasExistingPicture);

  return (
    <Tabs value={formTab} onValueChange={onFormTabChange} className="w-full">
      <div className="border-b bg-muted/30 px-6 pt-2 pb-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-none bg-transparent p-0">
          {!hideGeneralTab ? (
            <TabsTrigger
              value="general"
              className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              General
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="part-number"
            className="rounded-md px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {hideGeneralTab ? 'Item Details' : 'OEM / SKU'}
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

      <div className={hideGeneralTab ? 'px-6 py-4' : 'px-6 py-6'}>
        {!hideGeneralTab ? (
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
            {mode === 'create' && !lockEntityName ? (
              <Select
                value={formData.name}
                onValueChange={(value) => {
                  if (onApplyDefinitionIdentifiers) {
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
            ) : (
              <Input value={formData.name || ''} disabled />
            )}
          </div>

          {!isHierarchy && mode === 'create' ? (
            <div>
              <Label>Quantity *</Label>
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
                Enter how many units to add to this inventory group. Set cost on the Cost tab.
              </p>
            </div>
          ) : !isHierarchy ? (
            <div>
              <Label>Quantity</Label>
              <Input value={String(formData.quantity || 0)} disabled />
              <p className="text-xs text-muted-foreground">
                Quantity cannot be changed here. Use Add Stock to increase it.
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
                      {workflowStatusLabel(status.status_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        ) : null}

        <TabsContent
          value="part-number"
          className={hideGeneralTab ? 'mt-0 space-y-3 p-0' : formTabClassName}
        >
          {hideGeneralTab ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="gap-3 py-3 shadow-none">
                  <CardHeader className="px-4 pb-0 pt-0">
                    <CardTitle className="text-sm font-semibold">Item Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 px-4 [&>div]:space-y-1.5">
                    <div>
                      <Label className="text-xs">OEM Name</Label>
                      <Input
                        className="h-8"
                        value={formData.oem_name}
                        onChange={(e) => {
                          onFormDataChange({ ...formData, oem_name: e.target.value });
                        }}
                        placeholder="e.g. AMP"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Part # / Serial # are generated from the name and OEM (not entered manually).
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-3 py-3 shadow-none">
                  <CardHeader className="px-4 pb-0 pt-0">
                    <CardTitle className="text-sm font-semibold">Installation Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 px-4 [&>div]:space-y-1.5">
                    <div>
                      <Label className="text-xs">Installation Date</Label>
                      <Input
                        className="h-8"
                        type="date"
                        value={formData.installation_date}
                        onChange={(e) =>
                          onFormDataChange({ ...formData, installation_date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Installed By</Label>
                      <Select
                        value={formData.installed_by_id || ''}
                        onValueChange={(value) =>
                          onFormDataChange({ ...formData, installed_by_id: value })
                        }
                      >
                        <SelectTrigger className="h-8">
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
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input
                  className="h-8"
                  value={formData.description}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional notes"
                />
              </div>
            </>
          ) : (
            <>
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

              <div className={mode === 'edit' ? undefined : 'sm:col-span-2'}>
                <Label>Vendor / OEM acronym</Label>
                <Input
                  value={formData.oem_name}
                  onChange={(e) => {
                    onFormDataChange({ ...formData, oem_name: e.target.value });
                  }}
                  placeholder="Short acronym for {vendor} token, e.g. AMP"
                />
                <p className="text-xs text-muted-foreground">
                  Part # / Serial # are generated automatically from the item name and this OEM
                  acronym. They are not entered manually.
                </p>
              </div>
            </>
          )}
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

          <div className="sm:col-span-2">
            <CascadingLocationSelects
              tree={definitions.inventory_location_tree}
              required={mode === 'create'}
              value={{
                location_room: formData.location_room,
                location_cabinet: formData.location_cabinet,
                location_rack: formData.location_rack,
              }}
              onChange={(next) =>
                onFormDataChange({
                  ...formData,
                  location_room: next.location_room,
                  location_cabinet: next.location_cabinet,
                  location_rack: next.location_rack,
                  location: next.location,
                })
              }
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

        <TabsContent
          value="picture"
          className={
            hideGeneralTab
              ? 'mt-0 flex min-h-[220px] flex-col items-center justify-center gap-4 p-1'
              : formTabClassName
          }
        >
          <div className="sm:col-span-2 w-full max-w-md space-y-3">
            {showHierarchyPicture ? (
              <div className="flex flex-col items-center gap-3">
                {pendingPreviewSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pendingPreviewSrc}
                    alt="Selected primary photo"
                    className="max-h-48 rounded-md border object-cover"
                  />
                ) : (
                  <EntityPicture
                    src={formData.picture_url}
                    ownerType={selectedEntityType}
                    ownerId={entityId}
                    alt={`${formData.name || 'Entity'} photo`}
                    className="max-h-48 rounded-md border object-cover"
                  />
                )}
              </div>
            ) : null}
            <FileDropZone
              accept="image/*"
              restLabel="photo files or drop"
              hint="(jpg, png, webp, etc)"
              selectedLabel={
                removePicture
                  ? null
                  : selectedPictures[0]?.name ||
                    (hasExistingPicture ? 'Current photo on file' : null)
              }
              onClear={() => {
                onPendingPictureFilesChange?.([]);
                onPendingPictureFileChange(null);
                onFormDataChange({ ...formData, picture_url: '' });
                onRemovePictureChange(true);
              }}
              onFiles={(files) => {
                onPendingPictureFilesChange?.(files);
                onPendingPictureFileChange(files[0] ?? null);
                onRemovePictureChange(false);
              }}
            />
          </div>
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

export const hierarchyEntityDialogClassName =
  'top-[6vh] max-h-[88vh] w-[min(100vw-1.5rem,52rem)] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-3xl';
