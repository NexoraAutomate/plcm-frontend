'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import { reportsApi, type ExecutiveReportResponse } from '@/lib/api/reports';
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
import { DonutChartCard } from '@/components/dashboard/DonutChartCard';
import { BarChartCard } from '@/components/dashboard/BarChartCard';
import { AreaChartCard } from '@/components/dashboard/AreaChartCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function asChartPoints(
  items: unknown
): { name: string; value: number }[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      name: String(row.name ?? row.label ?? '—'),
      value: Number(row.value ?? 0),
    };
  });
}

export default function ExecutiveReportsPage() {
  const { user } = useAuth();
  const { projects, customers } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [customerId, setCustomerId] = useState('all');
  const [projectId, setProjectId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ExecutiveReportResponse | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const customerOptions = useMemo(
    () => (customers || []).map((c) => ({ value: String(c.id), label: c.name })),
    [customers]
  );
  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Executive-Report',
  });

  const filters = {
    customer_id: customerId !== 'all' ? Number(customerId) : undefined,
    project_id: projectId !== 'all' ? Number(projectId) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    search: search || undefined,
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await reportsApi.executive(filters);
      setReportUuid(newReportUuid());
      setData(res.data);
      toast.success('Executive report generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate executive report');
    } finally {
      setGenerating(false);
    }
  };

  const dashboard = data?.dashboard as Record<string, unknown> | undefined;
  const kpis = (dashboard?.kpis as Record<string, unknown>) || {};
  const metrics = Array.isArray(kpis.metrics) ? (kpis.metrics as Record<string, unknown>[]) : [];
  const projectsSection = (dashboard?.projects as Record<string, unknown>) || {};
  const maintenanceSection = (dashboard?.maintenance as Record<string, unknown>) || {};
  const reliabilitySection = (dashboard?.reliability as Record<string, unknown>) || {};
  const financial = data?.financial || {};

  const projectStatusData = asChartPoints(projectsSection.status_distribution);
  const maintenanceStatusData = asChartPoints(maintenanceSection.cases_by_status);
  const monthlyTrend = asChartPoints(maintenanceSection.monthly_trend);
  const faultDistData = asChartPoints(reliabilitySection.fault_type_distribution);

  const exportPdf = async () => {
    if (!data || !reportUuid) {
      toast.error('Generate a preview first');
      return;
    }
    setExporting(true);
    try {
      const now = new Date();
      const fileName = `executive-report-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'executive',
        reportTitle: 'Executive Reports',
        filters,
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const qr = await qrDataUrl(registered.report_uuid);
      exportTabularPdf({
        title: 'Executive Report',
        subtitle: 'Senior management summary',
        reportNumber: formatReportNumber(registered.report_uuid),
        generatedBy: user?.full_name || user?.username || 'User',
        generatedDate: formatReportDate(now),
        generatedTime: formatReportTime(now),
        softwareVersion: APP_VERSION,
        qrDataUrl: qr,
        orientation: 'portrait',
        columns: ['Metric', 'Value'],
        rows: [
          ...metrics.map((m) => [
            String(m.label ?? m.key ?? '—'),
            String(m.value ?? '—'),
          ]),
          ['Order Value', `${displayValue(financial.order_value)} ${displayValue(financial.currency)}`],
          ['Order Count', displayValue(financial.order_count)],
          ['Project Cost', displayValue(financial.project_cost)],
          ['Inventory Value', displayValue(financial.inventory_value)],
          ['Maintenance Cost', displayValue(financial.maintenance_cost)],
          ['Revenue', displayValue(financial.revenue)],
          ['Budget Utilization', displayValue(financial.budget_utilization)],
        ],
        summaryLines: [
          'Financial fields without schema support are shown as placeholders.',
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
          <h1 className="text-2xl font-semibold tracking-tight">Executive Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Senior management overview with KPIs, charts, and financial placeholders.
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
        customerId={customerId}
        onCustomerChange={setCustomerId}
        customers={customerOptions}
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projectOptions}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:hidden">
            {projectStatusData.length > 0 && (
              <DonutChartCard title="Project Status" data={projectStatusData} />
            )}
            {maintenanceStatusData.length > 0 && (
              <DonutChartCard title="Maintenance Status" data={maintenanceStatusData} />
            )}
            {monthlyTrend.length > 0 && (
              <AreaChartCard title="Trends" data={monthlyTrend} />
            )}
            {faultDistData.length > 0 && (
              <BarChartCard title="Fault Distribution" data={faultDistData} />
            )}
          </div>

          <ReportLayout
            ref={printRef}
            header={{ title: 'Executive Report', subtitle: 'Management Summary' }}
            metadata={{
              reportTitle: 'Executive Reports',
              reportNumber: formatReportNumber(reportUuid),
              generatedBy: user?.full_name || user?.username || 'User',
              generatedDate: formatReportDate(generatedAt),
              generatedTime: formatReportTime(generatedAt),
              softwareVersion: APP_VERSION,
              qrValue: reportUuid || undefined,
            }}
            footer={{ softwareVersion: APP_VERSION }}
          >
            <ReportSection title="Projects Summary">
              <ReportTable
                columns={[
                  { key: 'label', header: 'KPI' },
                  { key: 'value', header: 'Value' },
                ]}
                rows={metrics.map((m) => ({
                  label: String(m.label ?? m.key ?? '—'),
                  value: displayValue(m.value),
                }))}
              />
            </ReportSection>

            <ReportSection title="Financial Overview">
              <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: 'Order Value',
                    value: `${displayValue(financial.order_value)} ${displayValue(financial.currency)}`,
                  },
                  { label: 'Order Count', value: displayValue(financial.order_count) },
                  { label: 'Project Cost', value: displayValue(financial.project_cost) },
                  { label: 'Inventory Value', value: displayValue(financial.inventory_value) },
                  { label: 'Maintenance Cost', value: displayValue(financial.maintenance_cost) },
                  { label: 'Revenue', value: displayValue(financial.revenue) },
                  {
                    label: 'Budget Utilization',
                    value: displayValue(financial.budget_utilization),
                  },
                ].map((item) => (
                  <Card key={item.label} className="shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {data.placeholders?.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Placeholders (no schema support yet): {data.placeholders.join(', ')}
                </p>
              )}
            </ReportSection>

            <ReportSection title="Maintenance Summary">
              <ReportTable
                columns={[
                  { key: 'name', header: 'Status' },
                  { key: 'value', header: 'Count' },
                ]}
                rows={maintenanceStatusData as unknown as Record<string, unknown>[]}
              />
            </ReportSection>

            <ReportSection title="Inventory & Orders">
              <ReportTable
                columns={[
                  { key: 'label', header: 'Metric' },
                  { key: 'value', header: 'Value' },
                ]}
                rows={[
                  {
                    label: 'Orders (filtered)',
                    value: displayValue(financial.order_count),
                  },
                  {
                    label: 'Order Value',
                    value: `${displayValue(financial.order_value)} ${displayValue(financial.currency)}`,
                  },
                ]}
              />
            </ReportSection>
          </ReportLayout>
        </>
      )}
    </div>
  );
}
