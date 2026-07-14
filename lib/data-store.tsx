'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import { useAuth } from './auth-context';
import { queryKeys } from '@/hooks/queries/query-keys';
import {
  fetchCustomers,
  fetchFaultyEntities,
  fetchHierarchyEntities,
  fetchInventory,
  fetchMaintenanceCases,
  fetchMaintenanceLogs,
  fetchOrders,
  fetchProjects,
  fetchStatuses,
  fetchUsers,
} from '@/hooks/queries/fetchers';
// import * as maintenanceApi from '@/lib/maintenance';
import * as Models from './models';
import * as MaintenanceTypes from '@/lib/models';
import { enrichEntitiesWithStatus, enrichEntityWithStatus } from './entity-status';
import { LIST_BOOTSTRAP_SIZE, LIST_PAGE_SIZE } from './data-loading';
import { toast } from 'sonner';

interface DataStoreContextType {
  // Data
  users: Models.User[];
  customers: Models.Customer[];
  orders: Models.Order[];
  projects: Models.Project[];
  systems: Models.System[];
  subsystems: Models.Subsystem[];
  modules: Models.Module[];
  units: Models.Unit[];
  components: Models.Component[];
  inventory: Models.Inventory[];
  statuses: Models.Status[];
  maintenanceLogs: Models.MaintenanceLog[];
  maintenanceCases: MaintenanceTypes.MaintenanceCase[];
  faultyEntities: MaintenanceTypes.FaultyEntity[];
  maintenanceActions: MaintenanceTypes.MaintenanceAction[];
  maintenanceDeliveries: MaintenanceTypes.MaintenanceDelivery[];
  configurationHistory: MaintenanceTypes.ConfigurationHistory[];

  // Loading states
  loading: boolean;
  hierarchyLoading: boolean;
  hierarchyReady: boolean;
  hierarchyAttempted: boolean;
  error: string | null;

  // Users
  getUser: (id: number) => Promise<Models.User>;
  createUser: (data: Partial<Models.User>) => Promise<Models.User>;
  updateUser: (id: number, data: Partial<Models.User>) => Promise<Models.User>;
  deleteUser: (id: number) => Promise<void>;

  // Customers
  getCustomer: (id: number) => Promise<Models.Customer>;
  createCustomer: (data: Partial<Models.Customer>) => Promise<Models.Customer>;
  updateCustomer: (id: number, data: Partial<Models.Customer>) => Promise<Models.Customer>;
  deleteCustomer: (id: number) => Promise<void>;

  // Orders
  getOrder: (id: number) => Promise<Models.Order>;
  createOrder: (data: Partial<Models.Order>) => Promise<Models.Order>;
  updateOrder: (id: number, data: Partial<Models.Order>) => Promise<Models.Order>;
  deleteOrder: (id: number) => Promise<void>;

  // Projects
  getProject: (id: number) => Promise<Models.Project>;
  createProject: (data: Partial<Models.Project>) => Promise<Models.Project>;
  updateProject: (id: number, data: Partial<Models.Project>) => Promise<Models.Project>;
  deleteProject: (id: number) => Promise<void>;
  getProjectSystems: (projectId: number) => Promise<Models.System[]>;

  // Systems
  getSystem: (id: number) => Promise<Models.System>;
  createSystem: (data: Partial<Models.System>) => Promise<Models.System>;
  updateSystem: (id: number, data: Partial<Models.System>) => Promise<Models.System>;
  deleteSystem: (id: number) => Promise<void>;
  getSystemSubsystems: (systemId: number) => Promise<Models.Subsystem[]>;

  // Subsystems
  getSubsystem: (id: number) => Promise<Models.Subsystem>;
  createSubsystem: (data: Partial<Models.Subsystem>) => Promise<Models.Subsystem>;
  updateSubsystem: (id: number, data: Partial<Models.Subsystem>) => Promise<Models.Subsystem>;
  deleteSubsystem: (id: number) => Promise<void>;
  getSubsystemModules: (subsystemId: number) => Promise<Models.Module[]>;

  // Modules
  getModule: (id: number) => Promise<Models.Module>;
  createModule: (data: Partial<Models.Module>) => Promise<Models.Module>;
  updateModule: (id: number, data: Partial<Models.Module>) => Promise<Models.Module>;
  deleteModule: (id: number) => Promise<void>;
  getModuleUnits: (moduleId: number) => Promise<Models.Unit[]>;

  // Units
  getUnit: (id: number) => Promise<Models.Unit>;
  createUnit: (data: Partial<Models.Unit>) => Promise<Models.Unit>;
  updateUnit: (id: number, data: Partial<Models.Unit>) => Promise<Models.Unit>;
  deleteUnit: (id: number) => Promise<void>;
  getUnitComponents: (unitId: number) => Promise<Models.Component[]>;

  // Components
  getComponent: (id: number) => Promise<Models.Component>;
  createComponent: (data: Partial<Models.Component>) => Promise<Models.Component>;
  updateComponent: (id: number, data: Partial<Models.Component>) => Promise<Models.Component>;
  deleteComponent: (id: number) => Promise<void>;

  // Inventory
  getInventoryItem: (id: number) => Promise<Models.Inventory>;
  createInventoryItem: (data: Partial<Models.Inventory>) => Promise<Models.Inventory>;
  updateInventoryItem: (id: number, data: Partial<Models.Inventory>) => Promise<Models.Inventory>;
  deleteInventoryItem: (id: number) => Promise<void>;

  // Statuses
  createStatus: (data: Partial<Models.Status>) => Promise<Models.Status>;
  updateStatus: (id: number, data: Partial<Models.Status>) => Promise<Models.Status>;
  deleteStatus: (id: number) => Promise<void>;

