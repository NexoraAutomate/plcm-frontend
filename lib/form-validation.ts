/**
 * Shared client-side form validation aligned with
 * docs/form_validation_rules_review.md.
 *
 * `0` is a valid numeric value. Parent / FK ids use `isMissingId` so unset `0`
 * still fails. Strings are trimmed before emptiness checks.
 */

import { validatePasswordAgainstPolicy } from '@/lib/password-policy';
import type { PasswordPolicyPublic } from '@/lib/models';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** True when a required FK / select id is unset (including 0). */
export function isMissingId(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  const n = typeof value === 'number' ? value : Number(value);
  return !Number.isFinite(n) || n <= 0;
}

export function requiredMessage(label: string): string {
  return `${label} is required`;
}

export function optionalEmailError(email: unknown): string | null {
  if (isBlank(email)) return null;
  const trimmed = String(email).trim();
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address';
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string
): string | null {
  if (isBlank(confirmPassword)) return requiredMessage('Confirm password');
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
}

export function validateLoginForm(username: string, password: string): string | null {
  if (isBlank(username) || isBlank(password)) {
    return 'Please enter username and password';
  }
  return null;
}

export function validateSignupForm(input: {
  fullName: string;
  username: string;
  password: string;
  confirmPassword: string;
  email?: string;
  passwordPolicy?: PasswordPolicyPublic | null;
}): string | null {
  if (isBlank(input.fullName)) return requiredMessage('Full name');
  if (isBlank(input.username)) return requiredMessage('Username');
  if (isBlank(input.password)) return requiredMessage('Password');
  const confirmError = validatePasswordConfirmation(input.password, input.confirmPassword);
  if (confirmError) return confirmError;
  const policyError = validatePasswordAgainstPolicy(input.password, input.passwordPolicy);
  if (policyError) return policyError;
  return optionalEmailError(input.email);
}

export function validateChangePasswordForm(input: {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordPolicy?: PasswordPolicyPublic | null;
}): string | null {
  if (isBlank(input.oldPassword)) return requiredMessage('Current password');
  if (isBlank(input.newPassword)) return requiredMessage('New password');
  const confirmError = validatePasswordConfirmation(input.newPassword, input.confirmPassword);
  if (confirmError) return confirmError;
  return validatePasswordAgainstPolicy(input.newPassword, input.passwordPolicy);
}

export function validateUserCreateForm(input: {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  passwordPolicy?: PasswordPolicyPublic | null;
}): string | null {
  if (isBlank(input.username)) return requiredMessage('Username');
  if (isBlank(input.password)) return requiredMessage('Password');
  if (isBlank(input.fullName)) return requiredMessage('Full name');
  const policyError = validatePasswordAgainstPolicy(input.password, input.passwordPolicy);
  if (policyError) return policyError;
  return optionalEmailError(input.email);
}

export function validateUserEditForm(input: {
  fullName: string;
  email?: string;
  password?: string;
  passwordPolicy?: PasswordPolicyPublic | null;
}): string | null {
  if (isBlank(input.fullName)) return requiredMessage('Full name');
  if (!isBlank(input.password)) {
    const policyError = validatePasswordAgainstPolicy(input.password ?? '', input.passwordPolicy);
    if (policyError) return policyError;
  }
  return optionalEmailError(input.email);
}

export function validateCustomerForm(input: {
  name: string;
  statusId?: number | null;
  email?: string | null;
}): string | null {
  if (isBlank(input.name)) return requiredMessage('Customer name');
  if (isMissingId(input.statusId)) return requiredMessage('Status');
  return optionalEmailError(input.email);
}

export function validateOrderForm(input: {
  title: string;
  orderDate: string;
  currency: string;
  statusId?: number | null;
  customerId?: number | null;
}): string | null {
  if (isBlank(input.title)) return requiredMessage('Title');
  if (isBlank(input.orderDate)) return requiredMessage('Order date');
  if (isBlank(input.currency)) return requiredMessage('Currency');
  if (isMissingId(input.statusId)) return requiredMessage('Status');
  if (isMissingId(input.customerId)) return requiredMessage('Customer');
  return null;
}

