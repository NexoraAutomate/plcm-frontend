export const ATTACHMENT_TYPES = [
  { value: 'test_report', label: 'Test Report' },
  { value: 'datasheet', label: 'Datasheet' },
  { value: 'manual', label: 'Manual' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'photo', label: 'Photo' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'installation_guide', label: 'Installation Guide' },
  { value: 'other', label: 'Other' },
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]['value'];

export function attachmentTypeLabel(value: string | undefined): string {
  return ATTACHMENT_TYPES.find((item) => item.value === value)?.label ?? 'Other';
}

export function attachmentDisplayTitle(attachment: {
  description?: string | null;
  attachment_type?: string;
  file_name: string;
}): string {
  if (attachment.description?.trim()) {
    return attachment.description.trim();
  }
  if (attachment.attachment_type) {
    return attachmentTypeLabel(attachment.attachment_type);
  }
  return attachment.file_name;
}
