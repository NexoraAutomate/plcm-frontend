'use client';

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
import { RequiredMark } from '@/components/ui/required-mark';
import { ProjectManagerSelect } from '@/components/orders/project-manager-select';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { coerceOptionalNumber } from '@/lib/form-validation';
import { Plus } from 'lucide-react';

export type OrderFormData = {
  order_number?: string;
  title: string;
  description?: string | null;
  contract_number?: string | null;
  po_number?: string | null;
  order_date: string;
  delivery_date?: string | null;
  production_support_date?: string | null;
  /** May be a numeric string when hydrated from API Decimals. */
  total_value?: number | string | null;
  currency: string;
  project_manager?: string | null;
  remarks?: string | null;
  customer_id?: number;
  status_id?: number;
};

export const emptyOrderForm: OrderFormData = {
  order_number: '',
  title: '',
  description: '',
  contract_number: '',
  po_number: '',
  order_date: '',
  delivery_date: '',
  production_support_date: '',
  total_value: null,
  currency: 'PKR',
  project_manager: '',
  remarks: '',
  customer_id: undefined,
  status_id: undefined,
};

type Option = {
  id: number;
  name?: string;
  status_name?: string;
};

type OrderFormDialogProps = {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: OrderFormData;
  onFormChange: (
    updater: OrderFormData | ((prev: OrderFormData) => OrderFormData)
  ) => void;
  customers: Option[];
  statuses: Option[];
  onSubmit: () => void;
  submitting?: boolean;
  showCreateTrigger?: boolean;
  lockCustomer?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
};

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

function applyFormChange(
  onFormChange: OrderFormDialogProps['onFormChange'],
  formData: OrderFormData,
  patch: Partial<OrderFormData>
) {
  onFormChange({ ...formData, ...patch });
}