  // maintenanceLogs
  createMaintenanceLog: (data: Partial<Models.MaintenanceLog>) => Promise<Models.MaintenanceLog>;
  getEntityMaintenanceLogs: (entityId: number) => Promise<Models.MaintenanceLog[]>;
  getEntityStatusHistory: (entityId: number) => Promise<Models.EntityStatusHistory[]>;

  // Maintenance Cases
  getMaintenanceCase: (id: number) => Promise<MaintenanceTypes.MaintenanceCase>;
  createMaintenanceCase: (data: MaintenanceTypes.CreateMaintenanceCasePayload) => Promise<MaintenanceTypes.MaintenanceCase>;
  updateMaintenanceCase: (id: number, data: MaintenanceTypes.UpdateMaintenanceCasePayload) => Promise<MaintenanceTypes.MaintenanceCase>;
  deleteMaintenanceCase: (id: number) => Promise<void>;
  lookupEntityBySerialNumber: (serialNumber: string) => Promise<MaintenanceTypes.lookUpResponse>;
  /** @deprecated Prefer lookupEntityBySerialNumber — part numbers are not unique. */
  lookupEntityByPartNumber: (partNumber: string) => Promise<MaintenanceTypes.lookUpResponse>;
  suspectChildren: (case_Id: number, data: MaintenanceTypes.SuspectChildrenPayload) => Promise<any>;
  confirmFault: (caseId: number, data: MaintenanceTypes.ConfirmFaultPayload) => Promise<any>;

  // Faulty Entities
  getFaultyEntity: (id: number) => Promise<MaintenanceTypes.FaultyEntity>;
  createFaultyEntity: (data: MaintenanceTypes.CreateFaultyEntityPayload) => Promise<MaintenanceTypes.FaultyEntity>;
  updateFaultyEntity: (id: number, data: MaintenanceTypes.UpdateFaultyEntityPayload) => Promise<MaintenanceTypes.FaultyEntity>;
  // update_faulty_Children: (id: number, data: MaintenanceTypes.UpdateFaultyEntityPayload) => Promise<MaintenanceTypes.FaultyEntity>;
  deleteFaultyEntity: (id: number) => Promise<void>;
  cascadeFault: (entityId: number, faultType: string) => Promise<void>;
  getEntityMaintenanceHistory: (entityId: number) => Promise<MaintenanceTypes.MaintenanceAction[]>;

  // Maintenance Actions
  getMaintenanceAction: (id: number) => Promise<MaintenanceTypes.MaintenanceAction>;
  createMaintenanceAction: (data: MaintenanceTypes.CreateMaintenanceActionPayload) => Promise<MaintenanceTypes.MaintenanceAction>;
  updateMaintenanceAction: (id: number, data: MaintenanceTypes.UpdateMaintenanceActionPayload) => Promise<MaintenanceTypes.MaintenanceAction>;
  deleteMaintenanceAction: (id: number) => Promise<void>;


  // Maintenance Deliveries
  getMaintenanceDelivery: (id: number) => Promise<MaintenanceTypes.MaintenanceDelivery>;
  createMaintenanceDelivery: (data: MaintenanceTypes.CreateMaintenanceDeliveryPayload) => Promise<MaintenanceTypes.MaintenanceDelivery>;
  updateMaintenanceDelivery: (id: number, data: MaintenanceTypes.UpdateMaintenanceDeliveryPayload) => Promise<MaintenanceTypes.MaintenanceDelivery>;
  confirmMaintenanceDelivery: (id: number, receivedBy: string) => Promise<MaintenanceTypes.MaintenanceDelivery>;
  deleteMaintenanceDelivery: (id: number) => Promise<void>;

  // configuration History
  getConfigurationHistory: (id: number) => Promise<MaintenanceTypes.ConfigurationHistory>;
  getConfigurationHistoryByEntityId: (entityId: number) => Promise<MaintenanceTypes.ConfigurationHistory[]>;
  getConfigurationHistoryByCaseId: (caseId: number) => Promise<MaintenanceTypes.ConfigurationHistory[]>;
  createConfigurationHistory: (data: MaintenanceTypes.CreateConfigurationHistoryPayload) => Promise<MaintenanceTypes.ConfigurationHistory>;
  updateConfigurationHistory: (id: number, data: MaintenanceTypes.UpdateConfigurationHistoryPayload) => Promise<MaintenanceTypes.ConfigurationHistory>;
  deleteConfigurationHistory: (id: number) => Promise<void>;

  // Refresh
  refreshData: (options?: { silent?: boolean }) => Promise<void>;
  refreshLightweight: () => Promise<void>;
  ensureHierarchyLoaded: (options?: { force?: boolean }) => Promise<void>;
}

