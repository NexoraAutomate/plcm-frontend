'use client';

import { FAULT_PING_STYLES, getEntityFaultStatus } from '@/lib/entity-fault-badges';
import type { FaultyEntityStatus } from '@/lib/models';

interface EntityFaultPingProps {
  entityType: string;
  entityId: number;
  faultMap: Map<string, FaultyEntityStatus>;
  className?: string;
}

export function EntityFaultPing({
  entityType,
  entityId,
  faultMap,
  className,
}: EntityFaultPingProps) {
  const status = getEntityFaultStatus(faultMap, entityType, entityId);
  if (!status) return null;

  const styles = FAULT_PING_STYLES[status];
  if (!styles) return null;

  return (
    <span
      className={`relative flex size-2 shrink-0 ${className ?? ''}`}
      title={styles.label}
      aria-label={styles.label}
    >
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${styles.ping}`}
      />
      <span className={`relative inline-flex size-2 rounded-full ${styles.dot}`} />
    </span>
  );
}

interface EntityNameWithFaultProps {
  name: string;
  entityType: string;
  entityId: number;
  faultMap: Map<string, FaultyEntityStatus>;
}

export function EntityNameWithFault({
  name,
  entityType,
  entityId,
  faultMap,
}: EntityNameWithFaultProps) {
  return (
    <div className="flex items-center gap-2">
      <EntityFaultPing entityType={entityType} entityId={entityId} faultMap={faultMap} />
      <span>{name}</span>
    </div>
  );
}
