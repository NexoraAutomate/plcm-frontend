'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import { reportsApi, type BuildHistoryDossier } from '@/lib/api/reports';
import {
  ReportFilterBar,
  ReportLayout,
  ReportPreviewToolbar,
  ReportSection,
  ReportTable,
  ReportTimeline,
} from '@/components/reporting';
import { BuildHistoryDocument } from '@/components/reporting/pdf/build-history-document';
import { qrDataUrl } from '@/components/reporting/ReportQRCode';
import {
  displayValue,
  downloadBlob,
  formatReportDate,
  formatReportNumber,
  formatReportTime,
  newReportUuid,
  registerGeneratedReport,
} from '@/components/reporting/report-utils';

function flattenHierarchy(nodes: BuildHistoryDossier['hierarchy'], depth = 0) {
  const rows: Record<string, unknown>[] = [];
  for (const n of nodes || []) {
    rows.push({
      entity: `${'— '.repeat(depth)}${n.entity_type}: ${n.name}`,
      part_number: n.part_number,
      serial_number: n.serial_number,
      current_status: n.current_status,
      previous_status: n.previous_status,
      installation_date: n.installation_date,
      configuration_item: n.configuration_item,
      created_date: n.created_date,
      description: n.description,
    });
    rows.push(...flattenHierarchy(n.children || [], depth + 1));
  }
  return rows;
}

export default function BuildHistoryReportPage() {
  const { user } = useAuth();
  const { projects } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [projectId, setProjectId] = useState('all');
  const [data, setData] = useState<BuildHistoryDossier | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const projectOptions = useMemo(
    () =>
      (projects || []).map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    [projects]
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Build-History-Dossier',
  });

  const generate = async () => {
    if (projectId === 'all') {
      toast.error('Select a project');
      return;
    }
    setGenerating(true);
    try {
      const res = await reportsApi.buildHistory(Number(projectId));
      const uuid = newReportUuid();
      setReportUuid(uuid);
      setData(res.data);
      toast.success('Build history dossier generated');
    } catch (e: unknown) {
      toast.error('Failed to generate build history dossier');
      console.error(e);
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
      const fileName = `build-history-${projectId}-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'build_history_dossier',
        reportTitle: 'Build History Dossier',
        filters: { project_id: Number(projectId) },
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const qr = await qrDataUrl(registered.report_uuid);
      const blob = await pdf(
        <BuildHistoryDocument
          data={data}
          meta={{
            reportTitle: 'Build History Dossier',
            reportNumber: formatReportNumber(registered.report_uuid),
            generatedBy: user?.full_name || user?.username || 'User',
            generatedDate: formatReportDate(now),
            generatedTime: formatReportTime(now),
            softwareVersion: APP_VERSION,
            qrDataUrl: qr,
          }}
        />
      ).toBlob();
      downloadBlob(blob, fileName);
      toast.success('PDF exported and registered');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const hierarchyRows = data ? flattenHierarchy(data.hierarchy) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Build History Dossier</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete manufacturing and configuration history for one project.
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
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projectOptions}
      />

      {data && (
        <ReportLayout
          ref={printRef}
          header={{
            title: 'Build History Dossier',
            subtitle: displayValue(data.project?.name),
          }}
          metadata={{
            reportTitle: 'Build History Dossier',
            reportNumber: formatReportNumber(reportUuid),
            generatedBy: user?.full_name || user?.username || 'User',
            generatedDate: formatReportDate(generatedAt),
            generatedTime: formatReportTime(generatedAt),
            softwareVersion: APP_VERSION,
            qrValue: reportUuid || undefined,
          }}
          footer={{ softwareVersion: APP_VERSION }}
        >
          <ReportSection title="Project Information">
            <ReportTable
              columns={[
                { key: 'label', header: 'Field' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Project Name', value: displayValue(data.project?.name) },
                { label: 'Project Number', value: displayValue(data.project?.project_number) },
                { label: 'Description', value: displayValue(data.project?.description) },
                { label: 'Start Date', value: displayValue(data.project?.start_date) },
                { label: 'Completion Date', value: displayValue(data.project?.completion_date) },
                { label: 'Status', value: displayValue(data.project?.status) },
                { label: 'Project Manager', value: displayValue(data.project?.project_manager) },
              ]}
            />
          </ReportSection>

          <ReportSection title="Customer Information">
            <ReportTable
              columns={[
                { key: 'label', header: 'Field' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Customer Name', value: displayValue(data.customer?.name) },
                { label: 'Address', value: displayValue(data.customer?.address) },
                { label: 'Contact Person', value: displayValue(data.customer?.contact_person) },
                { label: 'Country', value: displayValue(data.customer?.country) },
                { label: 'Phone', value: displayValue(data.customer?.phone) },
                { label: 'Email', value: displayValue(data.customer?.email) },
              ]}
            />
          </ReportSection>

          <ReportSection title="Order Information">
            <ReportTable
              columns={[
                { key: 'label', header: 'Field' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Order Number', value: displayValue(data.order?.order_number) },
                { label: 'Order Date', value: displayValue(data.order?.order_date) },
                { label: 'Delivery Date', value: displayValue(data.order?.delivery_date) },
                { label: 'Status', value: displayValue(data.order?.status) },
                { label: 'Quantity', value: displayValue(data.order?.quantity) },
                { label: 'Remarks', value: displayValue(data.order?.remarks) },
              ]}
            />
          </ReportSection>

          <ReportSection title="Product Configuration">
            <ReportTable
              columns={[
                { key: 'entity', header: 'Entity' },
                { key: 'part_number', header: 'Part No.' },
                { key: 'serial_number', header: 'Serial' },
                { key: 'current_status', header: 'Status' },
                { key: 'previous_status', header: 'Previous' },
                { key: 'installation_date', header: 'Installed' },
                { key: 'configuration_item', header: 'CI' },
              ]}
              rows={hierarchyRows}
            />
          </ReportSection>

          <ReportSection title="Configuration History">
            <ReportTable
              columns={[
                { key: 'change_date', header: 'Date' },
                { key: 'resolution_type', header: 'Type' },
                { key: 'old_part_number', header: 'Old PN' },
                { key: 'new_part_number', header: 'New PN' },
                { key: 'performed_by', header: 'By' },
                { key: 'reason', header: 'Reason' },
              ]}
              rows={(data.configuration_history || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Build Timeline">
            <ReportTimeline events={data.timeline || []} />
          </ReportSection>

          <ReportSection title="Attachments">
            <ReportTable
              columns={[
                { key: 'file_name', header: 'File' },
                { key: 'attachment_type', header: 'Type' },
                { key: 'uploaded_at', header: 'Uploaded' },
              ]}
              rows={(data.attachments || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Signatures">
            <ReportTable
              columns={[
                { key: 'role', header: 'Role' },
                { key: 'name', header: 'Name' },
              ]}
              rows={[
                { role: 'Prepared By', name: displayValue(data.signatures?.prepared_by) },
                { role: 'Reviewed By', name: displayValue(data.signatures?.reviewed_by) },
                { role: 'Approved By', name: displayValue(data.signatures?.approved_by) },
              ]}
            />
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