export function validateProjectCreateForm(input: {
  name: string;
  hierarchyConfigId?: number | null;
  orderId?: number | null;
  productType: string;
  flightCount: number;
  sdlsCountsByFlight: number[];
}): string | null {
  if (isBlank(input.name)) return requiredMessage('Name');
  if (isMissingId(input.orderId)) return requiredMessage('Order');
  if (isMissingId(input.hierarchyConfigId)) return requiredMessage('Hierarchy configuration');
  if (isBlank(input.productType)) return requiredMessage('Product type');
  const flightCount = Number(input.flightCount);
  if (!Number.isFinite(flightCount) || flightCount < 1) {
    return 'Flight count must be at least 1';
  }
  if (input.sdlsCountsByFlight.length !== flightCount) {
    return 'SDLS counts must be provided for each flight';
  }
  if (input.sdlsCountsByFlight.some((count) => Number(count) < 1)) {
    return 'Each flight must have at least 1 SDLS';
  }
  return null;
}

export function validateProjectEditForm(input: {
  name: string;
  ownerId?: number | null;
  statusId?: number | null;
  orderId?: number | null;
  startDate: string;
  endDate: string;
}): string | null {
  if (isBlank(input.name)) return requiredMessage('Name');
  if (isMissingId(input.ownerId)) return requiredMessage('Owner');
  if (isMissingId(input.statusId)) return requiredMessage('Status');
  if (isMissingId(input.orderId)) return requiredMessage('Order');
  if (isBlank(input.startDate)) return requiredMessage('Start date');
  if (isBlank(input.endDate)) return requiredMessage('End date');
  return null;
}

export function validateHardwareForm(input: {
  name: string;
  parentId?: number | null;
  parentLabel: string;
  statusId?: number | null;
  requireStatus?: boolean;
}): string | null {
  if (isBlank(input.name)) return requiredMessage('Name');
  if (isMissingId(input.parentId)) return requiredMessage(input.parentLabel);
  if (input.requireStatus && isMissingId(input.statusId)) return requiredMessage('Status');
  return null;
}

export function validateInventoryForm(input: {
  name: string;
  partNumber?: string;
  location?: string;
  quantity?: number;
  usesInstances: boolean;
  supportsQuantity: boolean;
  isHierarchy?: boolean;
  isComponent?: boolean;
  entityCategoryLabel: string;
  locationLabel?: string;
}): string | null {
  const locationLabel = input.locationLabel ?? 'Location';
  const isHierarchy = Boolean(input.isHierarchy);
  if (isBlank(input.name) || (!isHierarchy && !input.usesInstances && isBlank(input.location))) {
    return `Please fill in required fields: ${input.entityCategoryLabel} category${
      input.usesInstances || isHierarchy ? '' : ` and ${locationLabel}`
    }`;
  }
  if (input.usesInstances && isBlank(input.partNumber)) {
    return 'Part number is required for serialized inventory';
  }
  if (!isHierarchy && input.usesInstances && !input.isComponent && isBlank(input.location)) {
    return `${locationLabel} is required for each serialized unit`;
  }
  if (!isHierarchy && input.supportsQuantity && Number(input.quantity) <= 0) {
    return 'Please enter a quantity greater than 0';
  }
  return null;
}

export function validateMaintenanceCaseForm(input: {
  isEdit: boolean;
  projectId?: string;
  description?: string;
  status?: string;
}): string | null {
  if (input.isEdit) {
    if (isBlank(input.status)) return requiredMessage('Status');
    return null;
  }
  if (isBlank(input.projectId)) return requiredMessage('Project');
  if (isBlank(input.description)) return requiredMessage('Description');
  return null;
}