export function OrderFormDialog({
  mode,
  open,
  onOpenChange,
  formData,
  onFormChange,
  customers,
  statuses,
  onSubmit,
  submitting = false,
  showCreateTrigger = false,
  lockCustomer = false,
  titleOverride,
  descriptionOverride,
}: OrderFormDialogProps) {
  const isCreate = mode === 'create';
  const deliverySet = Boolean((formData.delivery_date ?? '').trim());
  const dialogTitle =
    titleOverride ?? (isCreate ? 'Create Order' : 'Edit Order');
  const dialogDescription =
    descriptionOverride ??
    (isCreate
      ? 'Capture commercial terms, schedule, and ownership for this order.'
      : 'Update commercial terms, schedule, and ownership for this order.');

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) return;
        onOpenChange(nextOpen);
      }}
    >
      {showCreateTrigger ? (
        <Can permission={P.create_orders}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Order
            </Button>
          </DialogTrigger>
        </Can>
      ) : null}

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-3.5 pr-12 text-left">
          <DialogTitle className="text-lg font-semibold">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
            <section>
              <SectionHeading
                title="Parties & status"
                description="Who the order belongs to and where it sits in the workflow."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-customer`}>
                    Customer
                    <RequiredMark />
                  </Label>
                  <Select
                    value={formData.customer_id?.toString() ?? ''}
                    onValueChange={(value) =>
                      applyFormChange(onFormChange, formData, {
                        customer_id: Number(value),
                      })
                    }
                    disabled={submitting || lockCustomer}
                  >
                    <SelectTrigger id={`order-${mode}-customer`} className="h-9 w-full">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-status`}>
                    Status
                    <RequiredMark />
                  </Label>
                  <Select
                    value={formData.status_id?.toString() ?? ''}
                    onValueChange={(value) =>
                      applyFormChange(onFormChange, formData, {
                        status_id: Number(value),
                      })
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger id={`order-${mode}-status`} className="h-9 w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id.toString()}>
                          {status.status_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                title="Commercial references"
                description="Contract and purchase-order identifiers for this engagement."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-contract`}>Contract Number</Label>
                  <Input
                    id={`order-${mode}-contract`}
                    value={formData.contract_number ?? ''}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        contract_number: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-po`}>PO Number</Label>
                  <Input
                    id={`order-${mode}-po`}
                    value={formData.po_number ?? ''}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        po_number: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="h-9"
                  />
                </div>
              </div>
            </section>

            <section className="lg:col-span-2">
              <SectionHeading
                title="Order identity"
                description="Title and description used across projects and reporting."
              />
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-title`}>
                    Title
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`order-${mode}-title`}
                    value={formData.title}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, { title: e.target.value })
                    }
                    placeholder="Order title"
                    disabled={submitting}
                    className="h-9"
                    autoFocus={isCreate}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-description`}>Description</Label>
                  <Textarea
                    id={`order-${mode}-description`}
                    value={formData.description ?? ''}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        description: e.target.value,
                      })
                    }
                    placeholder="Specifications and scope notes"
                    disabled={submitting}
                    className="min-h-9 h-9 resize-none py-2"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                title="Schedule"
                description="Order date, delivery, and post-delivery production support."
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-order-date`}>
                    Order Date
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`order-${mode}-order-date`}
                    type="date"
                    value={formData.order_date}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        order_date: e.target.value,
                      })
                    }
                    disabled={submitting}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-delivery`}>Delivery Date</Label>
                  <Input
                    id={`order-${mode}-delivery`}
                    type="date"
                    value={formData.delivery_date ?? ''}
                    onChange={(e) => {
                      const delivery_date = e.target.value;
                      const currentSupport = (formData.production_support_date ?? '').trim();
                      applyFormChange(onFormChange, formData, {
                        delivery_date,
                        production_support_date: !delivery_date
                          ? ''
                          : currentSupport && currentSupport < delivery_date
                            ? ''
                            : formData.production_support_date,
                      });
                    }}
                    disabled={submitting}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-production-support`}>
                    Production Support
                  </Label>
                  <Input
                    id={`order-${mode}-production-support`}
                    type="date"
                    value={formData.production_support_date ?? ''}
                    min={formData.delivery_date || undefined}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        production_support_date: e.target.value,
                      })
                    }
                    disabled={submitting || !deliverySet}
                    className="h-9"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {deliverySet
                      ? 'On or after delivery date.'
                      : 'Requires a delivery date.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                title="Value & ownership"
                description="Commercial value and the project manager responsible for delivery."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-value`}>Total Value</Label>
                  <Input
                    id={`order-${mode}-value`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={formData.total_value ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        applyFormChange(onFormChange, formData, { total_value: null });
                        return;
                      }
                      applyFormChange(onFormChange, formData, {
                        total_value: coerceOptionalNumber(raw),
                      });
                    }}
                    disabled={submitting}
                    className="h-9"
                    placeholder="e.g. 150000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`order-${mode}-currency`}>
                    Currency
                    <RequiredMark />
                  </Label>
                  <Input
                    id={`order-${mode}-currency`}
                    value={formData.currency}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        currency: e.target.value,
                      })
                    }
                    placeholder="USD / PKR / EUR"
                    disabled={submitting}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`order-${mode}-pm`}>Project Manager</Label>
                  <ProjectManagerSelect
                    id={`order-${mode}-pm`}
                    value={formData.project_manager}
                    onChange={(project_manager) =>
                      applyFormChange(onFormChange, formData, { project_manager })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`order-${mode}-remarks`}>Remarks</Label>
                  <Textarea
                    id={`order-${mode}-remarks`}
                    value={formData.remarks ?? ''}
                    onChange={(e) =>
                      applyFormChange(onFormChange, formData, {
                        remarks: e.target.value,
                      })
                    }
                    placeholder="Internal notes"
                    disabled={submitting}
                    className="min-h-9 h-9 resize-none py-2"
                  />
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
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            {isCreate ? 'Create' : 'Update Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
