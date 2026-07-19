'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import { reportsApi, type MaintenanceSummaryResponse } from '@/lib/api/reports';
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

const CASE_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'under_inspection', label: 'Under Inspection' },
  { value: 'under_repair', label: 'Under Repair' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function MaintenanceReportsPage() {
  const { user } = useAuth();
  const { projects } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [projectId, setProjectId] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<MaintenanceSummaryResponse | null>(null);
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
    documentTitle: 'Maintenance-Report',
  });

  const filters = {
    project_id: projectId !== 'all' ? Number(projectId) : undefined,
    status: status !== 'all' ? status : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search || undefined,
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await reportsApi.maintenanceSummary(filters);
      setReportUuid(newReportUuid());
      setData(res.data);
      toast.success('Maintenance report generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate maintenance report');
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
      const fileName = `maintenance-report-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'maintenance',
        reportTitle: 'Maintenance Reports',
        filters,
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const qr = await qrDataUrl(registered.report_uuid);
      exportTabularPdf({
        title: 'Maintenance Reports',
        subtitle: 'Case summary, aging, workload, and trends',
        reportNumber: formatReportNumber(registered.report_uuid),
        generatedBy: user?.full_name || user?.username || 'User',
        generatedDate: formatReportDate(now),
        generatedTime: formatReportTime(now),
        softwareVersion: APP_VERSION,
        qrDataUrl: qr,
        orientation: 'landscape',
        columns: [
          'Case No.',
          'Status',
          'Project',
          'Engineer',
          'Opened',
          'Age (days)',
          'Description',
        ],
        rows: (data.cases || []).map((c) => [
          displayValue(c.case_number),
          displayValue(c.status),
          displayValue(c.project_name),
          displayValue(c.engineer),
          displayValue(c.reported_at),
          displayValue(c.age_days),
          displayValue(c.description),
        ]),
        summaryLines: [
          `Open: ${displayValue(data.summary?.open_cases)}`,
          `Closed: ${displayValue(data.summary?.closed_cases)}`,
          `Under Inspection: ${displayValue(data.summary?.under_inspection)}`,
          `Under Repair: ${displayValue(data.summary?.under_repair)}`,
          `Overdue: ${displayValue(data.summary?.overdue_cases)}`,
          `MTTR (hours): ${displayValue(data.mttr_hours)}`,
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
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Case status, aging, engineer workload, trends, and fault distribution.
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
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projectOptions}
        status={status}
        onStatusChange={setStatus}
        statuses={CASE_STATUSES}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {data && (
        <ReportLayout
          ref={printRef}
          orientation="landscape"
          header={{ title: 'Maintenance Reports' }}
          metadata={{
            reportTitle: 'Maintenance Reports',
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
                { label: 'Total Cases', value: displayValue(data.summary?.total_cases) },
                { label: 'Open Cases', value: displayValue(data.summary?.open_cases) },
                { label: 'Closed Cases', value: displayValue(data.summary?.closed_cases) },
                { label: 'Under Inspection', value: displayValue(data.summary?.under_inspection) },
                { label: 'Under Repair', value: displayValue(data.summary?.under_repair) },
                { label: 'Waiting Parts', value: displayValue(data.summary?.waiting_parts) },
                { label: 'Overdue Cases', value: displayValue(data.summary?.overdue_cases) },
                { label: 'MTTR (hours)', value: displayValue(data.mttr_hours) },
              ]}
            />
          </ReportSection>

          <ReportSection title="By Status">
            <ReportTable
              columns={[
                { key: 'name', header: 'Status' },
                { key: 'value', header: 'Count' },
              ]}
              rows={(data.by_status || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Fault Categories">
            <ReportTable
              columns={[
                { key: 'name', header: 'Fault Type' },
                { key: 'value', header: 'Count' },
              ]}
              rows={(data.by_fault_type || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Engineer Workload">
            <ReportTable
              columns={[
                { key: 'name', header: 'Engineer' },
                { key: 'value', header: 'Cases' },
              ]}
              rows={(data.engineer_workload || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Case Aging">
            <ReportTable
              columns={[
                { key: 'name', header: 'Bucket' },
                { key: 'value', header: 'Count' },
              ]}
              rows={(data.aging || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Monthly Trends">
            <ReportTable
              columns={[
                { key: 'name', header: 'Month' },
                { key: 'value', header: 'Cases' },
              ]}
              rows={(data.monthly_trends || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Cases">
            <ReportTable
              columns={[
                { key: 'case_number', header: 'Case No.' },
                { key: 'status', header: 'Status' },
                { key: 'project_name', header: 'Project' },
                { key: 'engineer', header: 'Engineer' },
                { key: 'reported_at', header: 'Opened' },
                { key: 'age_days', header: 'Age (days)' },
              ]}
              rows={(data.cases || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
