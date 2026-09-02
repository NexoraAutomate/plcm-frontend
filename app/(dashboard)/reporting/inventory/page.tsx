'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import { reportsApi, type InventoryReportResponse } from '@/lib/api/reports';
import {
  ReportFilterBar,
  ReportLayout,
  ReportPreviewToolbar,
  ReportSection,
  ReportTable,
} from '@/components/reporting';
import { exportTabularPdf } from '@/components/reporting/exporters/export-tabular-pdf';
import { qrDataUrl } from '@/components/reporting/ReportQRCode';
import {
  displayValue,
  formatReportDate,
  formatReportNumber,
  formatReportTime,
  newReportUuid,
  registerGeneratedReport,
} from '@/components/reporting/report-utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { workflowStatusLabel } from '@/lib/workflow-status';

function displayInventoryStatus(value?: string | null) {
  if (!value) return '—';
  return workflowStatusLabel(value);
}

const INVENTORY_MODES = [
  { value: 'current', label: 'Current Stock' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'reserved', label: 'Reserved / Issued (open)' },
  { value: 'issued', label: 'Issued Items (open)' },
  { value: 'available', label: 'Available Items' },
  { value: 'by_project', label: 'Inventory by Project' },
  { value: 'by_system', label: 'Inventory by System' },
  { value: 'by_location', label: 'Inventory by Location' },
  { value: 'movements', label: 'Issuance Movements' },
  { value: 'valuation', label: 'Stock Valuation' },
  { value: 'lookup', label: 'Part / Serial Lookup' },
];

const ISSUANCE_MODES = new Set(['issued', 'reserved', 'movements']);

function entityDetail(item: {
  configuration_item?: string | null;
  installed_entity_type?: string | null;
  installed_entity_id?: number | null;
  target_entity_type?: string | null;
  target_entity_id?: number | null;
}) {
  if (item.configuration_item) return item.configuration_item;
  if (item.installed_entity_type && item.installed_entity_id != null) {
    return `${item.installed_entity_type} #${item.installed_entity_id}`;
  }
  if (item.target_entity_type && item.target_entity_id != null) {
    return `${item.target_entity_type} #${item.target_entity_id}`;
  }
  return '—';
}

