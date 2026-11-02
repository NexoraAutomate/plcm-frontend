'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RequiredMark } from '@/components/ui/required-mark';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { ArrowRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HierarchyConfigurationSummary } from '@/lib/models';

export type CreateDraftProjectFormData = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  owner_id: number;
  order_id: number;
  status_id: number;
  hierarchy_config_id: number;
  product_type: string;
  flight_count: number;
  sdls_per_flight: number;
  sdls_counts_by_flight: number[];
  /** One hierarchy config id per SDLS under each flight. */
  hierarchy_config_ids_by_flight: number[][];
  is_existing_project: boolean;
};

function buildConfigMatrix(
  counts: number[],
  defaultConfigId: number,
  previous?: number[][]
): number[][] {
  const fallback = defaultConfigId > 0 ? defaultConfigId : 0;
  return counts.map((count, flightIndex) => {
    const prevRow = previous?.[flightIndex] ?? [];
    return Array.from({ length: Math.max(1, count) }, (_, sdlsIndex) => {
      const existing = prevRow[sdlsIndex];
      return existing && existing > 0 ? existing : fallback;
    });
  });
}

type OrderOption = {
  id: number;
  order_number: string;
  title?: string | null;
};

interface CreateDraftProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateDraftProjectFormData;
  onFormChange: (
    updater:
      | CreateDraftProjectFormData
      | ((prev: CreateDraftProjectFormData) => CreateDraftProjectFormData)
  ) => void;
  orders: OrderOption[];
  availableConfigs: HierarchyConfigurationSummary[];
  isCreating: boolean;
  onSubmit: () => void;
  projectLabel: string;
  projectLabelPlural: string;
  mode?: 'create' | 'edit';
  showTrigger?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
  /** When true, structural fields stay editable (Admin override after approval). */
  allowStructuralEdit?: boolean;
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3 border-b border-border/80 pb-2">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-4 w-1 shrink-0 rounded-full bg-primary"
        />
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">
          {title}
        </h3>
      </div>
      {description ? (
        <p className="mt-1 pl-[18px] text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function SdlsFlightCards({
  formData,
  onFormChange,
  availableConfigs,
  structuralDisabled,
  idPrefix,
  animated = false,
}: {
  formData: CreateDraftProjectFormData;
  onFormChange: CreateDraftProjectDialogProps['onFormChange'];
  availableConfigs: HierarchyConfigurationSummary[];
  structuralDisabled: boolean;
  idPrefix: string;
  animated?: boolean;
}) {
  const flights = formData.sdls_counts_by_flight.slice(0, formData.flight_count);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {flights.map((count, flightIndex) => {
        const card = (
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary">
                  F{flightIndex + 1}
                </span>
                <div>
                  <p className="text-sm font-medium leading-none">
                    Flight {flightIndex + 1}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {count} SDLS
                    {count === 1 ? '' : 's'} on this flight
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`${idPrefix}-flight-sdls-${flightIndex}`}
                  className="text-xs text-muted-foreground"
                >
                  Count
                </Label>
                <Input
                  id={`${idPrefix}-flight-sdls-${flightIndex}`}
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => {
                    const nextCount = Math.max(1, Number(e.target.value) || 1);
                    onFormChange((prev) => {
                      const counts = [...prev.sdls_counts_by_flight];
                      counts[flightIndex] = nextCount;
                      return {
                        ...prev,
                        sdls_per_flight: Math.max(...counts),
                        sdls_counts_by_flight: counts,
                        hierarchy_config_ids_by_flight: buildConfigMatrix(
                          counts.slice(0, prev.flight_count),
                          prev.hierarchy_config_id,
                          prev.hierarchy_config_ids_by_flight
                        ),
                      };
                    });
                  }}
                  disabled={structuralDisabled}
                  className="h-9 w-20 text-center tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                SDLS configuration
              </p>
              <div className="grid gap-2">
                {Array.from({ length: count }, (_, sdlsIndex) => {
                  const selectedId =
                    formData.hierarchy_config_ids_by_flight?.[flightIndex]?.[
                      sdlsIndex
                    ] || formData.hierarchy_config_id;
                  return (
                    <div
                      key={`${flightIndex}-${sdlsIndex}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5"
                    >
                      <Label
                        htmlFor={`${idPrefix}-flight-${flightIndex}-sdls-config-${sdlsIndex}`}
                        className="whitespace-nowrap text-xs text-muted-foreground"
                      >
                        SDLS {sdlsIndex + 1}
                      </Label>
                      <Select
                        value={selectedId ? String(selectedId) : ''}
                        onValueChange={(value) => {
                          const configId = parseInt(value, 10);
                          onFormChange((prev) => {
                            const matrix = buildConfigMatrix(
                              prev.sdls_counts_by_flight.slice(
                                0,
                                prev.flight_count
                              ),
                              prev.hierarchy_config_id,
                              prev.hierarchy_config_ids_by_flight
                            );
                            matrix[flightIndex][sdlsIndex] = configId;
                            return {
                              ...prev,
                              hierarchy_config_ids_by_flight: matrix,
                            };
                          });
                        }}
                        disabled={
                          structuralDisabled || !formData.hierarchy_config_id
                        }
                      >
                        <SelectTrigger
                          id={`${idPrefix}-flight-${flightIndex}-sdls-config-${sdlsIndex}`}
                          className="h-9 w-full"
                        >
                          <SelectValue placeholder="Select configuration" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableConfigs.map((config) => (
                            <SelectItem key={config.id} value={String(config.id)}>
                              {config.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

        if (!animated) {
          return <div key={flightIndex}>{card}</div>;
        }

        return (
          <motion.div
            key={flightIndex}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 0.12 + flightIndex * 0.045,
              type: 'spring',
              stiffness: 380,
              damping: 28,
            }}
          >
            {card}
          </motion.div>
        );
      })}
    </div>
  );
}

export function CreateDraftProjectDialog({
  open,
  onOpenChange,
  formData,
  onFormChange,
  orders,
  availableConfigs,
  isCreating,
  onSubmit,
  projectLabel,
  projectLabelPlural,
  mode = 'create',
  showTrigger = true,
  titleOverride,
  descriptionOverride,
  allowStructuralEdit = true,
}: CreateDraftProjectDialogProps) {
  const [sdlsDialogOpen, setSdlsDialogOpen] = useState(false);
  const isEdit = mode === 'edit';
  const totalSdls = useMemo(
    () =>
      formData.sdls_counts_by_flight
        .slice(0, formData.flight_count)
        .reduce((sum, count) => sum + Number(count || 0), 0),
    [formData.flight_count, formData.sdls_counts_by_flight]
  );

  const selectedConfig = availableConfigs.find(
    (config) => config.id === formData.hierarchy_config_id
  );

  const creationMode = formData.is_existing_project ? 'existing' : 'draft';
  const projectWord = formData.flight_count === 1 ? projectLabel : projectLabelPlural;
  const structuralDisabled = isCreating || !allowStructuralEdit;
  const dialogTitle =
    titleOverride ??
    (isEdit ? `Edit ${projectLabel}` : `Create Draft ${projectLabel}`);
  const dialogDescription =
    descriptionOverride ??
    (isEdit
      ? `Update ${projectLabel.toLowerCase()} order, schedule, and structure.`
      : `Name the ${projectLabel.toLowerCase()}, choose its order and structure, then save. Drafts wait for Project Director or Admin approval before hierarchy generation.`);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isCreating) return;
        if (!nextOpen) setSdlsDialogOpen(false);
        onOpenChange(nextOpen);
      }}
    >
      {showTrigger ? (
        <Can permission={[P.project_create_draft, P.create_projects]}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Draft {projectLabel}
            </Button>
          </DialogTrigger>
        </Can>
      ) : null}

      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b px-6 py-3.5 pr-12 text-left">
          <DialogTitle className="text-lg font-semibold">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(90vh-8.5rem)] flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-x-8">
            <section>
              <SectionHeading
                title="Basics"
                description={`What this ${projectLabel.toLowerCase()} is called and which order it belongs to.`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="create-project-name">
                    {projectLabel} name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="create-project-name"
                    value={formData.name}
                    onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                    placeholder="e.g. Flight Program Alpha"
                    disabled={isCreating}
                    className="h-9"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-project-order">
                    Order
                    <RequiredMark />
                  </Label>
                  <Select
                    value={formData.order_id ? formData.order_id.toString() : ''}
                    onValueChange={(value) =>
                      onFormChange({
                        ...formData,
                        order_id: parseInt(value, 10),
                      })
                    }
                    disabled={isCreating}
                  >
                    <SelectTrigger id="create-project-order" className="h-9 w-full">
                      <SelectValue placeholder="Select the related order" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id.toString()}>
                          {order.order_number}
                          {order.title ? ` — ${order.title}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-project-description">Description</Label>
                  <Textarea
                    id="create-project-description"
                    value={formData.description ?? ''}
                    onChange={(e) =>
                      onFormChange({ ...formData, description: e.target.value })
                    }
                    placeholder="Optional notes"
                    disabled={isCreating}
                    className="min-h-9 h-9 resize-none py-2"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                title="Schedule"
                description="Optional planning dates. You can fill these in later."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-project-start">Start date</Label>
                  <Input
                    id="create-project-start"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => {
                      const start_date = e.target.value;
                      onFormChange((prev) => ({
                        ...prev,
                        start_date,
                        end_date:
                          prev.end_date && start_date && prev.end_date < start_date
                            ? ''
                            : prev.end_date,
                      }));
                    }}
                    disabled={isCreating}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-project-end">End date</Label>
                  <Input
                    id="create-project-end"
                    type="date"
                    value={formData.end_date}
                    min={formData.start_date || undefined}
                    onChange={(e) =>
                      onFormChange({ ...formData, end_date: e.target.value })
                    }
                    disabled={isCreating || !formData.start_date}
                    className="h-9"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {formData.start_date
                      ? 'Must be on or after the start date.'
                      : 'Set a start date to enable end date.'}
                  </p>
                </div>
              </div>

              {!isEdit ? (
                <div className="mt-4">
                  <SectionHeading
                    title="Creation path"
                    description="Draft needs approval; existing programs generate hierarchy now."
                  />
                  <RadioGroup
                    value={creationMode}
                    onValueChange={(value) =>
                      onFormChange({
                        ...formData,
                        is_existing_project: value === 'existing',
                      })
                    }
                    className="grid gap-3 sm:grid-cols-2"
                    disabled={isCreating}
                  >
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                        creationMode === 'draft'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/40'
                      )}
                    >
                      <RadioGroupItem value="draft" className="mt-0.5" disabled={isCreating} />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">New draft</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          Saved as Draft until PD/Admin approval.
                        </span>
                      </span>
                    </label>

                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                        creationMode === 'existing'
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/40'
                      )}
                    >
                      <RadioGroupItem
                        value="existing"
                        className="mt-0.5"
                        disabled={isCreating}
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">Existing project</span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          Auto-approved; hierarchy shells generated now.
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              ) : null}
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Structure"
              description="Pick the project configuration, flights, and SDLS per flight. Each SDLS can override configuration."
            />

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="create-project-config">
                  Project configuration
                  <RequiredMark />
                </Label>
                <Select
                  value={
                    formData.hierarchy_config_id
                      ? String(formData.hierarchy_config_id)
                      : ''
                  }
                  onValueChange={(value) => {
                    const id = parseInt(value, 10);
                    const config = availableConfigs.find((item) => item.id === id);
                    onFormChange((prev) => {
                      const counts = prev.sdls_counts_by_flight.slice(
                        0,
                        prev.flight_count
                      );
                      return {
                        ...prev,
                        hierarchy_config_id: id,
                        product_type: config?.product_type_codes?.[0] || '',
                        hierarchy_config_ids_by_flight: buildConfigMatrix(counts, id),
                      };
                    });
                  }}
                  disabled={structuralDisabled}
                >
                  <SelectTrigger id="create-project-config" className="h-9 w-full">
                    <SelectValue placeholder="Select project configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConfigs.map((config) => (
                      <SelectItem key={config.id} value={String(config.id)}>
                        {config.name} ({config.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {selectedConfig
                    ? `Default for all flights and SDLS: ${selectedConfig.name}.`
                    : availableConfigs.length === 0
                      ? 'No available configurations right now. Ask an admin to publish one first.'
                      : 'Applied to every SDLS by default; override per SDLS below if needed.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-project-flight-count">
                  Number of flights
                  <RequiredMark />
                </Label>
                <Input
                  id="create-project-flight-count"
                  type="number"
                  min={1}
                  value={formData.flight_count}
                  onChange={(e) => {
                    const flightCount = Math.max(1, Number(e.target.value) || 1);
                    onFormChange((prev) => {
                      const counts = Array.from(
                        { length: flightCount },
                        (_, index) => prev.sdls_counts_by_flight[index] ?? 1
                      );
                      return {
                        ...prev,
                        flight_count: flightCount,
                        sdls_counts_by_flight: counts,
                        hierarchy_config_ids_by_flight: buildConfigMatrix(
                          counts,
                          prev.hierarchy_config_id,
                          prev.hierarchy_config_ids_by_flight
                        ),
                      };
                    });
                  }}
                  disabled={structuralDisabled}
                  className="h-9"
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  One {projectLabel.toLowerCase()} is created for each flight.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
                <div className="min-w-0">
                  <Label className="text-sm">
                    SDLS per flight
                    <RequiredMark />
                  </Label>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Open the flight workspace to set SDLS counts and configurations.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium tabular-nums">
                    {formData.flight_count} {projectWord.toLowerCase()}
                  </span>
                  <span className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium tabular-nums">
                    {totalSdls} SDLS
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border-primary/30 bg-primary/5 text-primary shadow-sm transition-all hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setSdlsDialogOpen(true)}
                    aria-label="Configure SDLS per flight"
                    title="Configure SDLS per flight"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <button
                type="button"
                className="flex w-full flex-wrap gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                onClick={() => setSdlsDialogOpen(true)}
              >
                {formData.sdls_counts_by_flight
                  .slice(0, formData.flight_count)
                  .map((count, flightIndex) => (
                    <span
                      key={flightIndex}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-sm"
                    >
                      <span className="font-semibold text-primary">
                        F{flightIndex + 1}
                      </span>
                      <span className="text-muted-foreground">
                        {count} SDLS{count === 1 ? '' : 's'}
                      </span>
                    </span>
                  ))}
                {formData.flight_count < 1 ? (
                  <span className="text-xs text-muted-foreground">
                    Set number of flights, then configure SDLS here.
                  </span>
                ) : null}
              </button>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={isCreating}>
            {isCreating
              ? isEdit
                ? 'Updating…'
                : 'Creating…'
              : isEdit
                ? `Update ${projectLabel.toLowerCase()}`
                : formData.is_existing_project
                  ? `Create existing ${projectLabel.toLowerCase()}`
                  : 'Create draft'}
          </Button>
        </div>
      </DialogContent>

      <Dialog open={sdlsDialogOpen} onOpenChange={setSdlsDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            'flex h-[min(88vh,820px)] max-h-[88vh] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-5xl',
            'data-[state=open]:duration-300 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100'
          )}
        >
          <AnimatePresence mode="wait">
            {sdlsDialogOpen ? (
              <motion.div
                key="sdls-workspace"
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
                initial={{ opacity: 0, x: 84, scale: 0.9, rotateY: -10 }}
                animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{
                  type: 'spring',
                  stiffness: 320,
                  damping: 26,
                  mass: 0.9,
                }}
                style={{ transformPerspective: 1200 }}
              >
                <DialogHeader className="shrink-0 border-b px-6 py-4 pr-6 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <DialogTitle className="text-lg font-semibold">
                        SDLS per flight
                      </DialogTitle>
                      <DialogDescription className="text-sm leading-relaxed">
                        Set how many SDLS each flight gets, then choose a configuration
                        for every SDLS.
                      </DialogDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="rounded-md border bg-muted/40 px-2.5 py-1 font-medium tabular-nums">
                        {formData.flight_count} {projectWord.toLowerCase()}
                      </span>
                      <span className="rounded-md border bg-muted/40 px-2.5 py-1 font-medium tabular-nums">
                        {totalSdls} SDLS
                      </span>
                    </div>
                  </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                  <SdlsFlightCards
                    formData={formData}
                    onFormChange={onFormChange}
                    availableConfigs={availableConfigs}
                    structuralDisabled={structuralDisabled}
                    idPrefix="sdls-dialog"
                    animated
                  />
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3.5">
                  <Button type="button" onClick={() => setSdlsDialogOpen(false)}>
                    Done
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
