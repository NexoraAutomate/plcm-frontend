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
  is_existing_project: boolean;
};

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
    <div className="space-y-1">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
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

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-lg font-semibold">
            Create Draft {projectLabel}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Name the {projectLabel.toLowerCase()}, choose its order and structure, then save.
            Drafts wait for Project Director or Admin approval before hierarchy generation.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,640px)] space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <SectionHeading
              title="Basics"
              description={`What this ${projectLabel.toLowerCase()} is called and which order it belongs to.`}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
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
                  className="h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
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
                  <SelectTrigger id="create-project-order" className="h-10 w-full">
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

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-project-description">Description</Label>
                <Textarea
                  id="create-project-description"
                  value={formData.description ?? ''}
                  onChange={(e) =>
                    onFormChange({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional notes for the team"
                  disabled={isCreating}
                  className="min-h-20 resize-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Structure"
              description="Pick the Smart SDLS template and how many flights and SDLS units to create."
            />

            <div className="space-y-2">
              <Label htmlFor="create-project-config">
                Configuration template
                <RequiredMark />
              </Label>
              <Select
                value={
                  formData.hierarchy_config_id ? String(formData.hierarchy_config_id) : ''
                }
                onValueChange={(value) => {
                  const id = parseInt(value, 10);
                  const config = availableConfigs.find((item) => item.id === id);
                  onFormChange({
                    ...formData,
                    hierarchy_config_id: id,
                    product_type: config?.product_type_codes?.[0] || '',
                  });
                }}
                disabled={isCreating}
              >
                <SelectTrigger id="create-project-config" className="h-10 w-full">
                  <SelectValue placeholder="Select an available configuration" />
                </SelectTrigger>
                <SelectContent>
                  {availableConfigs.map((config) => (
                    <SelectItem key={config.id} value={String(config.id)}>
                      {config.name} ({config.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedConfig
                  ? `Uses ${selectedConfig.name} when the hierarchy is generated.`
                  : availableConfigs.length === 0
                    ? 'No available configurations right now. Ask an admin to publish one first.'
                    : 'This template defines the hardware tree applied to each SDLS.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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
                    onFormChange((prev) => ({
                      ...prev,
                      flight_count: flightCount,
                      sdls_counts_by_flight: Array.from(
                        { length: flightCount },
                        (_, index) => prev.sdls_counts_by_flight[index] ?? 1
                      ),
                    }));
                  }}
                  disabled={isCreating}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  One {projectLabel.toLowerCase()} is created for each flight.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1">
                <Label>
                  SDLS units per flight
                  <RequiredMark />
                </Label>
                <p className="text-xs text-muted-foreground">
                  Set how many SDLS units sit under each flight.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {formData.sdls_counts_by_flight.map((count, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Label
                      htmlFor={`create-flight-sdls-${index}`}
                      className="min-w-20 text-sm font-medium text-muted-foreground"
                    >
                      Flight {index + 1}
                    </Label>
                    <Input
                      id={`create-flight-sdls-${index}`}
                      type="number"
                      min={1}
                      value={count}
                      onChange={(e) => {
                        const nextCount = Math.max(1, Number(e.target.value) || 1);
                        onFormChange((prev) => {
                          const counts = [...prev.sdls_counts_by_flight];
                          counts[index] = nextCount;
                          return {
                            ...prev,
                            sdls_per_flight: Math.max(...counts),
                            sdls_counts_by_flight: counts,
                          };
                        });
                      }}
                      disabled={isCreating}
                      className="h-10"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-dashed bg-background px-3 py-2.5 text-sm text-muted-foreground">
              You will create{' '}
              <span className="font-medium text-foreground">
                {formData.flight_count} {projectWord.toLowerCase()}
              </span>{' '}
              with{' '}
              <span className="font-medium text-foreground">
                {totalSdls} SDLS {totalSdls === 1 ? 'unit' : 'units'}
              </span>{' '}
              in total.
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Schedule"
              description="Optional planning dates. You can fill these in later."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-project-start">Start date</Label>
                <Input
                  id="create-project-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    onFormChange({ ...formData, start_date: e.target.value })
                  }
                  disabled={isCreating}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-project-end">End date</Label>
                <Input
                  id="create-project-end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    onFormChange({ ...formData, end_date: e.target.value })
                  }
                  disabled={isCreating}
                  className="h-10"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Creation path"
              description="Choose whether this needs approval, or is an existing program ready to use."
            />
            <RadioGroup
              value={creationMode}
              onValueChange={(value) =>
                onFormChange({
                  ...formData,
                  is_existing_project: value === 'existing',
                })
              }
              className="gap-3"
              disabled={isCreating}
            >
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  creationMode === 'draft'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/40'
                )}
              >
                <RadioGroupItem value="draft" className="mt-0.5" disabled={isCreating} />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">New draft</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Saved as Draft. Hierarchy generation stays locked until a Project Director
                    or Admin approves.
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  creationMode === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/40'
                )}
              >
                <RadioGroupItem value="existing" className="mt-0.5" disabled={isCreating} />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Existing project</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Auto-approved for an already in-service program. You become Hierarchy Manager
                    and hierarchy shells are generated now.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
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
