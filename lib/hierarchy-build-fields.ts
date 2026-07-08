import type { HierarchyInstallFields } from '@/lib/models';

export interface OriginalBuildDisplayFields {
  partNumber?: string;
  serialNumber?: string;
  configurationItem?: string;
}

type BuildSource = HierarchyInstallFields & {
  part_number?: string;
  serial_number?: string;
  configuration_item?: string;
};

export function getOriginalBuildDisplayFields(entity: BuildSource): OriginalBuildDisplayFields {
  const partNumber =
    entity.original_part_number?.trim() || entity.part_number?.trim() || undefined;
  const serialNumber =
    entity.original_serial_number?.trim() || entity.serial_number?.trim() || undefined;
  const configurationItem =
    entity.configuration_item?.trim() || partNumber || undefined;

  return { partNumber, serialNumber, configurationItem };
}

export function applyOriginalBuildToNodeFields<
  T extends {
    partNumber?: string;
    serialNumber?: string;
    description?: string;
    configurationItem?: string;
  },
>(fields: T, entity: BuildSource): T & OriginalBuildDisplayFields {
  const original = getOriginalBuildDisplayFields(entity);

  return {
    ...fields,
    partNumber: original.partNumber,
    serialNumber: original.serialNumber,
    configurationItem: original.configurationItem,
  };
}
