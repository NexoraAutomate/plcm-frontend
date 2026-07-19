'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import { reportsApi, type MaintenanceHistoryDossier } from '@/lib/api/reports';
import {
  ReportFilterBar,
  ReportLayout,
  ReportPreviewToolbar,
  ReportSection,
  ReportTable,
  ReportTimeline,
} from '@/components/reporting';
import { MaintenanceHistoryDocument } from '@/components/reporting/pdf/maintenance-history-document';
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

export default function MaintenanceHistoryReportPage() {
  const { user } = useAuth();
  const { maintenanceCases } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [caseId, setCaseId] = useState('all');
  const [data, setData] = useState<MaintenanceHistoryDossier | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const caseOptions = useMemo(
    () =>
      (maintenanceCases || []).map((c) => ({
        value: String(c.id),
        label: `${c.case_number}${c.project_name ? ` — ${c.project_name}` : ''}`,
      })),
    [maintenanceCases]
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Maintenance-History-Dossier',
  });

  const generate = async () => {
    if (caseId === 'all') {
      toast.error('Select a maintenance case');
      return;
    }
    setGenerating(true);
    try {
      const res = await reportsApi.maintenanceHistory(Number(caseId));
      setReportUuid(newReportUuid());
      setData(res.data);
      toast.success('Maintenance history dossier generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate maintenance history dossier');
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
      const fileName = `maintenance-history-${caseId}-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'maintenance_history_dossier',
        reportTitle: 'Maintenance History Dossier',
        filters: { case_id: Number(caseId) },
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const qr = await qrDataUrl(registered.report_uuid);
      const blob = await pdf(
        <MaintenanceHistoryDocument
          data={data}
          meta={{
            reportTitle: 'Maintenance History Dossier',
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

  const actionRows =
    data?.faulty_entities?.flatMap((fe) =>
      (fe.actions || []).map((a) => ({
        entity: fe.entity_name,
        action_type: a.action_type,
        outcome: a.outcome,
        performed_by: a.performed_by,
        performed_at: a.performed_at,
        duration: a.duration,
        notes: a.notes,
      }))
    ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Maintenance History Dossier
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete maintenance case history with actions, repairs, and deliveries.
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
        caseId={caseId}
        onCaseChange={setCaseId}
        cases={caseOptions}
      />

      {data && (
        <ReportLayout
          ref={printRef}
          header={{
            title: 'Maintenance History Dossier',
            subtitle: displayValue(data.case?.maintenance_number),
          }}
          metadata={{
            reportTitle: 'Maintenance History Dossier',
            reportNumber: formatReportNumber(reportUuid),
            generatedBy: user?.full_name || user?.username || 'User',
            generatedDate: formatReportDate(generatedAt),
            generatedTime: formatReportTime(generatedAt),
            softwareVersion: APP_VERSION,
            qrValue: reportUuid || undefined,
          }}
          footer={{ softwareVersion: APP_VERSION }}
        >
          <ReportSection title="Case Information">
            <ReportTable
              columns={[
                { key: 'label', header: 'Field' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Maintenance Number', value: displayValue(data.case?.maintenance_number) },
                { label: 'Current Status', value: displayValue(data.case?.current_status) },
                { label: 'Priority', value: displayValue(data.case?.priority) },
                { label: 'Opened Date', value: displayValue(data.case?.opened_date) },
                { label: 'Closed Date', value: displayValue(data.case?.closed_date) },
                { label: 'Engineer', value: displayValue(data.case?.engineer) },
              ]}
            />
          </ReportSection>

          <ReportSection title="Fault Information">
            <ReportTable
              columns={[
                { key: 'label', header: 'Field' },
                { key: 'value', header: 'Value' },
              ]}
              rows={[
                { label: 'Fault Description', value: displayValue(data.fault?.fault_description) },
                { label: 'Fault Category', value: displayValue(data.fault?.fault_category) },
                { label: 'Fault Type', value: displayValue(data.fault?.fault_type) },
                { label: 'Root Cause', value: displayValue(data.fault?.root_cause) },
                { label: 'Failure Mode', value: displayValue(data.fault?.failure_mode) },
                { label: 'Severity', value: displayValue(data.fault?.severity) },
              ]}
            />
          </ReportSection>

          <ReportSection title="Faulty Entities">
            <ReportTable
              columns={[
                { key: 'entity_name', header: 'Entity' },
                { key: 'entity_type', header: 'Type' },
                { key: 'part_number', header: 'Part No.' },
                { key: 'serial_number', header: 'Serial' },
                { key: 'status', header: 'Status' },
                { key: 'resolution_type', header: 'Resolution' },
              ]}
              rows={(data.faulty_entities || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Maintenance Actions">
            <ReportTable
              columns={[
                { key: 'entity', header: 'Entity' },
                { key: 'action_type', header: 'Action' },
                { key: 'outcome', header: 'Outcome' },
                { key: 'performed_by', header: 'Engineer' },
                { key: 'performed_at', header: 'Date/Time' },
                { key: 'duration', header: 'Duration' },
                { key: 'notes', header: 'Remarks' },
              ]}
              rows={actionRows as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Replacement Information">
            <ReportTable
              columns={[
                { key: 'old_part_number', header: 'Old PN' },
                { key: 'old_serial_number', header: 'Old SN' },
                { key: 'new_part_number', header: 'New PN' },
                { key: 'new_serial_number', header: 'New SN' },
                { key: 'installation_date', header: 'Installed' },
                { key: 'reason', header: 'Reason' },
              ]}
              rows={(data.replacements || []) as unknown as Record<string, unknown>[]}
            />
          </ReportSection>

          <ReportSection title="Maintenance Timeline">
            <ReportTimeline events={data.timeline || []} />
          </ReportSection>

          <ReportSection title="Deliveries">
            <ReportTable
              columns={[
                { key: 'delivery_type', header: 'Type' },
                { key: 'status', header: 'Status' },
                { key: 'delivered_by', header: 'Delivered By' },
                { key: 'received_by', header: 'Received By' },
                { key: 'delivered_at', header: 'Delivered At' },
                { key: 'notes', header: 'Remarks' },
              ]}
              rows={(data.deliveries || []) as unknown as Record<string, unknown>[]}
            />
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
        </ReportLayout>
      )}
    </div>
  );
}
