const FLIGHT_NAME_SUFFIX = /^(.+?)\s-\sFlight\s+(\d+)$/;

/** Base project name shared by per-flight draft projects (e.g. "ABC" from "ABC - Flight 2"). */
export function getProjectGroupKey(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(FLIGHT_NAME_SUFFIX);
  return match ? match[1].trim() : trimmed;
}

export function parseFlightNumber(name: string): number | null {
  const match = name.trim().match(FLIGHT_NAME_SUFFIX);
  return match ? Number.parseInt(match[2], 10) : null;
}

export type ProjectNameGroup<T extends { name: string }> = {
  key: string;
  displayName: string;
  projects: T[];
};

export function groupProjectsByName<T extends { name: string }>(
  projects: T[]
): ProjectNameGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const project of projects) {
    const key = getProjectGroupKey(project.name);
    const list = map.get(key) ?? [];
    list.push(project);
    map.set(key, list);
  }

  const firstIndex = new Map<string, number>();
  projects.forEach((project, index) => {
    const key = getProjectGroupKey(project.name);
    if (!firstIndex.has(key)) firstIndex.set(key, index);
  });

  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => {
        const flightA = parseFlightNumber(a.name);
        const flightB = parseFlightNumber(b.name);
        if (flightA != null && flightB != null) return flightA - flightB;
        if (flightA != null) return 1;
        if (flightB != null) return -1;
        return a.name.localeCompare(b.name);
      });
      return { key, displayName: key, projects: sorted };
    })
    .sort((a, b) => (firstIndex.get(a.key) ?? 0) - (firstIndex.get(b.key) ?? 0));
}

/** Whether grouped mode should render a collapsible header instead of a flat row. */
export function shouldShowProjectGroup<T extends { name: string }>(
  group: ProjectNameGroup<T>
): boolean {
  if (group.projects.length > 1) return true;
  const only = group.projects[0];
  return only != null && parseFlightNumber(only.name) != null;
}
