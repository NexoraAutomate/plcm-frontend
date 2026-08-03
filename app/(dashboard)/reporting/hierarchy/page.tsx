'use client';

import { useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { APP_VERSION } from '@/lib/app-version';
import {
  reportsApi,
  type HierarchyEntityNode,
  type HierarchyReportMode,
  type HierarchyReportResponse,
} from '@/lib/api/reports';
import {
  HIERARCHY_DOSSIER_OPTIONS,
  getHierarchyDossierLabel,
} from '@/lib/hierarchy-dossier-mode';
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
import { cn } from '@/lib/utils';
import { useAppDefinitions } from '@/lib/app-definitions-context';

const LEVEL_STYLES: Record<string, { heading: string; indent: string }> = {
  system: {
    heading: 'text-xl font-semibold tracking-tight',
    indent: 'pl-0',
  },
  subsystem: {
    heading: 'text-lg font-semibold',
    indent: 'pl-4 sm:pl-6',
  },
  module: {
    heading: 'text-base font-semibold',
    indent: 'pl-8 sm:pl-10',
  },
  unit: {
    heading: 'text-sm font-semibold',
    indent: 'pl-12 sm:pl-14',
  },
  component: {
    heading: 'text-sm font-medium',
    indent: 'pl-16 sm:pl-20',
  },
};

function entityLevelStyle(entityType: string) {
  return (
    LEVEL_STYLES[entityType] || {
      heading: 'text-sm font-medium',
      indent: 'pl-0',
    }
  );
}

function FieldLine({ label, value }: { label: string; value: unknown }) {
  const display = displayValue(value);
  if (display === '—') return null;
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="text-foreground">{display}</span>
    </div>
  );
}

function HierarchyNodeBlock({
  node,
  mode,
}: {
  node: HierarchyEntityNode;
  mode: HierarchyReportMode | string;
}) {
  const { entityLabel } = useAppDefinitions();
  const style = entityLevelStyle(node.entity_type);
  const showReplacement = mode === 'mmhd';
  const typeLabel = entityLabel(node.entity_type) || node.entity_type;

  return (
    <div className={cn('space-y-3', style.indent)}>
      <div className="space-y-1.5 border-b border-border/60 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {typeLabel}
          {showReplacement && node.was_replaced ? ' · Replaced' : ''}
        </p>
        <h3 className={style.heading}>{node.name}</h3>
        <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          <FieldLine label="Part Number" value={node.part_number} />
          <FieldLine label="Serial Number" value={node.serial_number} />
          <FieldLine label="Configuration Item" value={node.configuration_item} />
          <FieldLine label="Status" value={node.current_status} />
          <FieldLine label="Previous Status" value={node.previous_status} />
          <FieldLine label="Installation Date" value={node.installation_date} />
          <FieldLine label="Installed By" value={node.installed_by} />
          <FieldLine label="Created Date" value={node.created_date} />
          <FieldLine label="Modified Date" value={node.modified_date} />
          {node.entity_type === 'component' && (
            <FieldLine label="SKU" value={node.sku} />
          )}
          {showReplacement && (
            <>
              <FieldLine label="Replacement Sequence" value={node.replacement_sequence} />
              <FieldLine label="Replacement Date" value={node.replaced_at} />
            </>
          )}
          <FieldLine label="Description" value={node.description} />
        </div>
      </div>
      {(node.children || []).map((child) => (
        <HierarchyNodeBlock key={`${child.entity_type}-${child.id}`} node={child} mode={mode} />
      ))}
    </div>
  );
}

function flattenHierarchyRows(
  nodes: HierarchyEntityNode[],
  mode: HierarchyReportMode | string,
  depth = 0
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const n of nodes || []) {
    rows.push({
      level: `${'  '.repeat(depth)}${n.entity_type}`,
      name: n.name,
      part_number: n.part_number,
      serial_number: n.serial_number,
      configuration_item: n.configuration_item,
      status: n.current_status,
      installation_date: n.installation_date,
      installed_by: n.installed_by,
      created_date: n.created_date,
      description: n.description,
      ...(mode === 'mmhd'
        ? {
            replacement_sequence: n.replacement_sequence,
            replaced_at: n.replaced_at,
            was_replaced: n.was_replaced ? 'Yes' : 'No',
          }
        : {
            original_part_number: n.original_part_number,
            original_serial_number: n.original_serial_number,
          }),
    });
    rows.push(...flattenHierarchyRows(n.children || [], mode, depth + 1));
  }
  return rows;
}