export function validateMaintenanceLogForm(input: {
  serialNumber: string;
  entityId?: number | null;
  performedBy?: number | null;
  notes: string;
}): string | null {
  if (isBlank(input.serialNumber)) return requiredMessage('Serial number');
  if (isMissingId(input.entityId)) return 'Look up a serial number before saving';
  if (isMissingId(input.performedBy)) return requiredMessage('Performed by');
  if (isBlank(input.notes)) return requiredMessage('Notes');
  return null;
}

export function validateConfigChangeForm(input: {
  targetConfigId?: number | string | null;
  productType: string;
  reason: string;
}): string | null {
  if (isMissingId(input.targetConfigId) || isBlank(input.productType) || isBlank(input.reason)) {
    return 'Select a target configuration, product type, and enter a reason';
  }
  return null;
}

export function validateHierarchyConfigForm(input: {
  name: string;
  code: string;
  productTypeCount: number;
  nodeCount: number;
  unassignedCount: number;
  nameTaken: boolean;
  action?: 'saving' | 'duplicating';
}): string | null {
  const action = input.action ?? 'saving';
  if (isBlank(input.name)) return requiredMessage('Configuration name');
  if (input.nameTaken) return `Configuration name “${input.name.trim()}” already exists`;
  if (isBlank(input.code)) return requiredMessage('Configuration code');
  if (input.productTypeCount < 1) return 'Add at least one product type';
  if (input.nodeCount < 1) return `Add at least one hierarchy node before ${action}`;
  if (input.unassignedCount > 0) {
    return `Assign an entity to every node before ${action} (${input.unassignedCount} unassigned)`;
  }
  return null;
}

export function validateIssueInventoryForm(input: {
  signaturePresent: boolean;
  developerId?: number | null;
  usesInstances: boolean;
  instanceId?: number | null;
  quantity: number;
  availableQuantity?: number;
}): string | null {
  if (!input.signaturePresent) return 'Signature is required to issue';
  if (isMissingId(input.developerId)) return 'Select a developer';
  if (input.usesInstances && isMissingId(input.instanceId)) {
    return 'Select a serial number to issue';
  }
  if (!input.usesInstances) {
    const qty = Math.max(1, Number(input.quantity) || 1);
    const avail = input.availableQuantity ?? 0;
    if (qty > avail) return `Only ${avail} unit(s) available to issue`;
  }
  return null;
}

export function validateShortageReceiveForm(input: {
  quantity: unknown;
  partNumber: string;
}): string | null {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Enter a quantity of at least 1';
  }
  if (isBlank(input.partNumber)) return requiredMessage('Part number');
  return null;
}

export function validateResolveFaultForm(input: {
  resolutionType?: string | null;
  requiresReplacement: boolean;
  hasStock: boolean;
  replacementSelected: boolean;
}): string | null {
  if (isBlank(input.resolutionType)) return requiredMessage('Resolution type');
  if (input.requiresReplacement && input.hasStock && !input.replacementSelected) {
    return requiredMessage('Replacement serial');
  }
  return null;
}

export function validateAttachmentForm(input: {
  requireFile: boolean;
  file?: File | null;
}): string | null {
  if (input.requireFile && !input.file) return requiredMessage('File');
  return null;
}

export function validateAssignDeveloperForm(developerId: unknown): string | null {
  if (isMissingId(developerId)) return 'Select a developer';
  return null;
}

export function validateRoleName(name: string): string | null {
  if (isBlank(name)) return requiredMessage('Role name');
  return null;
}

export function validatePermissionName(name: string): string | null {
  if (isBlank(name)) return requiredMessage('Permission name');
  return null;
}

export function validateEntityListName(name: string): string | null {
  if (isBlank(name)) return 'Name is required.';
  return null;
}

export function validateStatusForm(input: {
  name: string;
  statusType: string;
  colorValid: boolean;
}): string | null {
  if (isBlank(input.name)) return requiredMessage('Status name');
  if (isBlank(input.statusType)) return requiredMessage('Category');
  if (!input.colorValid) return 'Select a valid color from the palette (e.g. #059669)';
  return null;
}

export function validateIssuanceRemarks(notes: string): string | null {
  if (isBlank(notes)) return requiredMessage('Remarks');
  return null;
}
