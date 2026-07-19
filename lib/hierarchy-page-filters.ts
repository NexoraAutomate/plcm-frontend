export function buildHierarchyPageUrl(
  basePath: string,
  statusFilter: string,
  parentFilter: string,
  parentParamName: string,
  sort?: { sort_by?: string; sort_order?: 'asc' | 'desc' }
): string {
  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (parentFilter !== 'all') params.set(parentParamName, parentFilter);
  if (sort?.sort_by) params.set('sort_by', sort.sort_by);
  if (sort?.sort_order) params.set('sort_order', sort.sort_order);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
