export function buildHierarchyPageUrl(
  basePath: string,
  statusFilter: string,
  parentFilter: string,
  parentParamName: string
): string {
  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (parentFilter !== 'all') params.set(parentParamName, parentFilter);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
