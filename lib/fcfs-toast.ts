import { toast } from 'sonner';
import type { FCFSFulfillment } from '@/lib/models';

export function toastFulfillments(items?: FCFSFulfillment[] | null) {
  if (!items?.length) return;
  const first = items[0];
  const label = first.project_name || `project #${first.project_id}`;
  if (items.length === 1) {
    toast.success(
      `Auto-reserved for ${label} (FCFS)`,
      {
        description: [
          first.part_number ? `PN ${first.part_number}` : null,
          first.serial_number ? `SN ${first.serial_number}` : null,
          first.flight_name,
          first.sdls_name,
          first.lru_name,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    );
    return;
  }
  toast.success(`Auto-reserved ${items.length} waiting shortages (FCFS)`);
}