export default function HierarchyReportsPage() {
  const { entityLabel } = useAppDefinitions();
  const L = {
    systems: entityLabel('system', true),
    subsystems: entityLabel('subsystem', true),
    modules: entityLabel('module', true),
    units: entityLabel('unit', true),
    components: entityLabel('component', true),
  };
  const { user } = useAuth();
  const { projects } = useDataStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<HierarchyReportMode>('bhd');
  const [projectId, setProjectId] = useState('all');
  const [data, setData] = useState<HierarchyReportResponse | null>(null);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const generatedAt = useMemo(() => new Date(), [data]);

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: String(p.id), label: p.name })),
    [projects]
  );

  const modeOptions = useMemo(
    () =>
      HIERARCHY_DOSSIER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    []
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Hierarchy-Report-${mode.toUpperCase()}`,
  });

  const generate = async () => {
    if (projectId === 'all') {
      toast.error('Select a project');
      return;
    }
    setGenerating(true);
    try {
      const res = await reportsApi.hierarchy(Number(projectId), mode);
      setReportUuid(newReportUuid());
      setData(res.data);
      toast.success('Hierarchy report generated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate hierarchy report');
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
      const dossierLabel = getHierarchyDossierLabel(mode);
      const fileName = `hierarchy-${mode}-${projectId}-${reportUuid.slice(0, 8)}.pdf`;
      const registered = await registerGeneratedReport({
        reportType: 'hierarchy',
        reportTitle: `Hierarchy Report — ${dossierLabel}`,
        filters: { project_id: Number(projectId), mode },
        fileName,
        payloadForChecksum: data,
        reportUuid,
      });
      const qr = await qrDataUrl(registered.report_uuid);
      const flatRows = flattenHierarchyRows(data.hierarchy || [], mode);
      const columns =
        mode === 'mmhd'
          ? [
              'Level',
              'Name',
              'Part No.',
              'Serial',
              'Status',
              'Installed',
              'Replaced',
              'Replacement Date',
            ]
          : [
              'Level',
              'Name',
              'Part No.',
              'Serial',
              'Original PN',
              'Original SN',
              'Status',
              'Installed',
            ];
      const rows = flatRows.map((row) =>
        mode === 'mmhd'
          ? [
              displayValue(row.level),
              displayValue(row.name),
              displayValue(row.part_number),
              displayValue(row.serial_number),
              displayValue(row.status),
              displayValue(row.installation_date),
              displayValue(row.was_replaced),
              displayValue(row.replaced_at),
            ]
          : [
              displayValue(row.level),
              displayValue(row.name),
              displayValue(row.part_number),
              displayValue(row.serial_number),
              displayValue(row.original_part_number),
              displayValue(row.original_serial_number),
              displayValue(row.status),
              displayValue(row.installation_date),
            ]
      );
      exportTabularPdf({
        title: 'Hierarchy Report',
        subtitle: `${dossierLabel} — ${displayValue(data.project?.name)}`,
        reportNumber: formatReportNumber(registered.report_uuid),
        generatedBy: user?.full_name || user?.username || 'User',
        generatedDate: formatReportDate(now),
        generatedTime: formatReportTime(now),
        softwareVersion: APP_VERSION,
        qrDataUrl: qr,
        columns,
        rows,
        summaryLines: [
          `${L.systems}: ${displayValue(data.summary?.systems)}`,
          `${L.subsystems}: ${displayValue(data.summary?.subsystems)}`,
          `${L.modules}: ${displayValue(data.summary?.modules)}`,
          `${L.units}: ${displayValue(data.summary?.units)}`,
          `${L.components}: ${displayValue(data.summary?.components)}`,
          ...(mode === 'mmhd'
            ? [`Replaced entities: ${displayValue(data.summary?.replaced_entities)}`]
            : []),
        ],
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

  const activeMode = (data?.mode as HierarchyReportMode | undefined) || mode;
  const dossierLabel = getHierarchyDossierLabel(activeMode);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hierarchy Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project hierarchy as BHD or MMHD, shown with nested headings.
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
        mode={mode}
        onModeChange={(value) => setMode(value as HierarchyReportMode)}
        modes={modeOptions}
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projectOptions}
      />

      {data && (
        <ReportLayout
          ref={printRef}
          header={{
            title: 'Hierarchy Report',
            subtitle: `${dossierLabel} — ${displayValue(data.project?.name)}`,
          }}
          metadata={{
            reportTitle: 'Hierarchy Report',
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
                {
                  label: 'Project Number',
                  value: displayValue(data.project?.project_number),
                },
                { label: 'Description', value: displayValue(data.project?.description) },
                { label: 'Start Date', value: displayValue(data.project?.start_date) },
                {
                  label: 'Completion Date',
                  value: displayValue(data.project?.completion_date),
                },
                { label: 'Status', value: displayValue(data.project?.status) },
                {
                  label: 'Project Manager',
                  value: displayValue(data.project?.project_manager),
                },
                { label: 'Report Mode', value: dossierLabel },
              ]}
            />
          </ReportSection>

          <ReportSection title="Summary">
            <ReportTable
              columns={[
                { key: 'label', header: 'Metric' },
                { key: 'value', header: 'Count' },
              ]}
              rows={[
                { label: L.systems, value: displayValue(data.summary?.systems) },
                { label: L.subsystems, value: displayValue(data.summary?.subsystems) },
                { label: L.modules, value: displayValue(data.summary?.modules) },
                { label: L.units, value: displayValue(data.summary?.units) },
                { label: L.components, value: displayValue(data.summary?.components) },
                {
                  label: 'Total Entities',
                  value: displayValue(data.summary?.total_entities),
                },
                ...(activeMode === 'mmhd'
                  ? [
                      {
                        label: 'Replaced Entities',
                        value: displayValue(data.summary?.replaced_entities),
                      },
                    ]
                  : []),
              ]}
            />
          </ReportSection>

          <ReportSection
            title="Product Hierarchy"
            description={
              activeMode === 'bhd'
                ? 'Original build identifiers (part/serial) where available.'
                : 'Current configuration with replacement metadata.'
            }
          >
            {(data.hierarchy || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hierarchy entities found for this project.
              </p>
            ) : (
              <div className="space-y-6">
                {data.hierarchy.map((node) => (
                  <HierarchyNodeBlock
                    key={`${node.entity_type}-${node.id}`}
                    node={node}
                    mode={activeMode}
                  />
                ))}
              </div>
            )}
          </ReportSection>
        </ReportLayout>
      )}
    </div>
  );
}
