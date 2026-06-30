import * as api from '@/lib/api';

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
        api.systems.list(0, 1000),
        api.subsystems.list(0, 1000),
        api.modules.list(0, 1000),
        api.units.list(0, 1000),
        api.components.list(0, 1000),
      ]);

      [
        ...collectPartNumbers(systems.data ?? []),
        ...collectPartNumbers(subsystems.data ?? []),
        ...collectPartNumbers(modules.data ?? []),
        ...collectPartNumbers(units.data ?? []),
        ...collectPartNumbers(components.data ?? []),
      ].forEach((partNumber) => partNumbers.add(partNumber));
    } catch {
      // Return whatever we have.
    }
  }

  return Array.from(partNumbers).sort((a, b) => a.localeCompare(b));
}
