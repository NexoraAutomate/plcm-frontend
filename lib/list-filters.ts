/** Shared query params for paginated list endpoints. */
export interface ListFilterParams {
  search?: string;
  status_id?: number;
  order_id?: number;
  customer_id?: number;
  project_id?: number;
  system_id?: number;
  subsystem_id?: number;
  module_id?: number;
  unit_id?: number;
  inventory_type?: string;
}

export function normalizeListFilters(filters?: ListFilterParams): ListFilterParams | undefined {
  if (!filters) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as ListFilterParams;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}
