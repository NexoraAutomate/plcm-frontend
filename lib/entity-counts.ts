export function buildChildCountMap<T>(
  children: T[],
  getParentId: (item: T) => number | null | undefined
): Map<number, number> {
  const map = new Map<number, number>();

  for (const item of children) {
    const parentId = getParentId(item);
    if (parentId == null) continue;
    map.set(parentId, (map.get(parentId) ?? 0) + 1);
  }

  return map;
}

export function getCount(map: Map<number, number>, id: number): number {
  return map.get(id) ?? 0;
}

export function getOrderCountByCustomerId(
  orders: { customer_id: number }[]
): Map<number, number> {
  return buildChildCountMap(orders, (order) => order.customer_id);
}

export function getProjectCountByOrderId(
  projects: { order_id: number }[]
): Map<number, number> {
  return buildChildCountMap(projects, (project) => project.order_id);
}

export function getProjectCountByCustomerId(
  orders: { id: number; customer_id: number }[],
  projects: { order_id: number }[]
): Map<number, number> {
  const orderToCustomer = new Map(orders.map((order) => [order.id, order.customer_id]));
  const map = new Map<number, number>();

  for (const project of projects) {
    const customerId = orderToCustomer.get(project.order_id);
    if (customerId == null) continue;
    map.set(customerId, (map.get(customerId) ?? 0) + 1);
  }

  return map;
}

export function getSystemCountByProjectId(
  systems: { project_id: number }[]
): Map<number, number> {
  return buildChildCountMap(systems, (system) => system.project_id);
}

export function getSubsystemCountBySystemId(
  subsystems: { system_id: number }[]
): Map<number, number> {
  return buildChildCountMap(subsystems, (subsystem) => subsystem.system_id);
}

export function getModuleCountBySubsystemId(
  modules: { subsystem_id: number }[]
): Map<number, number> {
  return buildChildCountMap(modules, (module) => module.subsystem_id);
}

export function getUnitCountByModuleId(
  units: { module_id: number }[]
): Map<number, number> {
  return buildChildCountMap(units, (unit) => unit.module_id);
}

export function getComponentCountByUnitId(
  components: { unit_id: number }[]
): Map<number, number> {
  return buildChildCountMap(components, (component) => component.unit_id);
}

export function getInventoryQuantityByEntityId(
  inventory: { entity_id?: number; quantity: number }[]
): Map<number, number> {
  const map = new Map<number, number>();

  for (const item of inventory) {
    if (item.entity_id == null) continue;
    map.set(
      item.entity_id,
      (map.get(item.entity_id) ?? 0) + item.quantity
    );
  }

  return map;
}

/** @deprecated Use getInventoryQuantityByEntityId */
export function getInventoryQuantityByComponentId(
  inventory: { entity_id?: number; component_id?: number; quantity: number }[]
): Map<number, number> {
  const normalized = inventory.map((item) => ({
    entity_id: item.entity_id ?? item.component_id,
    quantity: item.quantity,
  }));
  return getInventoryQuantityByEntityId(normalized);
}
