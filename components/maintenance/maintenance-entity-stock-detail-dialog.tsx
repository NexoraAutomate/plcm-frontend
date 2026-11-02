'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Network } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityPicture } from '@/components/entity-picture';
import { InventoryHierarchyDialog } from '@/components/inventory-hierarchy-dialog';
import { StatusBadge } from '@/components/status-badge';
import {
  attachmentDisplayTitle,
  attachmentTypeLabel,
} from '@/lib/attachment-types';
import * as api from '@/lib/api';
import { normalizeEntityType } from '@/lib/entity-lookup-flow';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { formatUserRef } from '@/lib/user-display';
import { useDataStoreDomain } from '@/lib/data-store';
import { cn } from '@/lib/utils';
import type {
  EntityAttachment,
  HierarchyInstallFields,
  Inventory,
  InventoryChildLink,
  InventoryInstance,
} from '@/lib/models';

type HardwareOwnerType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

type HierarchyEntityDetail = HierarchyInstallFields & {
  id: number;
  name: string;
  description?: string | null;
  part_number?: string;
  serial_number?: string;
  configuration_item?: string;
  oem_name?: string | null;
  sku?: string;
  status_id?: number | null;
};

export interface MaintenanceEntityStockSelection {
  entityType: string;
  entityId: number;
  label?: string;
  partNumber?: string;
  serialNumber?: string;
}

interface MaintenanceEntityStockDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: MaintenanceEntityStockSelection | null;
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium wrap-break-word">{value?.trim() || '—'}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isHardwareOwnerType(value: string): value is HardwareOwnerType {
  return ['system', 'subsystem', 'module', 'unit', 'component'].includes(value);
}

async function fetchHierarchyEntity(
  entityType: string,
  entityId: number
): Promise<HierarchyEntityDetail | null> {
  const type = normalizeEntityType(entityType);
  if (!isHardwareOwnerType(type)) return null;

  switch (type) {
    case 'system':
      return (await api.systems.get(entityId)).data;
    case 'subsystem':
      return (await api.subsystems.get(entityId)).data;
    case 'module':
      return (await api.modules.get(entityId)).data;
    case 'unit':
      return (await api.units.get(entityId)).data;
    case 'component':
      return (await api.components.get(entityId)).data;
  }
}

function findMatchingInstance(
  item: Inventory,
  serialNumber?: string | null
): InventoryInstance | undefined {
  const instances = item.instances ?? [];
  if (!instances.length) return undefined;

  const normalized = serialNumber?.trim().toLowerCase();
  if (!normalized) return instances[0];

  return (
    instances.find((instance) => {
      const candidates = [
        instance.serial_number,
        instance.original_serial_number,
      ]
        .filter(Boolean)
        .map((value) => value!.trim().toLowerCase());
      return candidates.includes(normalized);
    }) ?? instances[0]
  );
}

function warrantyStatusLabel(expiresAt?: string | null) {
  if (!expiresAt?.trim()) return 'Not provided';
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return formatDate(expiresAt) ?? 'Provided';
  const expired = expires.getTime() < Date.now();
  return expired
    ? `Expired (${formatDate(expiresAt)})`
    : `Active until ${formatDate(expiresAt)}`;
}

function mergeAttachments(
  entityAttachments: EntityAttachment[],
  inventoryAttachments: EntityAttachment[]
) {
  const byId = new Map<number, EntityAttachment>();
  for (const attachment of [...entityAttachments, ...inventoryAttachments]) {
    byId.set(attachment.id, attachment);
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.uploaded_at || '').localeCompare(a.uploaded_at || '')
  );
}

