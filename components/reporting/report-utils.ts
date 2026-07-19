import { APP_VERSION } from '@/lib/app-version';
import {
  reportsApi,
  type ReportRegisterResponse,
  type ReportType,
} from '@/lib/api/reports';

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/;

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format any report field for display; ISO datetimes become YYYY-MM-DD. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateOnly(value);
  }
  if (typeof value === 'string') {
    const match = value.trim().match(ISO_DATE_PREFIX);
    if (match) return match[1];
  }
  return String(value);
}

/** Short professional report number; full UUID stays for verification QR. */
export function formatReportNumber(reportUuid?: string | null): string {
  if (!reportUuid) return '—';
  const compact = reportUuid.replace(/-/g, '').slice(0, 8).toUpperCase();
  return compact ? `RPT-${compact}` : '—';
}

export function formatReportDate(d = new Date()) {
  if (Number.isNaN(d.getTime())) return '—';
  return toDateOnly(d);
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
