'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ImagePlus, Pencil, Upload, Trash2, Replace, Network } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttachmentUploadDialog } from '@/components/attachment-upload-dialog';
import { useDataStore } from '@/lib/data-store';
import { attachmentDisplayTitle, attachmentTypeLabel } from '@/lib/attachment-types';
import type { EntityAttachment, EntityReplacementChainItem, HierarchyInstallFields, ItemInstallRejection } from '@/lib/models';
import * as api from '@/lib/api';
import { formatUserRef } from '@/lib/user-display';
import { toast } from 'sonner';
import { EntityPicture } from '@/components/entity-picture';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import { HierarchyEntityInventoryDialog } from '@/components/hierarchy/hierarchy-entity-inventory-create-dialog';
import { HARDWARE_ENTITY_DETAIL_PATH } from '@/lib/entity-replacement';
import { useAuth } from '@/lib/auth-context';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { queryKeys } from '@/hooks/queries/query-keys';
import { RevertToInventoryButton } from '@/components/revert-to-inventory-button';
import { canManageInstall, isOwnInstall } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { isProjectReadOnly } from '@/lib/workflow-status';
import { useProjectInventoryFlags } from '@/hooks/use-project-inventory-flags';
import { inventoryFlagKey } from '@/lib/system-hierarchy-graph';
import { RejectInstallationDialog } from '@/components/inventory/reject-installation-dialog';
import { RejectionReasonsDialog } from '@/components/inventory/rejection-reasons-dialog';
import {
  entityLifecycleCardClass,
  resolveEntityLifecycleTone,
} from '@/lib/entity-lifecycle-style';
import { EntityInventoryHoldDetails } from '@/components/entity-inventory-hold-details';
import type { HierarchyAssignmentStatus } from '@/lib/models';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { syncReservedInventoryMediaToEntity } from '@/lib/inventory-install';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';

type HardwareOwnerType = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

const EDIT_PERMISSION_BY_OWNER_TYPE: Record<HardwareOwnerType, string> = {
  system: P.edit_systems,
  subsystem: P.edit_subsystems,
  module: P.edit_modules,
  unit: P.edit_units,
  component: P.edit_components,
};

function MetadataField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value?.trim() || '—'}</p>
    </div>
  );
}

interface EntityInstallMetadataCardProps {
  ownerType: HardwareOwnerType;
  entity: HierarchyInstallFields & {
    id: number;
    name: string;
    description?: string | null;
    part_number?: string;
    serial_number?: string;
    configuration_item?: string;
    oem_name?: string;
    sku?: string;
    status_id?: number | null;
    replacement_sequence?: number;
    is_current_install?: boolean;
  };
  onUpdate: (data: Partial<HierarchyInstallFields>) => Promise<void>;
  projectId?: number;
  /** Parent id for existing-project inventory edit dialog (project/system/subsystem/…). */
  parentId?: number;
  /** When true, Edit opens the same inventory dialog as entity cards. */
  isExistingProject?: boolean;
  allowReplace?: boolean;
  hierarchyHref?: string;
  onReverted?: () => void;
  onExistingSaved?: () => void | Promise<void>;
}

