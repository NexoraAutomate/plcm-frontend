import { resolveEntityTypeLabel } from '@/lib/app-definitions';
import type {
  Component,
  Customer,
  MaintenanceCase,
  Module,
  Order,
  Project,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';

export type GlobalSearchGroup = string;

export interface GlobalSearchResult {
  id: number;
  group: GlobalSearchGroup;
  title: string;
  subtitle?: string;
  href: string;
}

export interface GlobalSearchData {
  customers: Customer[];
  orders: Order[];
  projects: Project[];
  maintenanceCases: MaintenanceCase[];
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}

export const GLOBAL_SEARCH_MIN_LENGTH = 2;

function matchesQuery(text: string | null | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query);
}

function pushResult(
  results: GlobalSearchResult[],
  seen: Set<string>,
  result: GlobalSearchResult
) {
  const key = `${result.group}:${result.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push(result);
}

export function searchGlobal(query: string, data: GlobalSearchData): GlobalSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < GLOBAL_SEARCH_MIN_LENGTH) return [];

  const results: GlobalSearchResult[] = [];
  const seen = new Set<string>();

  for (const customer of data.customers) {
    if (
      matchesQuery(customer.name, normalized) ||
      matchesQuery(customer.customer_code, normalized) ||
      matchesQuery(customer.email, normalized) ||
      matchesQuery(customer.phone, normalized) ||
      matchesQuery(customer.primary_contact_name, normalized)
    ) {
      pushResult(results, seen, {
        id: customer.id,
        group: 'Customers',
        title: customer.name,
        subtitle: customer.customer_code ?? customer.email ?? undefined,
        href: `/customers/${customer.id}`,
      });
    }
  }

  for (const order of data.orders) {
    if (
      matchesQuery(order.order_number, normalized) ||
      matchesQuery(order.title, normalized) ||
      matchesQuery(order.project_manager, normalized)
    ) {
      pushResult(results, seen, {
        id: order.id,
        group: 'Orders',
        title: order.order_number,
        subtitle: order.title,
        href: `/orders/${order.id}`,
      });
    }
  }

  for (const project of data.projects) {
    if (matchesQuery(project.name, normalized) || matchesQuery(project.description, normalized)) {
      pushResult(results, seen, {
        id: project.id,
        group: 'Projects',
        title: project.name,
        subtitle: project.status_name ?? undefined,
        href: `/projects/${project.id}`,
      });
    }
  }

  for (const maintenanceCase of data.maintenanceCases) {
    if (
      matchesQuery(maintenanceCase.case_number, normalized) ||
      matchesQuery(maintenanceCase.description, normalized)
    ) {
      pushResult(results, seen, {
        id: maintenanceCase.id,
        group: 'Maintenance Cases',
        title: maintenanceCase.case_number,
        subtitle: maintenanceCase.description,
        href: `/maintenance/cases/${maintenanceCase.id}`,
      });
    }
  }

  for (const system of data.systems) {
    if (
      matchesQuery(system.name, normalized) ||
      matchesQuery(system.part_number, normalized) ||
      matchesQuery(system.serial_number, normalized)
    ) {
      pushResult(results, seen, {
        id: system.id,
        group: resolveEntityTypeLabel('system', true),
        title: system.name,
        subtitle: system.part_number ?? system.serial_number ?? undefined,
        href: `/systems/${system.id}`,
      });
    }
  }

  for (const subsystem of data.subsystems) {
    if (
      matchesQuery(subsystem.name, normalized) ||
      matchesQuery(subsystem.part_number, normalized) ||
      matchesQuery(subsystem.serial_number, normalized)
    ) {
      pushResult(results, seen, {
        id: subsystem.id,
        group: resolveEntityTypeLabel('subsystem', true),
        title: subsystem.name,
        subtitle: subsystem.part_number ?? subsystem.serial_number ?? undefined,
        href: `/subsystems/${subsystem.id}`,
      });
    }
  }

  for (const module of data.modules) {
    if (
      matchesQuery(module.name, normalized) ||
      matchesQuery(module.part_number, normalized) ||
      matchesQuery(module.serial_number, normalized)
    ) {
      pushResult(results, seen, {
        id: module.id,
        group: resolveEntityTypeLabel('module', true),
        title: module.name,
        subtitle: module.part_number ?? module.serial_number ?? undefined,
        href: `/modules/${module.id}`,
      });
    }
  }

  for (const unit of data.units) {
    if (
      matchesQuery(unit.name, normalized) ||
      matchesQuery(unit.part_number, normalized) ||
      matchesQuery(unit.serial_number, normalized)
    ) {
      pushResult(results, seen, {
        id: unit.id,
        group: resolveEntityTypeLabel('unit', true),
        title: unit.name,
        subtitle: unit.part_number ?? unit.serial_number ?? undefined,
        href: `/units/${unit.id}`,
      });
    }
  }

  for (const component of data.components) {
    if (
      matchesQuery(component.name, normalized) ||
      matchesQuery(component.part_number, normalized) ||
      matchesQuery(component.serial_number, normalized)
    ) {
      pushResult(results, seen, {
        id: component.id,
        group: resolveEntityTypeLabel('component', true),
        title: component.name,
        subtitle: component.part_number ?? component.serial_number ?? undefined,
        href: `/components/${component.id}`,
      });
    }
  }

  return results.slice(0, 50);
}

export function getGlobalSearchGroupOrder(): GlobalSearchGroup[] {
  return [
    'Customers',
    'Orders',
    'Projects',
    'Maintenance Cases',
    resolveEntityTypeLabel('system', true),
    resolveEntityTypeLabel('subsystem', true),
    resolveEntityTypeLabel('module', true),
    resolveEntityTypeLabel('unit', true),
    resolveEntityTypeLabel('component', true),
  ];
}

/** @deprecated use getGlobalSearchGroupOrder() for live labels */
export const GLOBAL_SEARCH_GROUP_ORDER: GlobalSearchGroup[] = getGlobalSearchGroupOrder();

