import type { PermissionCode } from '@/lib/permission-codes';
import { P } from '@/lib/permission-codes';

export type ReportExporter = 'react-pdf' | 'jspdf';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  href: string;
  permission: PermissionCode;
  exporter: ReportExporter;
  reportType:
    | 'build_history_dossier'
    | 'maintenance_history_dossier'
    | 'inventory'
    | 'maintenance'
    | 'executive';
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: 'build-history',
    title: 'Build History Dossier',
    description: 'Complete manufacturing and configuration history for a project.',
    href: '/reporting/build-history',
    permission: P.generate_build_dossier,
    exporter: 'react-pdf',
    reportType: 'build_history_dossier',
  },
  {
    id: 'maintenance-history',
    title: 'Maintenance History Dossier',
    description: 'Full maintenance case dossier with actions, repairs, and deliveries.',
    href: '/reporting/maintenance-history',
    permission: P.generate_maintenance_dossier,
    exporter: 'react-pdf',
    reportType: 'maintenance_history_dossier',
  },
  {
    id: 'inventory',
    title: 'Inventory Reports',
    description: 'Stock levels, lookups, and inventory distribution reports.',
    href: '/reporting/inventory',
    permission: P.view_reports,
    exporter: 'jspdf',
    reportType: 'inventory',
  },
  {
    id: 'maintenance',
    title: 'Maintenance Reports',
    description: 'Case status, aging, workload, trends, and fault distribution.',
    href: '/reporting/maintenance',
    permission: P.view_reports,
    exporter: 'jspdf',
    reportType: 'maintenance',
  },
  {
    id: 'executive',
    title: 'Executive Reports',
    description: 'Senior management summary with KPIs, charts, and financial overview.',
    href: '/reporting/executive',
    permission: P.view_executive_dashboard,
    exporter: 'jspdf',
    reportType: 'executive',
  },
];