export function EntityInstallMetadataCard({
  ownerType,
  entity,
  onUpdate,
  projectId,
  parentId,
  isExistingProject = false,
  allowReplace = false,
  hierarchyHref,
  onReverted,
  onExistingSaved,
}: EntityInstallMetadataCardProps) {
  const { entityLabel } = useAppDefinitions();
  const { users, projects } = useDataStore();
  const { can, user, isInventoryManager } = useAuth();
  const queryClient = useQueryClient();
  const inventoryManager = isInventoryManager();
  const cancelled =
    projectId != null &&
    isProjectReadOnly(projects.find((p) => p.id === projectId)?.status_name);
  const ownsInstall = canManageInstall({
    isInventoryManager: inventoryManager,
    currentUserId: user?.id,
    installedById: entity.installed_by_id,
  });
  const mine = isOwnInstall({
    currentUserId: user?.id,
    installedById: entity.installed_by_id,
  });
  const canMutateInstall =
    can(EDIT_PERMISSION_BY_OWNER_TYPE[ownerType]) && ownsInstall && !cancelled;
  const canEdit =
    isExistingProject && parentId != null && canMutateInstall;
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [linkedOemName, setLinkedOemName] = useState<string | undefined>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<EntityAttachment | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionView, setRejectionView] = useState<{
    label: string;
    history: ItemInstallRejection[];
  } | null>(null);
  const [pictureUploading, setPictureUploading] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const [replacementChain, setReplacementChain] = useState<EntityReplacementChainItem[]>([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState('hardware');
  const [editPreparing, setEditPreparing] = useState(false);
  const [syncedPictureUrl, setSyncedPictureUrl] = useState<string | null>(null);
  const reservedMediaSyncKeyRef = useRef<string | null>(null);
  const reservedMediaSyncPromiseRef = useRef<Promise<void> | null>(null);

  const inventoryFlags = useProjectInventoryFlags(projectId);
  const flagKey = inventoryFlagKey(ownerType, entity.id);
  const reservation = inventoryFlags.reservationsByKey[flagKey];
  const shortage = inventoryFlags.shortagesByKey[flagKey];
  const [assignment, setAssignment] = useState<HierarchyAssignmentStatus | null>(null);

  useEffect(() => {
    if (!reservation && detailsTab === 'reservation') {
      setDetailsTab('hardware');
    }
  }, [reservation, detailsTab]);

  const currentPartNumber = useMemo(() => {
    const candidates = [entity.part_number, reservation?.part_number];
    for (const candidate of candidates) {
      const trimmed = candidate?.trim();
      if (trimmed) return trimmed;
    }
    return undefined;
  }, [entity.part_number, reservation?.part_number]);

  const currentSerialNumber = useMemo(() => {
    const candidates = [entity.serial_number, reservation?.serial_number];
    for (const candidate of candidates) {
      const trimmed = candidate?.trim();
      if (trimmed) return trimmed;
    }
    return undefined;
  }, [entity.serial_number, reservation?.serial_number]);

  const gen0Install = useMemo(() => {
    if (!replacementChain.length) return undefined;
    return (
      replacementChain.find((row) => (row.replacement_sequence ?? 0) === 0) ??
      replacementChain[0]
    );
  }, [replacementChain]);

  const isOriginalInstall = (entity.replacement_sequence ?? 0) === 0;

  /** Gen #0 identity for Original Build Identification. */
  const originalBuildPartNumber = useMemo(() => {
    const candidates = [
      gen0Install?.part_number,
      entity.original_part_number,
      isOriginalInstall ? currentPartNumber : undefined,
    ];
    for (const candidate of candidates) {
      const trimmed = candidate?.trim();
      if (trimmed) return trimmed;
    }
    return undefined;
  }, [
    gen0Install?.part_number,
    entity.original_part_number,
    isOriginalInstall,
    currentPartNumber,
  ]);

  const originalBuildSerialNumber = useMemo(() => {
    const candidates = [
      gen0Install?.serial_number,
      entity.original_serial_number,
      isOriginalInstall ? currentSerialNumber : undefined,
    ];
    for (const candidate of candidates) {
      const trimmed = candidate?.trim();
      if (trimmed) return trimmed;
    }
    return undefined;
  }, [
    gen0Install?.serial_number,
    entity.original_serial_number,
    isOriginalInstall,
    currentSerialNumber,
  ]);

  const effectivePictureUrl = entity.picture_url?.trim() || syncedPictureUrl;
  const oemName = entity.oem_name?.trim() || linkedOemName;

  const originalOemName = useMemo(() => {
    if (
      isOriginalInstall ||
      (originalBuildPartNumber &&
        currentPartNumber &&
        originalBuildPartNumber.toLowerCase() === currentPartNumber.toLowerCase())
    ) {
      return oemName;
    }
    return undefined;
  }, [isOriginalInstall, originalBuildPartNumber, currentPartNumber, oemName]);

  useEffect(() => {
    let cancelled = false;
    api.hierarchyWorkflow
      .assignmentStatus(ownerType, [entity.id])
      .then((res) => {
        if (!cancelled) setAssignment(res.data?.[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setAssignment(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerType, entity.id, entity.assigned_developer_id]);

  const tone = resolveEntityLifecycleTone({
    hasShortage: Boolean(shortage),
    hasActiveReservation: Boolean(reservation),
    assignedDeveloperId: entity.assigned_developer_id,
    assignment,
  });
  const canVerifyItem = Boolean(
    assignment?.issuance_id &&
      assignment.complete_reported &&
      assignment.test_result?.toLowerCase() === 'pass' &&
      !assignment.verified
  );
  const hasRejectionHistory =
    (assignment?.rejection_count ?? 0) > 0 ||
    (assignment?.rejection_history?.length ?? 0) > 0;
  const showOwnInstallChrome =
    tone === 'neutral' &&
    !inventoryManager &&
    mine &&
    entity.is_current_install !== false;

  const installerLabel = useMemo(() => {
    if (!entity.installed_by_id) return undefined;
    const user = users.find((item) => item.id === entity.installed_by_id);
    return user ? formatUserRef(user) : `User #${entity.installed_by_id}`;
  }, [entity.installed_by_id, users]);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const entityPictureRef = useRef(entity.picture_url);
  entityPictureRef.current = entity.picture_url;

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api.attachments.list(ownerType, entity.id);
      setAttachments(res.data ?? []);
      return res.data ?? [];
    } catch {
      setAttachments([]);
      return [];
    }
  }, [ownerType, entity.id]);

  const ensureReservedInventoryMedia = useCallback(async () => {
    if (!reservation?.inventory_id) return;

    const syncKey = `${ownerType}:${entity.id}:${reservation.inventory_id}:${reservation.inventory_instance_id ?? ''}`;
    if (reservedMediaSyncKeyRef.current === syncKey) {
      if (reservedMediaSyncPromiseRef.current) {
        await reservedMediaSyncPromiseRef.current;
      }
      return;
    }
    reservedMediaSyncKeyRef.current = syncKey;

    const syncPromise = (async () => {
      try {
        const currentAttachments = await loadAttachments();
        const hasPicture = Boolean(entityPictureRef.current?.trim());
        const result = await syncReservedInventoryMediaToEntity({
          entityType: ownerType as HierarchyEntityType,
          entityId: entity.id,
          inventoryId: reservation.inventory_id,
          inventoryInstanceId: reservation.inventory_instance_id,
          hasPicture,
          hasAttachments: currentAttachments.length > 0,
        });

        if (result.pictureUrl && result.pictureUrl !== entityPictureRef.current) {
          setSyncedPictureUrl(result.pictureUrl);
          await onUpdateRef.current({ picture_url: result.pictureUrl });
        }
        if (!currentAttachments.length) {
          await loadAttachments();
        }
      } catch {
        reservedMediaSyncKeyRef.current = null;
      } finally {
        if (reservedMediaSyncPromiseRef.current === syncPromise) {
          reservedMediaSyncPromiseRef.current = null;
        }
      }
    })();

    reservedMediaSyncPromiseRef.current = syncPromise;
    await syncPromise;
  }, [
    reservation?.inventory_id,
    reservation?.inventory_instance_id,
    ownerType,
    entity.id,
    loadAttachments,
  ]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  useEffect(() => {
    void ensureReservedInventoryMedia();
  }, [ensureReservedInventoryMedia]);

  const handleOpenEdit = useCallback(async () => {
    setEditPreparing(true);
    try {
      await ensureReservedInventoryMedia();
      setEditOpen(true);
    } finally {
      setEditPreparing(false);
    }
  }, [ensureReservedInventoryMedia]);

  useEffect(() => {
    if (!sectionOpen) return;

    let cancelled = false;
    setReplacementLoading(true);
    void api.entities
      .getReplacementChain(ownerType, entity.id)
      .then((res) => {
        if (cancelled) return;
        const rows = [...(res.data ?? [])].sort(
          (a, b) => (a.replacement_sequence ?? 0) - (b.replacement_sequence ?? 0)
        );
        setReplacementChain(rows);
      })
      .catch(() => {
        if (!cancelled) setReplacementChain([]);
      })
      .finally(() => {
        if (!cancelled) setReplacementLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sectionOpen, ownerType, entity.id]);

  const hasReplacementHistory = useMemo(
    () =>
      replacementChain.length > 1 ||
      replacementChain.some((row) => (row.replacement_sequence ?? 0) > 0 || !row.is_current_install),
    [replacementChain]
  );

  useEffect(() => {
    if (entity.oem_name?.trim()) {
      setLinkedOemName(undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const byEntity = await api.inventory.listByEntity(entity.id);
        let match = (byEntity.data ?? []).find((item) => item.oem_name?.trim());

        if (!match?.oem_name?.trim() && reservation?.inventory_id) {
          const reserved = await api.inventory.get(reservation.inventory_id);
          if (reserved.data?.oem_name?.trim()) {
            match = reserved.data;
          }
        }

        if (!cancelled) {
          setLinkedOemName(match?.oem_name?.trim() || undefined);
        }
      } catch {
        if (!cancelled) {
          setLinkedOemName(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entity.id, entity.oem_name, reservation?.inventory_id]);

  const handleRemovePicture = async () => {
    try {
      await api.pictures.remove(ownerType, entity.id);
      setSyncedPictureUrl(null);
      await onUpdate({ picture_url: null });
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    }
  };

  const handleUploadPicture = async (file: File) => {
    setPictureUploading(true);
    try {
      const res = await api.pictures.upload(ownerType, entity.id, file);
      setSyncedPictureUrl(res.data.picture_url);
      await onUpdate({ picture_url: res.data.picture_url });
      toast.success('Photo added');
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setPictureUploading(false);
      if (pictureInputRef.current) {
        pictureInputRef.current.value = '';
      }
    }
  };

  const handleAcceptInstallation = async () => {
    const issuanceId = assignment?.issuance_id;
    if (!issuanceId) return;

    setVerifying(true);
    try {
      await api.inventory.verifyItemInstallation(issuanceId);
      toast.success('Installation accepted');
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectProgress(projectId),
        });
      }
      const res = await api.hierarchyWorkflow.assignmentStatus(ownerType, [entity.id]);
      setAssignment(res.data?.[0] ?? null);
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not accept installation';
      toast.error(typeof detail === 'string' ? detail : 'Could not accept installation');
    } finally {
      setVerifying(false);
    }
  };

  const handleRejectInstallation = async (reason: string) => {
    const issuanceId = assignment?.issuance_id;
    if (!issuanceId) return;

    setVerifying(true);
    try {
      await api.inventory.rejectItemInstallation(issuanceId, reason);
      toast.success('Installation rejected — returned to developer');
      setRejectOpen(false);
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectProgress(projectId),
        });
      }
      const res = await api.hierarchyWorkflow.assignmentStatus(ownerType, [entity.id]);
      setAssignment(res.data?.[0] ?? null);
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not reject installation';
      toast.error(typeof detail === 'string' ? detail : 'Could not reject installation');
    } finally {
      setVerifying(false);
    }
  };

  const handleUpload = async (payload: {
    attachment_type: string;
    description?: string;
    file?: File;
  }) => {
    if (!payload.file) return;

    try {
      await api.attachments.upload(ownerType, entity.id, payload.file, {
        attachment_type: payload.attachment_type,
        description: payload.description,
      });
      await loadAttachments();
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Failed to upload attachment');
      throw new Error('upload failed');
    }
  };

  const handleUpdateAttachment = async (payload: {
    attachment_type: string;
    description?: string;
  }) => {
    if (!editingAttachment) return;

    try {
      await api.attachments.update(editingAttachment.id, {
        attachment_type: payload.attachment_type,
        description: payload.description,
      });
      await loadAttachments();
      toast.success('Attachment updated');
    } catch {
      toast.error('Failed to update attachment');
      throw new Error('update failed');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await api.attachments.delete(attachmentId);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      toast.success('Attachment removed');
    } catch {
      toast.error('Failed to remove attachment');
    }
  };

  const replaceTarget = useMemo<ReplaceFromInventoryTarget | null>(() => {
    if (!allowReplace || !projectId || cancelled) return null;
    return {
      entityType: ownerType,
      entityId: entity.id,
      entityName: entity.name,
      partNumber: entity.part_number,
      serialNumber: entity.serial_number,
      replacementSequence: entity.replacement_sequence,
    };
  }, [allowReplace, projectId, ownerType, entity, cancelled]);

  return (
    <>
      <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
        <Card
          className={cn(
            'shadow-sm',
            entityLifecycleCardClass(tone),
            showOwnInstallChrome &&
              'border-emerald-500/70 bg-emerald-50/40 ring-1 ring-emerald-500/25 dark:bg-emerald-950/25 dark:border-emerald-500/50'
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-md text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Item Details</CardTitle>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      sectionOpen && 'rotate-180'
                    )}
                  />
                </div>
                <CardDescription>
                  Part numbers, who installed this item, and related files for {entity.name}
                  {showOwnInstallChrome ? ' — installed by you' : ''}
                </CardDescription>
              </button>
            </CollapsibleTrigger>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {hierarchyHref ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={hierarchyHref}>
                    <Network className="mr-2 h-4 w-4" />
                    Hierarchy
                  </Link>
                </Button>
              ) : null}
              {canVerifyItem || hasRejectionHistory ? (
                <WorkflowCan role={['HM', 'ADMIN']} permission={P.item_verify}>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canVerifyItem ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={cancelled || verifying}
                          onClick={() => void handleAcceptInstallation()}
                        >
                          {verifying ? 'Accepting…' : 'Accept'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={cancelled || verifying}
                          onClick={() => setRejectOpen(true)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {hasRejectionHistory ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={cancelled || verifying}
                        onClick={() =>
                          setRejectionView({
                            label: entity.name,
                            history: assignment?.rejection_history ?? [],
                          })
                        }
                      >
                        Rejection Reasons
                      </Button>
                    ) : null}
                  </div>
                </WorkflowCan>
              ) : null}
              {allowReplace && projectId && canMutateInstall ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setReplaceOpen(true)}>
                  <Replace className="mr-2 h-4 w-4" />
                  Replace
                </Button>
              ) : null}
              {!cancelled && entity.part_number ? (
                <RevertToInventoryButton
                  entityType={ownerType}
                  entityId={entity.id}
                  partNumber={entity.part_number}
                  serialNumber={entity.serial_number}
                  installedById={entity.installed_by_id}
                  isCurrentInstall={entity.is_current_install !== false}
                  onReverted={() => {
                    onReverted?.();
                    router.refresh();
                  }}
                />
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={editPreparing}
                  onClick={() => void handleOpenEdit()}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {editPreparing ? 'Loading…' : 'Edit'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {shortage ? (
                <EntityInventoryHoldDetails
                  tone={tone}
                  shortage={shortage}
                  entity={entity}
                />
              ) : null}

              <Tabs
                value={detailsTab}
                onValueChange={setDetailsTab}
                className="gap-4"
              >
                <TabsList
                  className={cn(
                    'grid h-auto w-full grid-cols-2',
                    reservation ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
                  )}
                >
                  <TabsTrigger value="hardware">Original Build Identification</TabsTrigger>
                  <TabsTrigger value="replacement">Installation/ Maintenance History</TabsTrigger>
                  <TabsTrigger value="picture">Picture</TabsTrigger>
                  <TabsTrigger value="attachments">Attachments</TabsTrigger>
                  {reservation ? (
                    <TabsTrigger value="reservation">Reservation</TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="hardware" className="mt-0">
                  <div className="space-y-3 rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <MetadataField label="Part Number" value={originalBuildPartNumber} />
                      <MetadataField label="Serial Number" value={originalBuildSerialNumber} />
                      <MetadataField label="OEM Name" value={originalOemName} />
                      {ownerType === 'component' || entity.sku?.trim() ? (
                        <MetadataField label="SKU" value={entity.sku} />
                      ) : null}
                    </div>
                  </div>
                </TabsContent>

                {reservation ? (
                  <TabsContent value="reservation" className="mt-0">
                    <div className="space-y-3 rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                        <MetadataField
                          label="Reserved By"
                          value={reservation.reserved_by_name}
                        />
                        <MetadataField
                          label="Reserved At"
                          value={
                            reservation.reserved_at
                              ? new Date(reservation.reserved_at).toLocaleString()
                              : undefined
                          }
                        />
                        <MetadataField
                          label="Expires"
                          value={
                            reservation.expires_at
                              ? new Date(reservation.expires_at).toLocaleString()
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                ) : null}

                <TabsContent value="picture" className="mt-0">
                  <div className="space-y-3 rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                    <input
                      ref={pictureInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUploadPicture(file);
                      }}
                    />
                    {effectivePictureUrl ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Primary photo</p>
                          {canMutateInstall ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pictureUploading}
                                onClick={() => pictureInputRef.current?.click()}
                              >
                                <ImagePlus className="mr-2 h-4 w-4" />
                                {pictureUploading ? 'Uploading…' : 'Replace'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleRemovePicture()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <EntityPicture
                          src={effectivePictureUrl}
                          ownerType={ownerType}
                          ownerId={entity.id}
                          alt={`${entity.name} photo`}
                          className="max-h-56 rounded-md border object-cover"
                        />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No picture added for this item yet.
                        </p>
                        {canMutateInstall ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pictureUploading}
                            onClick={() => pictureInputRef.current?.click()}
                          >
                            <ImagePlus className="mr-2 h-4 w-4" />
                            {pictureUploading ? 'Uploading…' : 'Add picture'}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="attachments" className="mt-0">
                  <div className="space-y-2 rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                    {attachments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="text-sm text-muted-foreground">No attachments yet.</p>
                        {!cancelled ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setUploadOpen(true)}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Files</p>
                          {!cancelled ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setUploadOpen(true)}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload
                            </Button>
                          ) : null}
                        </div>
                        <ul className="space-y-2">
                          {attachments.map((attachment) => (
                            <li
                              key={attachment.id}
                              className="flex items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0 flex-1">
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
                              <div className="flex shrink-0 items-center gap-1">
                                {!cancelled ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditingAttachment(attachment)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => void handleDeleteAttachment(attachment.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="replacement" className="mt-0 space-y-4">
                  <div className="space-y-3 rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <MetadataField
                        label="Current Installation Date"
                        value={
                          entity.installation_date
                            ? new Date(entity.installation_date).toLocaleDateString()
                            : undefined
                        }
                      />
                      <MetadataField label="Current Installed By" value={installerLabel} />
                      <MetadataField label="Current Installed Part Number" value={currentPartNumber} />
                      <MetadataField label="Current Installed OEM Name" value={oemName} />
                      <MetadataField label="Current Serial Number" value={currentSerialNumber} />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/70 p-4 dark:bg-muted/40">
                    {replacementLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Loading replacement history…
                      </p>
                    ) : !hasReplacementHistory ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No replacements recorded for this item yet.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-md border bg-background/60">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="whitespace-nowrap">Gen</TableHead>
                              <TableHead>Part #</TableHead>
                              <TableHead>Serial #</TableHead>
                              <TableHead className="whitespace-nowrap">Installed</TableHead>
                              <TableHead>Installed By</TableHead>
                              <TableHead className="whitespace-nowrap">Replaced</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {replacementChain.map((row) => {
                              const installer = row.installed_by_id
                                ? users.find((user) => user.id === row.installed_by_id)
                                : undefined;
                              return (
                                <TableRow key={row.id}>
                                  <TableCell className="whitespace-nowrap text-sm font-medium">
                                    #{row.replacement_sequence ?? 0}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {row.part_number?.trim() || '—'}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {row.serial_number?.trim() || '—'}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm">
                                    {row.installation_date
                                      ? new Date(row.installation_date).toLocaleDateString()
                                      : '—'}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {installer
                                      ? formatUserRef(installer)
                                      : row.installed_by_id
                                        ? `User #${row.installed_by_id}`
                                        : '—'}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm">
                                    {row.replaced_at
                                      ? new Date(row.replaced_at).toLocaleDateString()
                                      : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge
                                      status={
                                        row.is_current_install ? 'Current install' : 'Superseded'
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {canEdit && parentId != null ? (
        <HierarchyEntityInventoryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          entityType={ownerType}
          entityId={entity.id}
          entity={{
            ...entity,
            picture_url: effectivePictureUrl,
          }}
          parentId={parentId}
          title={`Edit ${entityLabel(ownerType)}`}
          description={`Register details for ${entity.name}`}
          onSaved={async () => {
            await onExistingSaved?.();
            router.refresh();
          }}
        />
      ) : null}

      <AttachmentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleUpload}
      />

      <AttachmentUploadDialog
        open={editingAttachment !== null}
        onOpenChange={(open) => {
          if (!open) setEditingAttachment(null);
        }}
        title="Edit Attachment"
        description="Update the attachment type or descriptive name."
        requireFile={false}
        attachment={editingAttachment ?? undefined}
        onSubmit={handleUpdateAttachment}
      />

      {projectId ? (
        <ReplaceFromInventoryDialog
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          projectId={projectId}
          target={replaceTarget}
          onCompleted={(result) => {
            if (result.new_entity_id && result.new_entity_id !== entity.id) {
              router.replace(HARDWARE_ENTITY_DETAIL_PATH[ownerType](result.new_entity_id));
            }
          }}
        />
      ) : null}
      <RejectInstallationDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        itemLabel={entity.name}
        busy={verifying}
        onConfirm={handleRejectInstallation}
      />
      <RejectionReasonsDialog
        open={rejectionView != null}
        onOpenChange={(open) => {
          if (!open) setRejectionView(null);
        }}
        itemLabel={rejectionView?.label}
        history={rejectionView?.history}
      />
    </>
  );
}
