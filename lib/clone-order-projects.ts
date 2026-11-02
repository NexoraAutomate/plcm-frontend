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

function toIsoDateOrUndefined(value?: string | null): string | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('T')) return trimmed.endsWith('Z') ? trimmed : `${trimmed}Z`;
  return `${trimmed.slice(0, 10)}T00:00:00Z`;
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
    const flightNo = parseFlightNumber(project.name);
    if (flightNo != null && counts.length >= flightNo) {
      return counts[flightNo - 1] ?? counts[0] ?? null;
    }
    return counts[0] ?? null;
  }
  return asPositiveInt(project.sdls_per_flight);
}

function normalizeConfigRow(
  count: number,
  fallbackConfigId: number,
  row?: number[] | null
): number[] {
  return Array.from({ length: count }, (_, index) => {
    const id = Number(row?.[index] || fallbackConfigId);
    return id > 0 ? id : fallbackConfigId;
  });
}

/** Always load full project detail so SDLS/config matrices are complete. */
async function hydrateProject(project: Project): Promise<Project> {
  try {
    const res = await api.projects.get(project.id);
    return { ...project, ...res.data };
  } catch {
    return project;
  }
}

/**
 * Rebuild one create-drafts-by-flight payload for a name-group of source projects
 * so repeated orders keep the same flight count, SDLS-per-flight, and configs.
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

  let sdlsCounts: number[] = [];
  let configMatrix: number[][] = [];

  // Case A: one multi-flight row already holds the full SDLS array.
  if (sorted.length === 1) {
    const only = sorted[0];
    const counts = resolveSdlsCounts(only);
    if (!counts || counts.length < 1) return null;
    sdlsCounts = counts;
    if (
      only.hierarchy_config_ids_by_flight &&
      only.hierarchy_config_ids_by_flight.length === counts.length
    ) {
      configMatrix = only.hierarchy_config_ids_by_flight.map((row, flightIndex) =>
        normalizeConfigRow(counts[flightIndex], hierarchyConfigId, row)
      );
    } else {
      configMatrix = counts.map((count) =>
        normalizeConfigRow(count, hierarchyConfigId, only.hierarchy_config_ids_by_flight?.[0])
      );
    }
  } else {
    // Case B: one DB row per flight (createDraftsByFlight shape).
    for (const project of sorted) {
      const count = projectSdlsForOneFlight(project);
      if (count == null) return null;
      sdlsCounts.push(count);
      const row =
        project.hierarchy_config_ids_by_flight?.[0] ??
        project.hierarchy_config_ids_by_flight?.find((entry) => Array.isArray(entry));
      configMatrix.push(
        normalizeConfigRow(
          count,
          Number(project.hierarchy_config_id || hierarchyConfigId),
          row
        )
      );
    }
  }

  if (sdlsCounts.length < 1 || configMatrix.length !== sdlsCounts.length) {
    return null;
  }

  return {
    name: repeatBaseName(primary.name),
    description: primary.description || null,
    start_date: toIsoDateOrUndefined(primary.start_date),
    end_date: toIsoDateOrUndefined(primary.end_date),
    owner_id: primary.owner_id || undefined,
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

/** Clone source-order projects as Drafts with the same create-draft flight specs. */
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
