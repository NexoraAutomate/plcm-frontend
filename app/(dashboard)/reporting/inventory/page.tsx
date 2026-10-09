'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { useAppDefinitions } from '@/lib/app-definitions-context';
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
import { CascadingLocationSelects } from '@/components/inventory/cascading-location-selects';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import {
  useColumnVisibility,
  type ColumnVisibilityDef,
} from '@/hooks/use-column-visibility';
import { workflowStatusLabel } from '@/lib/workflow-status';

function displayInventoryStatus(value?: string | null) {
  if (!value) return '—';
  return workflowStatusLabel(value);
}

/** Significant modes only — stubs/duplicates removed. */
const INVENTORY_MODES = [
  { value: 'current', label: 'Current Stock' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'available', label: 'Available Items' },
  { value: 'issued', label: 'Open Issuances' },
  { value: 'movements', label: 'Issuance Movements' },
];

const ISSUANCE_MODES = new Set(['issued', 'movements']);

const STOCK_COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'name', label: 'Name', alwaysVisible: true },
  { id: 'inventory_type', label: 'Type' },
  { id: 'quantity', label: 'Qty' },
  { id: 'available_quantity', label: 'Available' },
  { id: 'location', label: 'Location' },
  { id: 'status_name', label: 'Status' },
  { id: 'sku', label: 'SKU' },
];

const ISSUANCE_COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'name', label: 'Name', alwaysVisible: true },
  { id: 'quantity', label: 'Qty' },
  { id: 'issued_to_name', label: 'Whom' },
  { id: 'issued_by_name', label: 'Issued By' },
  { id: 'issued_at', label: 'When' },
  { id: 'entity_detail', label: 'Entity' },
  { id: 'issuance_status', label: 'Status' },
];

/** Mode-specific default visibility (others still available via Columns). */
const MODE_DEFAULT_HIDDEN: Record<string, string[]> = {
  low: ['sku'],
  out: ['available_quantity', 'sku'],
  available: ['sku'],
  issued: [],
  movements: [],
  current: [],
};

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

function defsForMode(mode: string): ColumnVisibilityDef[] {
  const base = ISSUANCE_MODES.has(mode) ? ISSUANCE_COLUMN_DEFS : STOCK_COLUMN_DEFS;
  const hidden = new Set(MODE_DEFAULT_HIDDEN[mode] || []);
  return base.map((col) =>
    hidden.has(col.id) ? { ...col, defaultVisible: false } : col
  );
}

export default function InventoryReportsPage() {
  const { user } = useAuth();
  const { projects } = useDataStore();
  const { definitions } = useAppDefinitions();
  const printRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState('current');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [locationRoom, setLocationRoom] = useState('');
  const [locationCabinet, setLocationCabinet] = useState('');
  const [locationRack, setLocationRack] = useState('');
  const [projectId, setProjectId] = useState('all');
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const columnDefs = useMemo(() => defsForMode(mode), [mode]);
  const tableId = `inventory-report:${mode}`;
  const { visibleIds, isVisible, toggleColumn, resetColumns, visibleColumns } =
    useColumnVisibility(tableId, columnDefs);

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

  const isIssuanceMode = ISSUANCE_MODES.has(mode);

  const previewRows = useMemo(() => {
    if (!data) return [] as Record<string, unknown>[];
    if (isIssuanceMode) {
      return (data.items || []).map((i) => ({
        ...i,
        entity_detail: entityDetail(i),
        issued_at: i.issued_at ? formatReportDate(new Date(i.issued_at)) : '—',
        issuance_status: displayInventoryStatus(i.issuance_status || i.status_name),
      }));
    }
    return (data.items || []).map((i) => ({
      ...i,
      status_name: displayInventoryStatus(i.status_name),
    }));
  }, [data, isIssuanceMode]);

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
      const headers = visibleColumns.map((c) => c.label);
      const rows = previewRows.map((row) =>
        visibleColumns.map((c) => {
          const v = (row as Record<string, unknown>)[c.id];
          if (v == null || v === '') return '—';
          return String(v);
        })
      );
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
        columns: headers,
        rows,
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
            Stock levels, open issuances, and movement history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnVisibilityMenu
            columns={columnDefs}
            visibleIds={visibleIds}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
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
          <div className="sm:col-span-2">
            <CascadingLocationSelects
              tree={definitions.inventory_location_tree}
              value={{
                location_room: locationRoom,
                location_cabinet: locationCabinet,
                location_rack: locationRack,
              }}
              onChange={(next) => {
                setLocationRoom(next.location_room);
                setLocationCabinet(next.location_cabinet);
                setLocationRack(next.location_rack);
                setLocation(next.location);
              }}
            />
          </div>
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
                {
                  label: 'Mode',
                  value:
                    INVENTORY_MODES.find((m) => m.value === mode)?.label ||
                    displayValue(data.mode),
                },
                { label: 'Total Items', value: displayValue(data.summary?.total_items) },
                { label: 'Total Quantity', value: displayValue(data.summary?.total_quantity) },
                ...(location
                  ? [{ label: 'Location filter', value: location }]
                  : []),
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

          <ReportSection title={isIssuanceMode ? 'Issuance Ledger' : 'Inventory Items'}>
            <ReportTable
              columns={columnDefs
                .filter((c) => isVisible(c.id))
                .map((c) => ({ key: c.id, header: c.label }))}
              rows={previewRows}
            />
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
