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

const INVENTORY_MODES = [
  { value: 'current', label: 'Current Stock' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'reserved', label: 'Reserved Items' },
  { value: 'issued', label: 'Issued Items' },
  { value: 'available', label: 'Available Items' },
  { value: 'by_project', label: 'Inventory by Project' },
  { value: 'by_system', label: 'Inventory by System' },
  { value: 'by_location', label: 'Inventory by Location' },
  { value: 'movements', label: 'Inventory Movements' },
  { value: 'valuation', label: 'Stock Valuation' },
  { value: 'lookup', label: 'Part / Serial Lookup' },
];

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
        columns: [
          'Name',
          'Type',
          'Part No.',
          'Serial',
          'Qty',
          'Location',
          'Status',
          'SKU',
        ],
        rows: (data.items || []).map((i) => [
          i.name,
          i.inventory_type || '—',
          i.part_number || '—',
          i.serial_number || '—',
          i.quantity ?? '—',
          i.location || '—',
          i.status_name || '—',
          i.sku || '—',
        ]),
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

          <ReportSection title="Inventory Items">
            <ReportTable
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'inventory_type', header: 'Type' },
                { key: 'part_number', header: 'Part No.' },
                { key: 'serial_number', header: 'Serial' },
                { key: 'quantity', header: 'Qty' },
                { key: 'location', header: 'Location' },
                { key: 'status_name', header: 'Status' },
                { key: 'sku', header: 'SKU' },
              ]}
              rows={(data.items || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
