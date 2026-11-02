'use client';

import { useMemo } from 'react';
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
import { Plus } from 'lucide-react';
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
}: CreateDraftProjectDialogProps) {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isCreating) return;
        onOpenChange(nextOpen);
      }}
    >
      <Can permission={[P.project_create_draft, P.create_projects]}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Draft {projectLabel}
          </Button>
        </DialogTrigger>
      </Can>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-3.5 pr-12 text-left">
          <DialogTitle className="text-lg font-semibold">
            Create Draft {projectLabel}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Name the {projectLabel.toLowerCase()}, choose its order and structure, then save.
            Drafts wait for Project Director or Admin approval before hierarchy generation.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
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
                    <RadioGroupItem value="existing" className="mt-0.5" disabled={isCreating} />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Existing project</span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        Auto-approved; hierarchy shells generated now.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>
            </section>

            <section className="lg:col-span-2">
              <SectionHeading
                title="Structure"
                description="Pick the project configuration, flights, and SDLS per flight. Each SDLS can override configuration."
              />

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
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
                          // Default every SDLS/flight to the new project configuration.
                          hierarchy_config_ids_by_flight: buildConfigMatrix(
                            counts,
                            id
                          ),
                        };
                      });
                    }}
                    disabled={isCreating}
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
                    disabled={isCreating}
                    className="h-9"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    One {projectLabel.toLowerCase()} is created for each flight.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2.5 rounded-lg border bg-muted/20 px-3 py-2.5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <Label>
                      SDLS per flight
                      <RequiredMark />
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Set SDLS count per flight, then optionally choose each SDLS configuration.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Creating{' '}
                    <span className="font-medium text-foreground">
                      {formData.flight_count} {projectWord.toLowerCase()}
                    </span>
                    {' · '}
                    <span className="font-medium text-foreground">
                      {totalSdls} SDLS
                    </span>
                  </p>
                </div>

                <div className="grid gap-2.5 lg:grid-cols-2">
                  {formData.sdls_counts_by_flight
                    .slice(0, formData.flight_count)
                    .map((count, flightIndex) => (
                      <div
                        key={flightIndex}
                        className="space-y-2 rounded-md border bg-background/70 px-2.5 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`create-flight-sdls-${flightIndex}`}
                            className="min-w-14 shrink-0 text-xs font-medium text-muted-foreground"
                          >
                            Flight {flightIndex + 1}
                          </Label>
                          <Input
                            id={`create-flight-sdls-${flightIndex}`}
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
                            disabled={isCreating}
                            className="h-9 w-24"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            SDLS
                          </span>
                        </div>

                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {Array.from({ length: count }, (_, sdlsIndex) => {
                            const selectedId =
                              formData.hierarchy_config_ids_by_flight?.[flightIndex]?.[
                                sdlsIndex
                              ] || formData.hierarchy_config_id;
                            return (
                              <div
                                key={`${flightIndex}-${sdlsIndex}`}
                                className="flex items-center gap-1.5"
                              >
                                <Label
                                  htmlFor={`create-flight-${flightIndex}-sdls-config-${sdlsIndex}`}
                                  className="min-w-12 shrink-0 text-[11px] text-muted-foreground"
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
                                  disabled={isCreating || !formData.hierarchy_config_id}
                                >
                                  <SelectTrigger
                                    id={`create-flight-${flightIndex}-sdls-config-${sdlsIndex}`}
                                    className="h-8 w-full text-xs"
                                  >
                                    <SelectValue placeholder="Config" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableConfigs.map((config) => (
                                      <SelectItem
                                        key={config.id}
                                        value={String(config.id)}
                                      >
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
                    ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-3.5">
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
              ? 'Creating…'
              : formData.is_existing_project
                ? `Create existing ${projectLabel.toLowerCase()}`
                : 'Create draft'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