export default function InventoryReportsPage() {
  const { user } = useAuth();
  const { projects } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState('current');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [projectId, setProjectId] = useState('all');
  const [partNumber, setPartNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Inventory-Report',
  });

  const filters = {
    mode,
    search: search || undefined,
    location: location || undefined,
    project_id: projectId !== 'all' ? Number(projectId) : undefined,
    part_number: partNumber || undefined,
    serial_number: serialNumber || undefined,
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await reportsApi.inventory(filters);
      setReportUuid(newReportUuid());
      setData(res.data);
      toast.success('Inventory report generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate inventory report');
    } finally {
      setGenerating(false);
    }
  };

  const exportPdf = async () => {
    if (!data || !reportUuid) {
      toast.error('Generate a preview first');
      return;
    }
    setExporting(true);
    try {
      const now = new Date();
      const fileName = `inventory-${mode}-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'inventory',
        reportTitle: `Inventory Report — ${mode}`,
        filters,
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const isIssuanceMode = ISSUANCE_MODES.has(mode);
      const qr = await qrDataUrl(registered.report_uuid);
      exportTabularPdf({
        title: 'Inventory Report',
        subtitle: INVENTORY_MODES.find((m) => m.value === mode)?.label || mode,
        reportNumber: formatReportNumber(registered.report_uuid),
        generatedBy: user?.full_name || user?.username || 'User',
        generatedDate: formatReportDate(now),
        generatedTime: formatReportTime(now),
        softwareVersion: APP_VERSION,
        qrDataUrl: qr,
        orientation: 'landscape',
        columns: isIssuanceMode
          ? [
              'Name',
              'Part No.',
              'Serial',
              'Qty',
              'Whom',
              'Issued By',
              'When',
              'Entity',
              'Status',
            ]
          : [
              'Name',
              'Type',
              'Part No.',
              'Serial',
              'Qty',
              'Available',
              'Location',
              'Status',
              'SKU',
            ],
        rows: (data.items || []).map((i) =>
          isIssuanceMode
            ? [
                i.name,
                i.part_number || '—',
                i.serial_number || '—',
                i.quantity ?? '—',
                i.issued_to_name || '—',
                i.issued_by_name || '—',
                i.issued_at ? formatReportDate(new Date(i.issued_at)) : '—',
                entityDetail(i),
                i.issuance_status || i.status_name
                  ? displayInventoryStatus(i.issuance_status || i.status_name)
                  : '—',
              ]
            : [
                i.name,
                i.inventory_type || '—',
                i.part_number || '—',
                i.serial_number || '—',
                i.quantity ?? '—',
                i.available_quantity ?? '—',
                i.location || '—',
                displayInventoryStatus(i.status_name),
                i.sku || '—',
              ]
        ),
        summaryLines: [
          `Total items: ${displayValue(data.summary?.total_items)}`,
          `Total quantity: ${displayValue(data.summary?.total_quantity)}`,
        ],
        placeholders: data.placeholders,
        fileName,
      });
      toast.success('PDF exported and registered');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock levels, lookups, and inventory distribution.
          </p>
        </div>
        <ReportPreviewToolbar
          onGenerate={generate}
          onPrint={() => handlePrint()}
          onExportPdf={exportPdf}
          generating={generating}
          exporting={exporting}
          disableExport={!data}
          disablePrint={!data}
        />
      </div>

      <ReportFilterBar
        search={search}
        onSearchChange={setSearch}
        mode={mode}
        onModeChange={setMode}
        modes={INVENTORY_MODES}
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projectOptions}
        extra={
          <>
            <div className="space-y-1.5">
              <Label htmlFor="inv-location">Location</Label>
              <Input
                id="inv-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-pn">Part Number</Label>
              <Input
                id="inv-pn"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="Part number"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-sn">Serial Number</Label>
              <Input
                id="inv-sn"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Serial number"
              />
            </div>
          </>
        }
      />

      {data && (
        <ReportLayout
          ref={printRef}
          orientation="landscape"
          header={{
            title: 'Inventory Report',
            subtitle: INVENTORY_MODES.find((m) => m.value === mode)?.label,
          }}
          metadata={{
            reportTitle: 'Inventory Report',
            reportNumber: formatReportNumber(reportUuid),
            generatedBy: user?.full_name || user?.username || 'User',
            generatedDate: formatReportDate(generatedAt),
            generatedTime: formatReportTime(generatedAt),
            softwareVersion: APP_VERSION,
            qrValue: reportUuid || undefined,
          }}
          footer={{ softwareVersion: APP_VERSION }}
        >
          <ReportSection title="Summary">
            <ReportTable
              columns={[
                { key: 'label', header: 'Metric' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Mode', value: displayValue(data.mode) },
                { label: 'Total Items', value: displayValue(data.summary?.total_items) },
                { label: 'Total Quantity', value: displayValue(data.summary?.total_quantity) },
              ]}
            />
            {data.placeholders?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {data.placeholders.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </ReportSection>

          <ReportSection title={ISSUANCE_MODES.has(mode) ? 'Issuance Ledger' : 'Inventory Items'}>
            <ReportTable
              columns={
                ISSUANCE_MODES.has(mode)
                  ? [
                      { key: 'name', header: 'Name' },
                      { key: 'part_number', header: 'Part No.' },
                      { key: 'serial_number', header: 'Serial' },
                      { key: 'quantity', header: 'Qty' },
                      { key: 'issued_to_name', header: 'Whom' },
                      { key: 'issued_by_name', header: 'Issued By' },
                      { key: 'issued_at', header: 'When' },
                      { key: 'entity_detail', header: 'Entity' },
                      { key: 'issuance_status', header: 'Status' },
                    ]
                  : [
                      { key: 'name', header: 'Name' },
                      { key: 'inventory_type', header: 'Type' },
                      { key: 'part_number', header: 'Part No.' },
                      { key: 'serial_number', header: 'Serial' },
                      { key: 'quantity', header: 'Qty' },
                      { key: 'available_quantity', header: 'Available' },
                      { key: 'location', header: 'Location' },
                      { key: 'status_name', header: 'Status' },
                      { key: 'sku', header: 'SKU' },
                    ]
              }
              rows={
                (ISSUANCE_MODES.has(mode)
                  ? (data.items || []).map((i) => ({
                      ...i,
                      entity_detail: entityDetail(i),
                      issued_at: i.issued_at
                        ? formatReportDate(new Date(i.issued_at))
                        : '—',
                      issuance_status: displayInventoryStatus(
                        i.issuance_status || i.status_name
                      ),
                    }))
                  : (data.items || []).map((i) => ({
                      ...i,
                      status_name: displayInventoryStatus(i.status_name),
                    }))) as unknown as Record<string, unknown>[]
              }
            />
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
