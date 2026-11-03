'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Loader2, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import {
  AnimatedPillTabsList,
  animatedPillTabsTriggerClassName,
} from '@/components/ui/animated-pill-tabs';
import { EntityPicture } from '@/components/entity-picture';
import { InventoryHierarchyDialog } from '@/components/inventory-hierarchy-dialog';
import { StatusBadge } from '@/components/status-badge';
import {
  FaultyEntityStatusBadge,
  ResolutionTypeBadge,
} from '@/components/maintenance/badges';
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
  MaintenanceAction,
  ProductFaultHistory,
  ProductFaultHistoryItem,
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

function DetailCard({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-background/60 p-3', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium wrap-break-word">{value?.trim() || '—'}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
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
      const candidates = [instance.serial_number, instance.original_serial_number]
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

function oemMatchLabel(item: ProductFaultHistoryItem, currentOem?: string | null) {
  if (item.same_oem === true) return 'Same OEM';
  if (item.same_oem === false) return 'Different OEM';
  if (!currentOem?.trim()) return item.oem_name?.trim() || 'OEM unknown';
  return item.oem_name?.trim() ? 'OEM unknown match' : 'OEM unknown';
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
  const [faultHistory, setFaultHistory] = useState<ProductFaultHistory | null>(null);
  const [faultHistoryLoading, setFaultHistoryLoading] = useState(false);
  const [faultHistoryError, setFaultHistoryError] = useState<string | null>(null);
  const [selectedFault, setSelectedFault] = useState<ProductFaultHistoryItem | null>(null);
  const [faultActions, setFaultActions] = useState<MaintenanceAction[]>([]);
  const [faultActionsLoading, setFaultActionsLoading] = useState(false);

  const ownerType = selection ? normalizeEntityType(selection.entityType) : '';
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
      setFaultHistory(null);
      setSelectedFault(null);
      setFaultActions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('identification');
    setSelectedFault(null);
    setFaultActions([]);
    setFaultHistory(null);

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
              const itemSerials = [item.serial_number, item.original_serial_number]
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

  const oemName =
    entity?.oem_name?.trim() || inventory?.oem_name?.trim() || undefined;

  const partNumber =
    entity?.part_number?.trim() ||
    selection?.partNumber?.trim() ||
    (inventory ? inventoryPartNumber(inventory) : undefined) ||
    undefined;

  useEffect(() => {
    if (!open || !partNumber?.trim()) {
      setFaultHistory(null);
      setFaultHistoryError(null);
      setFaultHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setFaultHistoryLoading(true);
    setFaultHistoryError(null);

    void api.faultyEntities
      .getProductFaultHistory(partNumber, oemName)
      .then((res) => {
        if (cancelled) return;
        setFaultHistory(res.data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setFaultHistory(null);
        setFaultHistoryError('Failed to load product fault history.');
      })
      .finally(() => {
        if (!cancelled) setFaultHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, partNumber, oemName]);

  useEffect(() => {
    if (!selectedFault) {
      setFaultActions([]);
      setFaultActionsLoading(false);
      return;
    }

    let cancelled = false;
    setFaultActionsLoading(true);
    void api.maintenanceActions
      .listByFaultyEntityId(selectedFault.id)
      .then((res) => {
        if (!cancelled) setFaultActions(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setFaultActions([]);
      })
      .finally(() => {
        if (!cancelled) setFaultActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFault]);

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
    entity?.name?.trim() || selection?.label?.trim() || 'Entity stocking detail';

  const isCurrentUnitFault = (item: ProductFaultHistoryItem) =>
    selection != null &&
    hardwareOwnerType != null &&
    normalizeEntityType(item.entity_type) === hardwareOwnerType &&
    item.entity_id === selection.entityId;

  // Most recent prior fault for this product — exclude the unit currently being viewed.
  const mostRecentPriorFault =
    faultHistory?.history?.find((item) => !isCurrentUnitFault(item)) ?? null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            <SheetDescription>
              Stocking, installation, attachments, BoM, and product fault history.
            </SheetDescription>
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
                {partNumber ? (
                  <Badge variant="outline" className="text-[10px]">
                    PN {partNumber}
                  </Badge>
                ) : null}
                {oemName ? (
                  <Badge variant="outline" className="text-[10px]">
                    OEM {oemName}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading stocking details…
              </div>
            ) : error ? (
              <p className="p-6 text-center text-sm text-destructive">{error}</p>
            ) : !entity ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No entity selected.
              </p>
            ) : (
              <Tabs
                value={tab}
                onValueChange={(next) => {
                  setTab(next);
                  if (next !== 'fault-history') setSelectedFault(null);
                }}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="border-b px-4 py-3">
                  <AnimatedPillTabsList value={tab} className="gap-0.5">
                    <TabsTrigger
                      value="identification"
                      className={animatedPillTabsTriggerClassName}
                    >
                      ID
                    </TabsTrigger>
                    <TabsTrigger
                      value="installation"
                      className={animatedPillTabsTriggerClassName}
                    >
                      Install
                    </TabsTrigger>
                    <TabsTrigger
                      value="attachments"
                      className={animatedPillTabsTriggerClassName}
                    >
                      Files
                    </TabsTrigger>
                    <TabsTrigger value="bom" className={animatedPillTabsTriggerClassName}>
                      BoM
                    </TabsTrigger>
                    <TabsTrigger
                      value="fault-history"
                      className={animatedPillTabsTriggerClassName}
                    >
                      Faults
                    </TabsTrigger>
                  </AnimatedPillTabsList>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-4 p-4 pb-8">
                    <TabsContent value="identification" className="mt-0 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailCard label="Description" value={entity.description} />
                        <DetailCard label="OEM Name" value={oemName} />
                        <DetailCard label="SKU" value={inventory?.sku || entity.sku} />
                        <DetailCard label="Serial Number" value={serialNumber} />
                        <DetailCard label="Supplier Part Number" value={oemPartNumber} />
                        <DetailCard label="Supplier Serial Number" value={oemSerialNumber} />
                        <DetailCard
                          label="Configuration Item"
                          value={
                            entity.configuration_item ||
                            instance?.configuration_item ||
                            inventory?.configuration_item
                          }
                        />
                        <DetailCard
                          label="Warranty Status"
                          value={warrantyStatusLabel(warrantyExpiresAt)}
                        />
                        <DetailCard
                          label="Shelf Life Expires"
                          value={formatDate(shelfLifeExpiresAt)}
                        />
                        <DetailCard
                          label="Added Date"
                          value={formatDate(
                            instance?.added_date || inventory?.added_date
                          )}
                        />
                      </div>

                      {hardwareOwnerType ? (
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                            className="max-h-44 w-full rounded-md object-contain"
                          />
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="installation" className="mt-0">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailCard
                          label="Installation Date"
                          value={formatDate(installationDate)}
                        />
                        <DetailCard label="Installer" value={installerLabel} />
                        <DetailCard label="Installer Part Number" value={partNumber} />
                        <DetailCard
                          label="Installer Serial Number"
                          value={serialNumber}
                        />
                        <DetailCard
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
                                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                              >
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
                                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                              >
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
                                  className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
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

                    <TabsContent value="fault-history" className="mt-0 space-y-4">
                      {!partNumber ? (
                        <p className="text-sm text-muted-foreground">
                          No part number available, so product fault history cannot be
                          loaded.
                        </p>
                      ) : faultHistoryLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading fault history…
                        </div>
                      ) : faultHistoryError ? (
                        <p className="text-sm text-destructive">{faultHistoryError}</p>
                      ) : selectedFault ? (
                        <div className="space-y-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 px-0"
                            onClick={() => setSelectedFault(null)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Back to fault list
                          </Button>

                          <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Case #{selectedFault.case_id}
                                </p>
                                <h3 className="text-base font-semibold">
                                  {selectedFault.entity_name ||
                                    selectedFault.serial_number ||
                                    `Fault #${selectedFault.id}`}
                                </h3>
                              </div>
                              <FaultyEntityStatusBadge entity={selectedFault} />
                            </div>
                            <div className="mt-3">
                              <ResolutionTypeBadge
                                resolutionType={selectedFault.resolution_type}
                              />
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <DetailCard
                                label="Fault Type"
                                value={selectedFault.fault_type}
                              />
                              <DetailCard
                                label="OEM"
                                value={
                                  selectedFault.oem_name ||
                                  oemMatchLabel(selectedFault, oemName)
                                }
                              />
                              <DetailCard
                                label="Part Number"
                                value={selectedFault.part_number}
                              />
                              <DetailCard
                                label="Serial Number"
                                value={selectedFault.serial_number}
                              />
                              <DetailCard
                                label="Identified At"
                                value={formatDateTime(selectedFault.identified_at)}
                              />
                              <DetailCard
                                label="Resolved At"
                                value={formatDateTime(selectedFault.resolved_at)}
                              />
                              <DetailCard
                                label="Description"
                                value={selectedFault.fault_description}
                                className="sm:col-span-2"
                              />
                              <DetailCard
                                label="Investigation Notes"
                                value={selectedFault.investigation_notes}
                                className="sm:col-span-2"
                              />
                            </div>
                          </div>

                          <section className="space-y-2">
                            <h3 className="text-sm font-semibold">Actions</h3>
                            {faultActionsLoading ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading actions…
                              </div>
                            ) : faultActions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No maintenance actions recorded for this fault.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {faultActions.map((action) => (
                                  <li
                                    key={action.id}
                                    className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                                  >
                                    <p className="font-medium capitalize">
                                      {action.action_type?.replaceAll('_', ' ') ||
                                        `Action #${action.id}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {action.outcome
                                        ? `${action.outcome.replaceAll('_', ' ')} · `
                                        : ''}
                                      {formatDateTime(action.performed_at) || '—'}
                                    </p>
                                    {action.notes ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {action.notes}
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <StatCard
                              label="Same-OEM Fault Count"
                              value={faultHistory?.same_oem_fault_count ?? 0}
                              hint={
                                oemName
                                  ? `Product ${partNumber} · OEM ${oemName}`
                                  : `Product ${partNumber}`
                              }
                            />
                            <StatCard
                              label="Other-OEM Fault Count"
                              value={faultHistory?.different_oem_fault_count ?? 0}
                              hint={
                                oemName
                                  ? 'Same part number, other OEMs'
                                  : 'Set OEM on this entity to compare'
                              }
                            />
                            <StatCard
                              label="Total Fault Occurrences"
                              value={faultHistory?.total_fault_count ?? 0}
                            />
                            <StatCard
                              label="Most Recent Fault"
                              value={
                                formatDateTime(mostRecentPriorFault?.identified_at) ||
                                'None'
                              }
                              hint={
                                mostRecentPriorFault
                                  ? mostRecentPriorFault.entity_name ||
                                    mostRecentPriorFault.serial_number ||
                                    `Fault #${mostRecentPriorFault.id}`
                                  : 'No prior faults for other units'
                              }
                            />
                          </div>

                          {(faultHistory?.unknown_oem_fault_count ?? 0) > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {faultHistory?.unknown_oem_fault_count} fault
                              {(faultHistory?.unknown_oem_fault_count ?? 0) === 1
                                ? ''
                                : 's'}{' '}
                              could not be classified by OEM.
                            </p>
                          ) : null}

                          <section className="space-y-2">
                            <h3 className="text-sm font-semibold">Fault history</h3>
                            {!faultHistory?.history?.length ? (
                              <p className="text-sm text-muted-foreground">
                                No prior faults found for this part number.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {faultHistory.history.map((item) => {
                                  const isThisUnit = isCurrentUnitFault(item);
                                  return (
                                    <li key={item.id}>
                                      <button
                                        type="button"
                                        className="w-full rounded-lg border border-border bg-background/60 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                                        onClick={() => setSelectedFault(item)}
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">
                                              {item.entity_name ||
                                                item.serial_number ||
                                                `Fault #${item.id}`}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                              Case #{item.case_id}
                                              {item.serial_number
                                                ? ` · SN ${item.serial_number}`
                                                : ''}
                                              {' · '}
                                              {formatDateTime(item.identified_at) ||
                                                'Unknown date'}
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {isThisUnit ? (
                                              <Badge
                                                variant="secondary"
                                                className="text-[10px]"
                                              >
                                                This unit
                                              </Badge>
                                            ) : null}
                                            <Badge
                                              variant="outline"
                                              className="text-[10px]"
                                            >
                                              {oemMatchLabel(item, oemName)}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <FaultyEntityStatusBadge
                                            entity={item}
                                            showPotentiallyAffected={false}
                                          />
                                          {item.fault_type ? (
                                            <span className="text-xs capitalize text-muted-foreground">
                                              {item.fault_type.replaceAll('_', ' ')}
                                            </span>
                                          ) : null}
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <InventoryHierarchyDialog
        item={inventory}
        instanceId={instance?.id ?? null}
        open={bomOpen}
        onOpenChange={setBomOpen}
      />
    </>
  );
}