const DataStoreContext = createContext<DataStoreContextType | undefined>(undefined);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<Models.User[]>([]);
  const [customers, setCustomers] = useState<Models.Customer[]>([]);
  const [orders, setOrders] = useState<Models.Order[]>([]);
  const [projects, setProjects] = useState<Models.Project[]>([]);
  const [systems, setSystems] = useState<Models.System[]>([]);
  const [subsystems, setSubsystems] = useState<Models.Subsystem[]>([]);
  const [modules, setModules] = useState<Models.Module[]>([]);
  const [units, setUnits] = useState<Models.Unit[]>([]);
  const [components, setComponents] = useState<Models.Component[]>([]);
  const [inventory, setInventory] = useState<Models.Inventory[]>([]);
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<Models.MaintenanceLog[]>([]);
  const [maintenanceCases, setMaintenanceCases] = useState<MaintenanceTypes.MaintenanceCase[]>([]);
  const [faultyEntities, setFaultyEntities] = useState<MaintenanceTypes.FaultyEntity[]>([]);
  const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceTypes.MaintenanceAction[]>([]);
  const [maintenanceDeliveries, setMaintenanceDeliveries] = useState<MaintenanceTypes.MaintenanceDelivery[]>([]);
  const [configurationHistory, setconfigurationHistory] = useState<MaintenanceTypes.ConfigurationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyReady, setHierarchyReady] = useState(false);
  const [hierarchyAttempted, setHierarchyAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hierarchyLoadPromiseRef = useRef<Promise<void> | null>(null);
  const statusesRef = useRef(statuses);
  const hierarchyReadyRef = useRef(hierarchyReady);
  statusesRef.current = statuses;
  hierarchyReadyRef.current = hierarchyReady;

  const applyEntityResults = useCallback(
    (
      statusList: Models.Status[],
      results: {
        systems: Models.System[];
        subsystems: Models.Subsystem[];
        modules: Models.Module[];
        units: Models.Unit[];
        components: Models.Component[];
      }
    ) => {
      const enrich = <T extends { status_id: number }>(rows: T[]) =>
        statusList.length > 0 ? enrichEntitiesWithStatus(rows, statusList) : rows;

      setSystems(enrich(results.systems));
      setSubsystems(enrich(results.subsystems));
      setModules(enrich(results.modules));
      setUnits(enrich(results.units));
      setComponents(enrich(results.components));
      setHierarchyReady(true);
    },
    []
  );

  const loadHierarchyData = useCallback(async () => {
    const results = await queryClient.fetchQuery<
      Awaited<ReturnType<typeof fetchHierarchyEntities>>
    >({
      queryKey: queryKeys.hierarchyEntities(),
      queryFn: fetchHierarchyEntities,
    });

    const statusList =
      statusesRef.current.length > 0
        ? statusesRef.current
        : await queryClient.fetchQuery({
            queryKey: queryKeys.statuses(),
            queryFn: fetchStatuses,
          });

    applyEntityResults(statusList, results);
  }, [applyEntityResults, queryClient]);

  const ensureHierarchyLoaded = useCallback(
    async (options?: { force?: boolean }) => {
      if (hierarchyReadyRef.current && !options?.force) return;
      if (hierarchyLoadPromiseRef.current && !options?.force) {
        await hierarchyLoadPromiseRef.current;
        return;
      }

      const run = async () => {
        setHierarchyLoading(true);
        try {
          if (options?.force) {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.hierarchyEntities(),
            });
          }
          await loadHierarchyData();
        } catch (err) {
          console.warn('Failed to load hierarchy data:', err);
        } finally {
          setHierarchyAttempted(true);
          setHierarchyLoading(false);
          hierarchyLoadPromiseRef.current = null;
        }
      };

      hierarchyLoadPromiseRef.current = run();
      await hierarchyLoadPromiseRef.current;
    },
    [loadHierarchyData, queryClient]
  );

  const ensureHierarchyLoadedRef = useRef(ensureHierarchyLoaded);
  ensureHierarchyLoadedRef.current = ensureHierarchyLoaded;

  const refreshLightweight = useCallback(async () => {
    const limit = LIST_BOOTSTRAP_SIZE;
    const results = await Promise.allSettled([
      queryClient.fetchQuery<Models.MaintenanceCase[]>({
        queryKey: queryKeys.maintenanceCases(0, limit),
        queryFn: () => fetchMaintenanceCases(0, limit),
        retry: false,
      }),
      queryClient.fetchQuery<Models.FaultyEntity[]>({
        queryKey: queryKeys.faultyEntities(0, limit),
        queryFn: () => fetchFaultyEntities(0, limit),
        retry: false,
      }),
      queryClient.fetchQuery<Models.Project[]>({
        queryKey: queryKeys.projects(0, limit),
        queryFn: () => fetchProjects(0, limit, { includeTotal: false }),
        retry: false,
      }),
      queryClient.fetchQuery<Models.Customer[]>({
        queryKey: queryKeys.customers(0, limit),
        queryFn: () => fetchCustomers(0, limit),
        retry: false,
      }),
    ]);

    if (results[0].status === 'fulfilled') {
      setMaintenanceCases(results[0].value);
      queryClient.setQueryData(queryKeys.maintenanceCases(0, limit), results[0].value);
    }
    if (results[1].status === 'fulfilled') {
      setFaultyEntities(results[1].value);
      queryClient.setQueryData(queryKeys.faultyEntities(0, limit), results[1].value);
    }
    if (results[2].status === 'fulfilled') {
      setProjects(results[2].value);
      queryClient.setQueryData(queryKeys.projects(0, limit), results[2].value);
    }
    if (results[3].status === 'fulfilled') {
      setCustomers(results[3].value);
      queryClient.setQueryData(queryKeys.customers(0, limit), results[3].value);
    }
  }, [queryClient]);

  const refreshData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const limit = LIST_BOOTSTRAP_SIZE;

    try {
      if (!silent) setLoading(true);

      const results = await Promise.allSettled([
        queryClient.fetchQuery<Models.User[]>({
          queryKey: queryKeys.users(0, limit),
          queryFn: () => fetchUsers(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.Customer[]>({
          queryKey: queryKeys.customers(0, limit),
          queryFn: () => fetchCustomers(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.Order[]>({
          queryKey: queryKeys.orders(0, limit),
          queryFn: () => fetchOrders(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.Project[]>({
          queryKey: queryKeys.projects(0, limit),
          queryFn: () => fetchProjects(0, limit, { includeTotal: false }),
          retry: false,
        }),
        queryClient.fetchQuery<Models.Inventory[]>({
          queryKey: queryKeys.inventory(0, limit),
          queryFn: () => fetchInventory(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.Status[]>({
          queryKey: queryKeys.statuses(),
          queryFn: fetchStatuses,
          retry: false,
        }),
        queryClient.fetchQuery<Models.MaintenanceLog[]>({
          queryKey: queryKeys.maintenanceLogs(0, limit),
          queryFn: () => fetchMaintenanceLogs(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.MaintenanceCase[]>({
          queryKey: queryKeys.maintenanceCases(0, limit),
          queryFn: () => fetchMaintenanceCases(0, limit),
          retry: false,
        }),
        queryClient.fetchQuery<Models.FaultyEntity[]>({
          queryKey: queryKeys.faultyEntities(0, limit),
          queryFn: () => fetchFaultyEntities(0, limit),
          retry: false,
        }),
      ] as const);

      const applyResult = <T,>(
        result: PromiseSettledResult<T>,
        setter: React.Dispatch<React.SetStateAction<T>>,
        queryKey: readonly unknown[],
        label: string
      ) => {
        if (result.status === 'fulfilled') {
          setter(result.value);
          queryClient.setQueryData(queryKey, result.value);
        } else {
          console.warn(`Failed to refresh ${label}:`, result.reason);
        }
      };

      applyResult(results[0], setUsers, queryKeys.users(0, limit), 'users');
      applyResult(results[1], setCustomers, queryKeys.customers(0, limit), 'customers');
      applyResult(results[2], setOrders, queryKeys.orders(0, limit), 'orders');
      applyResult(results[3], setProjects, queryKeys.projects(0, limit), 'projects');
      applyResult(results[4], setInventory, queryKeys.inventory(0, limit), 'inventory');
      applyResult(results[5], setStatuses, queryKeys.statuses(), 'statuses');
      applyResult(results[6], setMaintenanceLogs, queryKeys.maintenanceLogs(0, limit), 'maintenanceLogs');
      applyResult(results[7], setMaintenanceCases, queryKeys.maintenanceCases(0, limit), 'maintenanceCases');
      applyResult(results[8], setFaultyEntities, queryKeys.faultyEntities(0, limit), 'faultyEntities');

      if (results.every((r) => r.status === 'rejected')) {
        setError('Failed to load data');
        if (!silent) toast.error('Failed to load data');
      } else {
        setError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      if (authReady) setLoading(false);
      return;
    }
    void refreshData();
  }, [authReady, isAuthenticated, refreshData]);


  // Users
  const getUser = async (id: number) => {
    try {
      const res = await api.users.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch user');
      throw err;
    }
  };

  const createUser = async (data: Partial<Models.User>) => {
    try {
      const res = await api.users.create(data);
      setUsers([...users, res.data]);
      toast.success('User created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create user');
      throw err;
    }
  };

  const updateUser = async (id: number, data: Partial<Models.User>) => {
    try {
      const res = await api.users.update(id, data);
      setUsers(users.map((u) => (u.id === id ? res.data : u)));
      toast.success('User updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update user');
      throw err;
    }
  };

  const deleteUser = async (id: number) => {
    try {
      await api.users.delete(id);
      setUsers(users.filter((u) => u.id !== id));
      toast.success('User deleted successfully');
    } catch (err) {
      toast.error('Failed to delete user');
      throw err;
    }
  };

  // Customers
  const getCustomer = async (id: number) => {
    try {
      // console.log("Fetching customer with ID:", id);
      const res = await api.customers.get(id);
      // console.log("Fetched customers:", res.data);
      return res.data;

    } catch (err) {
      toast.error('Failed to fetch customer');
      throw err;
    }
  };

  const createCustomer = async (data: Partial<Models.Customer>) => {
    try {
      const res = await api.customers.create(data);
      setCustomers([...customers, res.data]);
      toast.success('Customer created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create customer');
      throw err;
    }
  };

  const updateCustomer = async (id: number, data: Partial<Models.Customer>) => {
    try {
      const res = await api.customers.update(id, data);
      setCustomers(customers.map((c) => (c.id === id ? res.data : c)));
      toast.success('Customer updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update customer');
      throw err;
    }
  };

  const deleteCustomer = async (id: number) => {
    try {
      await api.customers.delete(id);
      setCustomers(customers.filter((c) => c.id !== id));
      toast.success('Customer deleted successfully');
    } catch (err) {
      toast.error('Failed to delete customer');
      throw err;
    }
  };

  // Orders
  const getOrder = async (id: number) => {
    try {
      const res = await api.orders.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch order');
      throw err;
    }
  };

  const createOrder = async (data: Partial<Models.Order>) => {
    try {
      const res = await api.orders.create(data);
      setOrders([...orders, res.data]);
      toast.success('Order created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create order');
      throw err;
    }
  };

  const updateOrder = async (id: number, data: Partial<Models.Order>) => {
    try {
      const res = await api.orders.update(id, data);
      setOrders(orders.map((o) => (o.id === id ? res.data : o)));
      toast.success('Order updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update order');
      throw err;
    }
  };

  const deleteOrder = async (id: number) => {
    try {
      await api.orders.delete(id);
      setOrders(orders.filter((o) => o.id !== id));
      toast.success('Order deleted successfully');
    } catch (err) {
      toast.error('Failed to delete order');
      throw err;
    }
  };

  // Projects
  const getProject = async (id: number) => {
    try {
      const res = await api.projects.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch project');
      throw err;
    }
  };

  const createProject = async (data: Partial<Models.Project>) => {
    try {
      // console.log("Created project:");
      const res = await api.projects.create(data);
      // console.log("Created project:", res.data);
      setProjects([...projects, res.data]);
      toast.success('Project created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create project');
      throw err;
    }
  };

  const updateProject = async (id: number, data: Partial<Models.Project>) => {
    try {
      const payload: Partial<Models.Project> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.description !== undefined) payload.description = data.description;
      if (data.owner_id !== undefined && data.owner_id > 0) payload.owner_id = data.owner_id;
      if (data.order_id !== undefined && data.order_id > 0) payload.order_id = data.order_id;
      if (data.status_id !== undefined && data.status_id > 0) payload.status_id = data.status_id;
      if (data.progress !== undefined) payload.progress = data.progress;
      if (data.start_date) {
        payload.start_date = data.start_date.includes('T')
          ? data.start_date
          : `${data.start_date}T00:00:00`;
      }
      if (data.end_date) {
        payload.end_date = data.end_date.includes('T')
          ? data.end_date
          : `${data.end_date}T00:00:00`;
      }

      const res = await api.projects.update(id, payload);
      setProjects(projects.map((p) => (p.id === id ? res.data : p)));
      toast.success('Project updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update project');
      throw err;
    }
  };

  const deleteProject = async (id: number) => {
    try {
      await api.projects.delete(id);
      setProjects(projects.filter((p) => p.id !== id));
      toast.success('Project deleted successfully');
    } catch (err) {
      toast.error('Failed to delete project');
      throw err;
    }
  };

  const getProjectSystems = async (projectId: number) => {
    try {
      const res = await api.projects.getSystems(projectId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch project systems');
      throw err;
    }
  };

  // Systems
  const getSystem = async (id: number) => {
    try {
      const res = await api.systems.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch system');
      throw err;
    }
  };

  const createSystem = async (data: Partial<Models.System>) => {
    try {
      const res = await api.systems.create(data);
      setSystems((prev) => [...prev, enrichEntityWithStatus(res.data, statusesRef.current)]);
      toast.success('System created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create system');
      throw err;
    }
  };

  const updateSystem = async (id: number, data: Partial<Models.System>) => {
    try {
      const res = await api.systems.update(id, data);
      setSystems((prev) =>
        prev.map((s) => (s.id === id ? enrichEntityWithStatus(res.data, statusesRef.current) : s))
      );
      toast.success('System updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update system');
      throw err;
    }
  };

  const deleteSystem = async (id: number) => {
    try {
      await api.systems.delete(id);
      setSystems((prev) => prev.filter((s) => s.id !== id));
      toast.success('System deleted successfully');
    } catch (err) {
      toast.error('Failed to delete system');
      throw err;
    }
  };

  const getSystemSubsystems = async (systemId: number) => {
    try {
      const res = await api.systems.getSubsystems(systemId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch system subsystems');
      throw err;
    }
  };

  // Subsystems
  const getSubsystem = async (id: number) => {
    try {
      const res = await api.subsystems.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch subsystem');
      throw err;
    }
  };

  const createSubsystem = async (data: Partial<Models.Subsystem>) => {
    try {
      const res = await api.subsystems.create(data);
      setSubsystems((prev) => [...prev, enrichEntityWithStatus(res.data, statusesRef.current)]);
      toast.success('Subsystem created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create subsystem');
      throw err;
    }
  };

  const updateSubsystem = async (id: number, data: Partial<Models.Subsystem>) => {
    try {
      const res = await api.subsystems.update(id, data);
      setSubsystems((prev) =>
        prev.map((s) => (s.id === id ? enrichEntityWithStatus(res.data, statusesRef.current) : s))
      );
      toast.success('Subsystem updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update subsystem');
      throw err;
    }
  };

  const deleteSubsystem = async (id: number) => {
    try {
      await api.subsystems.delete(id);
      setSubsystems((prev) => prev.filter((s) => s.id !== id));
      toast.success('Subsystem deleted successfully');
    } catch (err) {
      toast.error('Failed to delete subsystem');
      throw err;
    }
  };

  const getSubsystemModules = async (subsystemId: number) => {
    try {
      const res = await api.subsystems.getModules(subsystemId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch subsystem modules');
      throw err;
    }
  };

  // Modules
  const getModule = async (id: number) => {
    try {
      const res = await api.modules.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch module');
      throw err;
    }
  };

  const createModule = async (data: Partial<Models.Module>) => {
    try {
      const res = await api.modules.create(data);
      setModules((prev) => [...prev, enrichEntityWithStatus(res.data, statusesRef.current)]);
      toast.success('Module created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create module');
      throw err;
    }
  };

  const updateModule = async (id: number, data: Partial<Models.Module>) => {
    try {
      const res = await api.modules.update(id, data);
      setModules((prev) =>
        prev.map((m) => (m.id === id ? enrichEntityWithStatus(res.data, statusesRef.current) : m))
      );
      toast.success('Module updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update module');
      throw err;
    }
  };

  const deleteModule = async (id: number) => {
    try {
      await api.modules.delete(id);
      setModules((prev) => prev.filter((m) => m.id !== id));
      toast.success('Module deleted successfully');
    } catch (err) {
      toast.error('Failed to delete module');
      throw err;
    }
  };

  const getModuleUnits = async (moduleId: number) => {
    try {
      const res = await api.modules.getUnits(moduleId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch module units');
      throw err;
    }
  };

  // Units
  const getUnit = async (id: number) => {
    try {
      const res = await api.units.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch unit');
      throw err;
    }
  };

  const createUnit = async (data: Partial<Models.Unit>) => {
    try {
      const res = await api.units.create(data);
      setUnits((prev) => [...prev, enrichEntityWithStatus(res.data, statusesRef.current)]);
      toast.success('Unit created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create unit');
      throw err;
    }
  };

  const updateUnit = async (id: number, data: Partial<Models.Unit>) => {
    try {
      const res = await api.units.update(id, data);
      setUnits((prev) =>
        prev.map((u) => (u.id === id ? enrichEntityWithStatus(res.data, statusesRef.current) : u))
      );
      toast.success('Unit updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update unit');
      throw err;
    }
  };

  const deleteUnit = async (id: number) => {
    try {
      await api.units.delete(id);
      setUnits((prev) => prev.filter((u) => u.id !== id));
      toast.success('Unit deleted successfully');
    } catch (err) {
      toast.error('Failed to delete unit');
      throw err;
    }
  };

  const getUnitComponents = async (unitId: number) => {
    try {
      const res = await api.units.getComponents(unitId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch unit components');
      throw err;
    }
  };

  // Components
  const getComponent = async (id: number) => {
    try {
      const res = await api.components.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch component');
      throw err;
    }
  };

  const createComponent = async (data: Partial<Models.Component>) => {
    try {
      const res = await api.components.create(data);
      setComponents((prev) => [...prev, enrichEntityWithStatus(res.data, statusesRef.current)]);
      toast.success('Component created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create component');
      throw err;
    }
  };

  const updateComponent = async (id: number, data: Partial<Models.Component>) => {
    try {
      const res = await api.components.update(id, data);
      setComponents((prev) =>
        prev.map((c) => (c.id === id ? enrichEntityWithStatus(res.data, statusesRef.current) : c))
      );
      toast.success('Component updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update component');
      throw err;
    }
  };

  const deleteComponent = async (id: number) => {
    try {
      await api.components.delete(id);
      setComponents((prev) => prev.filter((c) => c.id !== id));
      toast.success('Component deleted successfully');
    } catch (err) {
      toast.error('Failed to delete component');
      throw err;
    }
  };

  // Inventory
  const getInventoryItem = async (id: number) => {
    try {
      const res = await api.inventory.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch inventory item');
      throw err;
    }
  };

  const createInventoryItem = async (data: Partial<Models.Inventory>) => {
    try {
      const res = await api.inventory.create(data);
      setInventory((prev) => [...prev, res.data]);
      toast.success('Inventory item created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create inventory item');
      throw err;
    }
  };

  const updateInventoryItem = async (id: number, data: Partial<Models.Inventory>) => {
    try {
      const res = await api.inventory.update(id, data);
      setInventory((prev) => prev.map((inv) => (inv.id === id ? res.data : inv)));
      toast.success('Inventory item updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update inventory item');
      throw err;
    }
  };

  const deleteInventoryItem = async (id: number) => {
    try {
      await api.inventory.delete(id);
      setInventory((prev) => prev.filter((inv) => inv.id !== id));
      toast.success('Inventory item deleted successfully');
    } catch (err) {
      toast.error('Failed to delete inventory item');
      throw err;
    }
  };

  // Statuses
  const createStatus = async (data: Partial<Models.Status>) => {
    try {
      const res = await api.statuses.create(data);
      setStatuses([...statuses, res.data]);
      toast.success('Status created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create status');
      throw err;
    }
  };

  const updateStatus = async (id: number, data: Partial<Models.Status>) => {
    try {
      const res = await api.statuses.update(id, data);
      setStatuses(statuses.map((s) => (s.id === id ? res.data : s)));
      toast.success('Status updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update status');
      throw err;
    }
  };

  const deleteStatus = async (id: number) => {
    try {
      await api.statuses.delete(id);
      setStatuses(statuses.filter((s) => s.id !== id));
      toast.success('Status deleted successfully');
    } catch (err) {
      toast.error('Failed to delete status');
      throw err;
    }
  };

  // maintenanceLogs
  const createMaintenanceLog = async (data: Partial<Models.MaintenanceLog>) => {
    try {
      const res = await api.maintenanceLogs.create(data);
      setMaintenanceLogs([...maintenanceLogs, res.data]);
      toast.success('maintenanceLogs log created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create maintenanceLogs log');
      throw err;
    }
  };

  const getEntityMaintenanceLogs = async (entityId: number) => {
    try {
      const res = await api.entities.getMaintenanceLogs(entityId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch maintenanceLogs logs');
      throw err;
    }
  };

  const getEntityStatusHistory = async (entityId: number) => {
    try {
      const res = await api.entities.getStatusHistory(entityId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch status history');
      throw err;
    }
  };

  // Maintenance Cases
  const getMaintenanceCase = async (id: number) => {
    try {
      const res = await api.maintenanceCases.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch maintenance case');
      throw err;
    }
  };

  const createMaintenanceCase = async (data: MaintenanceTypes.CreateMaintenanceCasePayload) => {
    try {
      const res = await api.maintenanceCases.create(data);
      setMaintenanceCases([...maintenanceCases, res.data]);
      toast.success('Maintenance case created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create maintenance case');
      throw err;
    }
  };

  const updateMaintenanceCase = async (id: number, data: MaintenanceTypes.UpdateMaintenanceCasePayload) => {
    try {
      const res = await api.maintenanceCases.update(id, data);
      setMaintenanceCases(maintenanceCases.map((c) => (c.id === id ? res.data : c)));
      toast.success('Maintenance case updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update maintenance case');
      throw err;
    }
  };

  const deleteMaintenanceCase = async (id: number) => {
    try {
      await api.maintenanceCases.delete(id);
      setMaintenanceCases(maintenanceCases.filter((c) => c.id !== id));
      toast.success('Maintenance case deleted successfully');
    } catch (err) {
      toast.error('Failed to delete maintenance case');
      throw err;
    }
  };

  const lookupEntityBySerialNumber = async (serialNumber: string) => {
    try {
      const res = await api.maintenanceCases.lookupEntityBySerialNumber(serialNumber);
      return res.data;
    } catch (err) {
      toast.error('Failed to lookup entity by serial number');
      throw err;
    }
  };

  const lookupEntityByPartNumber = async (partNumber: string) => {
    // Kept for compatibility; lookup is keyed by serial number.
    return lookupEntityBySerialNumber(partNumber);
  };

  const suspectChildren = async (caseId: number, data: MaintenanceTypes.SuspectChildrenPayload) => {
    try {
      const res = await api.maintenanceCases.suspectChildren(caseId, data);
      toast.success('Suspect children generated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create suspect children');
      throw err;
    }
  };

  const confirmFault = async (caseId: number, data: MaintenanceTypes.ConfirmFaultPayload) => {
    try {
      const res = await api.maintenanceCases.confirmFault(caseId, data);
      toast.success('Fault confirmed successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to confirm fault');
      throw err;
    }
  };

  // Faulty Entities
  const getFaultyEntity = async (id: number) => {
    try {
      const res = await api.faultyEntities.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch faulty entity');
      throw err;
    }
  };

  const createFaultyEntity = async (data: MaintenanceTypes.CreateFaultyEntityPayload) => {
    try {
      const res = await api.faultyEntities.create(data);
      setFaultyEntities([...faultyEntities, res.data]);
      toast.success('Faulty entity created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create faulty entity');
      throw err;
    }
  };

  const updateFaultyEntity = async (id: number, data: MaintenanceTypes.UpdateFaultyEntityPayload) => {
    try {
      const res = await api.faultyEntities.update(id, data);
      setFaultyEntities(faultyEntities.map((e) => (e.id === id ? res.data : e)));
      toast.success('Faulty entity updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update faulty entity');
      throw err;
    }
  };

  const update_faulty_Children = async (id: number, data: MaintenanceTypes.UpdateFaultyEntityPayload) => {
    try {
      const res = await api.faultyEntities.updateChildren(id, data);
      setFaultyEntities(faultyEntities.map((e) => (e.id === id ? res.data : e)));
      toast.success('Faulty entity updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update faulty entity');
      throw err;
    }
  };

  const deleteFaultyEntity = async (id: number) => {
    try {
      await api.faultyEntities.delete(id);
      setFaultyEntities(faultyEntities.filter((e) => e.id !== id));
      toast.success('Faulty entity deleted successfully');
    } catch (err) {
      toast.error('Failed to delete faulty entity');
      throw err;
    }
  };

  const cascadeFault = async (entityId: number, faultType: string) => {
    try {
      await api.faultyEntities.cascadeFault(entityId, faultType);
      toast.success('Fault cascaded successfully');
    } catch (err) {
      toast.error('Failed to cascade fault');
      throw err;
    }
  };

  const getEntityMaintenanceHistory = async (entityId: number) => {
    try {
      const res = await api.faultyEntities.getMaintenanceHistory(entityId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch maintenance history');
      throw err;
    }
  };

  // Maintenance Actions
  const getMaintenanceAction = async (id: number) => {
    try {
      const res = await api.maintenanceActions.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch maintenance action');
      throw err;
    }
  };

  const createMaintenanceAction = async (data: MaintenanceTypes.CreateMaintenanceActionPayload) => {
    try {
      const res = await api.maintenanceActions.create(data);
      setMaintenanceActions([...maintenanceActions, res.data]);
      toast.success('Maintenance action created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create maintenance action');
      throw err;
    }
  };

  const updateMaintenanceAction = async (id: number, data: MaintenanceTypes.UpdateMaintenanceActionPayload) => {
    try {
      const res = await api.maintenanceActions.update(id, data);
      setMaintenanceActions(maintenanceActions.map((a) => (a.id === id ? res.data : a)));
      toast.success('Maintenance action updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update maintenance action');
      throw err;
    }
  };

  const deleteMaintenanceAction = async (id: number) => {
    try {
      await api.maintenanceActions.delete(id);
      setMaintenanceActions(maintenanceActions.filter((a) => a.id !== id));
      toast.success('Maintenance action deleted successfully');
    } catch (err) {
      toast.error('Failed to delete maintenance action');
      throw err;
    }
  };

    // Configuration History
  const getConfigurationHistory = async (id: number) => {
    try {
      const res = await api.configurationHistory.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch configuration history');
      throw err;
    }
  };

  const getConfigurationHistoryByEntityId = async (entityId: number) => {
    try {
      const res = await api.configurationHistory.listByEntityID(entityId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch configuration history by entity');
      throw err;
    }
  };

  const getConfigurationHistoryByCaseId = async (caseId: number) => {
    try {
      const res = await api.configurationHistory.listByCaseId(caseId);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch configuration history by case');
      throw err;
    }
  };

  const createConfigurationHistory = async (data: MaintenanceTypes.CreateConfigurationHistoryPayload) => {
    try {
      const res = await api.configurationHistory.create(data);
      setconfigurationHistory([...configurationHistory, res.data]);
      toast.success('Configuration history created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create configuration history');
      throw err;
    }
  };

  const updateConfigurationHistory = async (id: number, data: MaintenanceTypes.UpdateConfigurationHistoryPayload) => {
    try {
      const res = await api.configurationHistory.update(id, data);
      setconfigurationHistory(configurationHistory.map((a) => (a.id === id ? res.data : a)));
      toast.success('Configuration history updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update configuration history');
      throw err;
    }
  };

  const deleteConfigurationHistory = async (id: number) => {
    try {
      await api.configurationHistory.delete(id);
      setconfigurationHistory(configurationHistory.filter((a) => a.id !== id));
      toast.success('Configuration history deleted successfully');
    } catch (err) {
      toast.error('Failed to delete configuration history');
      throw err;
    }
  };

  // Maintenance Deliveries
  const getMaintenanceDelivery = async (id: number) => {
    try {
      const res = await api.maintenanceDeliveries.get(id);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch maintenance delivery');
      throw err;
    }
  };

  const createMaintenanceDelivery = async (data: MaintenanceTypes.CreateMaintenanceDeliveryPayload) => {
    try {
      const res = await api.maintenanceDeliveries.create(data);
      setMaintenanceDeliveries([...maintenanceDeliveries, res.data]);
      toast.success('Maintenance delivery created successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to create maintenance delivery');
      throw err;
    }
  };

  const updateMaintenanceDelivery = async (id: number, data: MaintenanceTypes.UpdateMaintenanceDeliveryPayload) => {
    try {
      const res = await api.maintenanceDeliveries.update(id, data);
      setMaintenanceDeliveries(maintenanceDeliveries.map((d) => (d.id === id ? res.data : d)));
      toast.success('Maintenance delivery updated successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to update maintenance delivery');
      throw err;
    }
  };

  const confirmMaintenanceDelivery = async (id: number, receivedBy: string) => {
    try {
      const res = await api.maintenanceDeliveries.confirm(id, receivedBy);
      setMaintenanceDeliveries(maintenanceDeliveries.map((d) => (d.id === id ? res.data : d)));
      toast.success('Maintenance delivery confirmed successfully');
      return res.data;
    } catch (err) {
      toast.error('Failed to confirm maintenance delivery');
      throw err;
    }
  };

  const deleteMaintenanceDelivery = async (id: number) => {
    try {
      await api.maintenanceDeliveries.delete(id);
      setMaintenanceDeliveries(maintenanceDeliveries.filter((d) => d.id !== id));
      toast.success('Maintenance delivery deleted successfully');
    } catch (err) {
      toast.error('Failed to delete maintenance delivery');
      throw err;
    }
  };

  const value: DataStoreContextType = useMemo(
    () => ({
    users,
    customers,
    orders,
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
    inventory,
    statuses,
    maintenanceLogs,
    maintenanceCases,
    faultyEntities,
    maintenanceActions,
    maintenanceDeliveries,
    configurationHistory,
    loading,
    hierarchyLoading,
    hierarchyReady,
    hierarchyAttempted,
    error,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getOrder,
    createOrder,
    updateOrder,
    deleteOrder,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    getProjectSystems,
    getSystem,
    createSystem,
    updateSystem,
    deleteSystem,
    getSystemSubsystems,
    getSubsystem,
    createSubsystem,
    updateSubsystem,
    deleteSubsystem,
    getSubsystemModules,
    getModule,
    createModule,
    updateModule,
    deleteModule,
    getModuleUnits,
    getUnit,
    createUnit,
    updateUnit,
    deleteUnit,
    getUnitComponents,
    getComponent,
    createComponent,
    updateComponent,
    deleteComponent,
    getInventoryItem,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    createStatus,
    updateStatus,
    deleteStatus,
    createMaintenanceLog,
    getEntityMaintenanceLogs,
    getEntityStatusHistory,
    getMaintenanceCase,
    createMaintenanceCase,
    updateMaintenanceCase,
    deleteMaintenanceCase,
    lookupEntityBySerialNumber,
    lookupEntityByPartNumber,
    suspectChildren,
    confirmFault,
    getFaultyEntity,
    createFaultyEntity,
    updateFaultyEntity,
    // update_faulty_Children,
    deleteFaultyEntity,
    cascadeFault,
    getEntityMaintenanceHistory,
    getMaintenanceAction,
    createMaintenanceAction,
    updateMaintenanceAction,
    deleteMaintenanceAction,
    getMaintenanceDelivery,
    createMaintenanceDelivery,
    updateMaintenanceDelivery,
    confirmMaintenanceDelivery,
    deleteMaintenanceDelivery,
    getConfigurationHistory,
    getConfigurationHistoryByEntityId,
    getConfigurationHistoryByCaseId,
    createConfigurationHistory,
    updateConfigurationHistory,
    deleteConfigurationHistory,
    refreshData,
    refreshLightweight,
    ensureHierarchyLoaded,
    }),
    [
      users,
      customers,
      orders,
      projects,
      systems,
      subsystems,
      modules,
      units,
      components,
      inventory,
      statuses,
      maintenanceLogs,
      maintenanceCases,
      faultyEntities,
      maintenanceActions,
      maintenanceDeliveries,
      configurationHistory,
      loading,
      hierarchyLoading,
      hierarchyReady,
      hierarchyAttempted,
      error,
      refreshData,
      refreshLightweight,
      ensureHierarchyLoaded,
    ]
  );

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const context = useContext(DataStoreContext);
  if (!context) {
    throw new Error('useDataStore must be used within DataStoreProvider');
  }
  return context;
}
