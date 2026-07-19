import { APP_VERSION } from '@/lib/app-version';
import {
  reportsApi,
  type ReportRegisterResponse,
  type ReportType,
} from '@/lib/api/reports';

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function formatReportDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatReportTime(d = new Date()) {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function registerGeneratedReport(opts: {
  reportType: ReportType;
  reportTitle: string;
  filters?: Record<string, unknown>;
  fileName?: string;
  payloadForChecksum?: unknown;
  reportUuid?: string;
}): Promise<ReportRegisterResponse> {
  const checksum = opts.payloadForChecksum
    ? await sha256Hex(JSON.stringify(opts.payloadForChecksum))
    : undefined;

  const res = await reportsApi.register({
    report_type: opts.reportType,
    report_title: opts.reportTitle,
    filters: opts.filters ?? null,
    file_name: opts.fileName ?? null,
    checksum: checksum ?? null,
    software_version: APP_VERSION,
    report_uuid: opts.reportUuid ?? null,
  });
  return res.data;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function newReportUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
