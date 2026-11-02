import * as api from '@/lib/api';
import type { Project, ProjectDraftCreate } from '@/lib/models';
import {
  getProjectGroupKey,
  groupProjectsByName,
  parseFlightNumber,
} from '@/lib/project-name-grouping';

export type CloneOrderProjectsResult = {
  created: Project[];
  skipped: number;
  errors: string[];
};

function repeatBaseName(name: string): string {
  const base = getProjectGroupKey((name ?? '').trim() || 'Project');
  return base.toLowerCase().endsWith('(repeat)') ? base : `${base} (Repeat)`;
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

/** Prefer per-flight array; fall back to sdls_per_flight expanded by flight_count. */
function resolveSdlsCounts(project: Project): number[] | null {
  const explicitRaw = project.sdls_counts_by_flight;
  if (Array.isArray(explicitRaw) && explicitRaw.length > 0) {
    const counts = explicitRaw.map((count) => asPositiveInt(count));
    if (counts.every((count): count is number => count != null)) {
      return counts;
    }
  }

  const flightCount = asPositiveInt(project.flight_count) ?? 1;
  const perFlight = asPositiveInt(project.sdls_per_flight);
  if (perFlight != null) {
    return Array.from({ length: flightCount }, () => perFlight);
  }

  return null;
}

function projectSdlsForOneFlight(project: Project): number | null {
  const counts = resolveSdlsCounts(project);
  if (counts && counts.length > 0) {
    // Split-by-flight rows are usually [n]; multi-flight rows use the matching index.
    const flightNo = parseFlightNumber(project.name);
    if (flightNo != null && counts.length >= flightNo) {
      return counts[flightNo - 1] ?? counts[0] ?? null;
    }
    return counts[0] ?? null;
  }
  return asPositiveInt(project.sdls_per_flight);
}

async function hydrateProject(project: Project): Promise<Project> {
  const needsHydration =
    project.hierarchy_config_id == null ||
    !(project.product_type ?? '').trim() ||
    (resolveSdlsCounts(project) == null && asPositiveInt(project.sdls_per_flight) == null);

  if (!needsHydration) return project;

  try {
    const res = await api.projects.get(project.id);
    return { ...project, ...res.data };
  } catch {
    return project;
  }
}

/**
 * Rebuild one draft-create payload for a name-group of source projects
 * (same config + product type + ordered SDLS-per-flight list).
 */
export function buildGroupedDraftClonePayload(
  groupProjects: Project[],
  newOrderId: number
): ProjectDraftCreate | null {
  if (groupProjects.length === 0) return null;

  const sorted = [...groupProjects].sort((a, b) => {
    const flightA = parseFlightNumber(a.name);
    const flightB = parseFlightNumber(b.name);
    if (flightA != null && flightB != null) return flightA - flightB;
    if (flightA != null) return -1;
    if (flightB != null) return 1;
    return a.name.localeCompare(b.name);
  });

  const primary =
    sorted.find(
      (project) =>
        project.hierarchy_config_id != null &&
        project.hierarchy_config_id > 0 &&
        (project.product_type ?? '').trim()
    ) ?? sorted[0];

  const hierarchyConfigId = primary.hierarchy_config_id;
  const productType = (primary.product_type ?? '').trim();
  if (hierarchyConfigId == null || hierarchyConfigId <= 0 || !productType) {
    return null;
  }

  function defaultConfigRow(count: number, project: Project): number[] {
    const existing = project.hierarchy_config_ids_by_flight?.[0];
    return Array.from({ length: count }, (_, index) => {
      const id = Number(existing?.[index] || project.hierarchy_config_id || hierarchyConfigId);
      return id > 0 ? id : hierarchyConfigId;
    });
  }

  // Case A: one multi-flight row already holds the full SDLS array.
  if (sorted.length === 1) {
    const only = sorted[0];
    const counts = resolveSdlsCounts(only);
    if (!counts || counts.length < 1) return null;
    const configMatrix =
      only.hierarchy_config_ids_by_flight &&
      only.hierarchy_config_ids_by_flight.length === counts.length
        ? only.hierarchy_config_ids_by_flight.map((row, flightIndex) =>
            Array.from({ length: counts[flightIndex] }, (_, sdlsIndex) => {
              const id = Number(row?.[sdlsIndex] || hierarchyConfigId);
              return id > 0 ? id : hierarchyConfigId;
            })
          )
        : counts.map((count) => defaultConfigRow(count, only));
    return {
      name: repeatBaseName(only.name),
      description: only.description || null,
      order_id: newOrderId,
      hierarchy_config_id: hierarchyConfigId,
      product_type: productType,
      flight_count: counts.length,
      sdls_per_flight: Math.max(...counts),
      sdls_counts_by_flight: counts,
      hierarchy_config_ids_by_flight: configMatrix,
      is_existing_project: false,
    };
  }

  // Case B: one row per flight — rebuild SDLS list in flight order.
  const sdlsCounts: number[] = [];
  const configMatrix: number[][] = [];
  for (const project of sorted) {
    const count = projectSdlsForOneFlight(project);
    if (count == null) return null;
    sdlsCounts.push(count);
    configMatrix.push(defaultConfigRow(count, project));
  }

  return {
    name: repeatBaseName(primary.name),
    description: primary.description || null,
    order_id: newOrderId,
    hierarchy_config_id: hierarchyConfigId,
    product_type: productType,
    flight_count: sdlsCounts.length,
    sdls_per_flight: Math.max(...sdlsCounts),
    sdls_counts_by_flight: sdlsCounts,
    hierarchy_config_ids_by_flight: configMatrix,
    is_existing_project: false,
  };
}

/** Clone source-order projects as Drafts, preserving config + per-flight SDLS. */
export async function cloneOrderProjectsAsDrafts(
  sourceOrderId: number,
  newOrderId: number
): Promise<CloneOrderProjectsResult> {
  const { data: listed } = await api.orders.listProjects(sourceOrderId);
  const sourceProjects = await Promise.all((listed ?? []).map(hydrateProject));
  const groups = groupProjectsByName(sourceProjects);

  const created: Project[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const group of groups) {
    const payload = buildGroupedDraftClonePayload(group.projects, newOrderId);
    if (!payload) {
      skipped += group.projects.length;
      errors.push(
        `Skipped “${group.displayName}”: missing hierarchy configuration, product type, or SDLS-per-flight values.`
      );
      continue;
    }

    try {
      // Same path as New Draft Project: one draft row per flight with its own SDLS count.
      const res = await api.projects.createDraftsByFlight(payload);
      const projects = res.data.projects ?? [];
      created.push(...projects);
    } catch (error) {
      const detail =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      errors.push(
        typeof detail === 'string' && detail.trim()
          ? `${group.displayName}: ${detail}`
          : `Failed to clone draft projects for “${group.displayName}”`
      );
    }
  }

  return { created, skipped, errors };
}
