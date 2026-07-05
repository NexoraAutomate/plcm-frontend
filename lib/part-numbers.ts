import * as api from '@/lib/api';
import { fetchCappedPages, HIERARCHY_TYPE_CAP } from '@/lib/data-loading';

function collectPartNumbers(items: Array<{ part_number?: string | null }>): string[] {
  return items
    .map((item) => item.part_number?.trim())
    .filter((partNumber): partNumber is string => Boolean(partNumber));
}

export async function loadAllPartNumbers(): Promise<string[]> {
  const partNumbers = new Set<string>();

  try {
    const res = await api.entities.partNumber();
    if (Array.isArray(res.data)) {
      res.data.forEach((partNumber) => {
        if (partNumber?.trim()) partNumbers.add(partNumber.trim());
      });
    }
  } catch {
    // Fall through to hierarchy aggregation.
  }

  if (partNumbers.size === 0) {
    try {
      const [systems, subsystems, modules, units, components] = await Promise.all([
        fetchCappedPages(api.systems.list, { maxItems: HIERARCHY_TYPE_CAP }),
        fetchCappedPages(api.subsystems.list, { maxItems: HIERARCHY_TYPE_CAP }),
        fetchCappedPages(api.modules.list, { maxItems: HIERARCHY_TYPE_CAP }),
        fetchCappedPages(api.units.list, { maxItems: HIERARCHY_TYPE_CAP }),
        fetchCappedPages(api.components.list, { maxItems: HIERARCHY_TYPE_CAP }),
      ]);

      [
        ...collectPartNumbers(systems),
        ...collectPartNumbers(subsystems),
        ...collectPartNumbers(modules),
        ...collectPartNumbers(units),
        ...collectPartNumbers(components),
      ].forEach((partNumber) => partNumbers.add(partNumber));
    } catch {
      // Return whatever we have.
    }
  }

  return Array.from(partNumbers).sort((a, b) => a.localeCompare(b));
}