export function MaintenanceEntityStockDetailDialog({
  open,
  onOpenChange,
  selection,
}: MaintenanceEntityStockDetailDialogProps) {
  const { users } = useDataStoreDomain();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<HierarchyEntityDetail | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [instance, setInstance] = useState<InventoryInstance | null>(null);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [bomLinks, setBomLinks] = useState<InventoryChildLink[]>([]);
  const [bomOpen, setBomOpen] = useState(false);
  const [tab, setTab] = useState('identification');

  const ownerType = selection
    ? normalizeEntityType(selection.entityType)
    : '';
  const hardwareOwnerType = isHardwareOwnerType(ownerType) ? ownerType : null;

  useEffect(() => {
    if (!open || !selection || !hardwareOwnerType) {
      setLoading(false);
      setError(null);
      setEntity(null);
      setInventory(null);
      setInstance(null);
      setAttachments([]);
      setBomLinks([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('identification');

    void (async () => {
      try {
        const hierarchy = await fetchHierarchyEntity(
          hardwareOwnerType,
          selection.entityId
        );
        if (cancelled) return;
        if (!hierarchy) {
          setError('This entity type does not support stocking detail.');
          setEntity(null);
          setInventory(null);
          setInstance(null);
          setAttachments([]);
          setBomLinks([]);
          return;
        }

        setEntity(hierarchy);

        const serialHint =
          selection.serialNumber?.trim() || hierarchy.serial_number?.trim() || '';

        let matchedInventory: Inventory | null = null;
        let matchedInstance: InventoryInstance | null = null;

        try {
          const byEntity = await api.inventory.listByEntity(selection.entityId);
          const candidates = byEntity.data ?? [];
          matchedInventory =
            candidates.find((item) => {
              if (!serialHint) return true;
              const instanceMatch = findMatchingInstance(item, serialHint);
              if (instanceMatch) return true;
              const itemSerials = [
                item.serial_number,
                item.original_serial_number,
              ]
                .filter(Boolean)
                .map((value) => value!.trim().toLowerCase());
              return itemSerials.includes(serialHint.toLowerCase());
            }) ??
            candidates[0] ??
            null;

          if (matchedInventory) {
            const fresh = await api.inventory.get(matchedInventory.id);
            matchedInventory = fresh.data ?? matchedInventory;
            matchedInstance =
              findMatchingInstance(matchedInventory, serialHint) ?? null;
          }
        } catch {
          matchedInventory = null;
          matchedInstance = null;
        }

        if (cancelled) return;
        setInventory(matchedInventory);
        setInstance(matchedInstance);

        const [entityAttachmentsRes, inventoryAttachmentsRes, childrenRes] =
          await Promise.allSettled([
            api.attachments.list(hardwareOwnerType, selection.entityId),
            matchedInventory
              ? api.attachments.list('inventory', matchedInventory.id)
              : Promise.resolve({ data: [] as EntityAttachment[] }),
            matchedInventory
              ? api.inventory.getChildren(matchedInventory.id, {
                  parentInstanceId: matchedInstance?.id,
                  parentInstanceSerial:
                    matchedInstance?.serial_number || serialHint || undefined,
                })
              : Promise.resolve({ data: [] as InventoryChildLink[] }),
          ]);

        if (cancelled) return;

        const entityAttachments =
          entityAttachmentsRes.status === 'fulfilled'
            ? entityAttachmentsRes.value.data ?? []
            : [];
        const inventoryAttachments =
          inventoryAttachmentsRes.status === 'fulfilled'
            ? inventoryAttachmentsRes.value.data ?? []
            : [];
        setAttachments(mergeAttachments(entityAttachments, inventoryAttachments));
        setBomLinks(
          childrenRes.status === 'fulfilled' ? childrenRes.value.data ?? [] : []
        );
      } catch {
        if (!cancelled) {
          setError('Failed to load entity stocking details.');
          setEntity(null);
          setInventory(null);
          setInstance(null);
          setAttachments([]);
          setBomLinks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, selection, hardwareOwnerType]);

  const installerLabel = useMemo(() => {
    const installerId =
      entity?.installed_by_id ??
      instance?.installed_by_id ??
      inventory?.installed_by_id;
    if (!installerId) return undefined;
    const user = users.find((item) => item.id === installerId);
    return user ? formatUserRef(user) : `User #${installerId}`;
  }, [
    entity?.installed_by_id,
    instance?.installed_by_id,
    inventory?.installed_by_id,
    users,
  ]);

  const oemName =
    entity?.oem_name?.trim() ||
    inventory?.oem_name?.trim() ||
    undefined;

  const partNumber =
    entity?.part_number?.trim() ||
    selection?.partNumber?.trim() ||
    (inventory ? inventoryPartNumber(inventory) : undefined) ||
    undefined;

  const serialNumber =
    entity?.serial_number?.trim() ||
    selection?.serialNumber?.trim() ||
    instance?.serial_number?.trim() ||
    inventory?.serial_number?.trim() ||
    undefined;

  const oemPartNumber =
    entity?.original_part_number?.trim() ||
    instance?.original_part_number?.trim() ||
    inventory?.original_part_number?.trim() ||
    undefined;

  const oemSerialNumber =
    entity?.original_serial_number?.trim() ||
    instance?.original_serial_number?.trim() ||
    inventory?.original_serial_number?.trim() ||
    undefined;

  const installationDate =
    entity?.installation_date ||
    instance?.installation_date ||
    inventory?.installation_date;

  const warrantyExpiresAt =
    instance?.warranty_expires_at || inventory?.warranty_expires_at;

  const shelfLifeExpiresAt =
    instance?.shelf_life_expires_at || inventory?.shelf_life_expires_at;

  const testReports = attachments.filter(
    (attachment) => attachment.attachment_type === 'test_report'
  );
  const otherAttachments = attachments.filter(
    (attachment) => attachment.attachment_type !== 'test_report'
  );

  const title =
    entity?.name?.trim() ||
    selection?.label?.trim() ||
    'Entity stocking detail';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="pr-8">{title}</DialogTitle>
            <DialogDescription>
              Complete stocking and installation detail for the selected entity.
            </DialogDescription>
            {hardwareOwnerType ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {hardwareOwnerType}
                </Badge>
                {selection?.entityId != null ? (
                  <Badge variant="outline" className="text-[10px]">
                    ID {selection.entityId}
                  </Badge>
                ) : null}
                {inventory ? (
                  <Badge variant="outline" className="text-[10px]">
                    Inventory #{inventory.id}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stocking details…
              </div>
            ) : error ? (
              <p className="py-10 text-center text-sm text-destructive">{error}</p>
            ) : !entity ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No entity selected.
              </p>
            ) : (
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="identification">Identification</TabsTrigger>
                  <TabsTrigger value="installation">Installation</TabsTrigger>
                  <TabsTrigger value="attachments">
                    Attachments
                    {attachments.length ? ` (${attachments.length})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="bom">
                    BoM
                    {bomLinks.length ? ` (${bomLinks.length})` : ''}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="identification" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailField label="Name" value={entity.name} />
                    <DetailField label="Description" value={entity.description} />
                    <DetailField label="OEM Name" value={oemName} />
                    <DetailField
                      label="SKU"
                      value={inventory?.sku || entity.sku}
                    />
                    <DetailField label="Part Number" value={partNumber} />
                    <DetailField label="Serial Number" value={serialNumber} />
                    <DetailField label="OEM Part Number" value={oemPartNumber} />
                    <DetailField label="OEM Serial Number" value={oemSerialNumber} />
                    <DetailField
                      label="Configuration Item"
                      value={
                        entity.configuration_item ||
                        instance?.configuration_item ||
                        inventory?.configuration_item
                      }
                    />
                    <DetailField
                      label="Warranty Status"
                      value={warrantyStatusLabel(warrantyExpiresAt)}
                    />
                    <DetailField
                      label="Shelf Life Expires"
                      value={formatDate(shelfLifeExpiresAt)}
                    />
                    <DetailField
                      label="Added Date"
                      value={formatDate(
                        instance?.added_date || inventory?.added_date
                      )}
                    />
                  </div>

                  {hardwareOwnerType ? (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Picture
                      </p>
                      <EntityPicture
                        src={
                          entity.picture_url ||
                          instance?.picture_url ||
                          inventory?.picture_url
                        }
                        ownerType={hardwareOwnerType}
                        ownerId={entity.id}
                        alt={entity.name}
                        className="max-h-48 w-full rounded-md object-contain"
                      />
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="installation" className="mt-0 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailField
                      label="Installation Date"
                      value={formatDate(installationDate)}
                    />
                    <DetailField label="Installer" value={installerLabel} />
                    <DetailField
                      label="Installed Part Number"
                      value={partNumber}
                    />
                    <DetailField label="Installed OEM" value={oemName} />
                    <DetailField
                      label="Installed Serial Number"
                      value={serialNumber}
                    />
                    <DetailField
                      label="Replaced At"
                      value={formatDateTime(entity.replaced_at)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="attachments" className="mt-0 space-y-5">
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Test Reports</h3>
                    {testReports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No test reports attached.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {testReports.map((attachment) => (
                          <li
                            key={attachment.id}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="truncate text-left font-medium text-primary hover:underline"
                                onClick={() =>
                                  void api.attachments.download(
                                    attachment.id,
                                    attachment.file_name
                                  )
                                }
                              >
                                {attachmentDisplayTitle(attachment)}
                              </button>
                              <p className="truncate text-xs text-muted-foreground">
                                {attachment.file_name}
                                {attachment.uploaded_at
                                  ? ` · ${formatDateTime(attachment.uploaded_at)}`
                                  : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Other Attachments</h3>
                    {otherAttachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No other attachments for this inventory/entity.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {otherAttachments.map((attachment) => (
                          <li
                            key={attachment.id}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="truncate text-left font-medium text-primary hover:underline"
                                onClick={() =>
                                  void api.attachments.download(
                                    attachment.id,
                                    attachment.file_name
                                  )
                                }
                              >
                                {attachmentDisplayTitle(attachment)}
                              </button>
                              <p className="truncate text-xs text-muted-foreground">
                                {attachmentTypeLabel(attachment.attachment_type)} ·{' '}
                                {attachment.file_name}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </TabsContent>

                <TabsContent value="bom" className="mt-0 space-y-4">
                  {!inventory ? (
                    <p className="text-sm text-muted-foreground">
                      No linked inventory record was found for this entity, so BoM
                      cannot be loaded.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          Child links configured for this inventory item.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setBomOpen(true)}
                        >
                          <Network className="h-4 w-4" />
                          Open BoM map
                        </Button>
                      </div>

                      {bomLinks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No BoM children configured.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {bomLinks.map((link) => (
                            <li
                              key={link.id}
                              className="rounded-md border bg-background px-3 py-2 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                  {link.child_category_name ||
                                    `Inventory #${link.child_inventory_id}`}
                                </span>
                                {link.stock_consumed ? (
                                  <StatusBadge status="Consumed" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Child inventory #{link.child_inventory_id}
                                {link.child_instance_serial
                                  ? ` · SN ${link.child_instance_serial}`
                                  : link.child_instance_id
                                    ? ` · Instance #${link.child_instance_id}`
                                    : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InventoryHierarchyDialog
        item={inventory}
        instanceId={instance?.id ?? null}
        open={bomOpen}
        onOpenChange={setBomOpen}
      />
    </>
  );
}
