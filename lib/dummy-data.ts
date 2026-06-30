// ============================================================
// DUMMY DATA - Satellite Lifecycle Management System
// ============================================================

export type EntityStatus =
  | "Available"
  | "Allocated"
  | "Installed"
  | "Testing"
  | "Failed"
  | "Under maintenanceLogs"
  | "Replaced"
  | "Retired";

export type ProjectStatus =
  | "Planning"
  | "Building"
  | "Testing"
  | "Delivered"
  | "maintenanceLogs";

export type OrderStatus = "Pending" | "Approved" | "Rejected";

export type MaintenanceStatus = "Open" | "Resolved" | "Monitoring";

export type UserRole = "Admin" | "Entry Operator" | "Viewer";

// ---------- CUSTOMERS ----------
export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  totalOrders: number;
  status: "Active" | "Inactive";
  address: string;
  phone: string;
}

export const customers: Customer[] = [
  { id: "CUST-001", name: "SpaceX Corp", contact: "Elon M.", email: "contracts@spacex.com", totalOrders: 3, status: "Active", address: "Hawthorne, CA", phone: "+1-310-555-0100" },
  { id: "CUST-002", name: "ISRO", contact: "Dr. Somanath", email: "procurement@isro.gov.in", totalOrders: 2, status: "Active", address: "Bengaluru, India", phone: "+91-80-2217-2000" },
  { id: "CUST-003", name: "ESA", contact: "Josef Aschbacher", email: "contracts@esa.int", totalOrders: 2, status: "Active", address: "Paris, France", phone: "+33-1-5369-7654" },
  { id: "CUST-004", name: "Northrop Grumman", contact: "Blake Larson", email: "space@northropgrumman.com", totalOrders: 2, status: "Active", address: "Falls Church, VA", phone: "+1-703-280-2900" },
  { id: "CUST-005", name: "Airbus Defence", contact: "Michael Schoellhorn", email: "satellites@airbus.com", totalOrders: 1, status: "Inactive", address: "Leiden, Netherlands", phone: "+31-71-524-5600" },
];

// ---------- ORDERS ----------
export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  linkedProjectId: string | null;
  description: string;
}

export const orders: Order[] = [
  { id: "ORD-001", customerId: "CUST-001", customerName: "SpaceX Corp", date: "2025-01-15", status: "Approved", linkedProjectId: "PRJ-001", description: "LEO Communication Satellite" },
  { id: "ORD-002", customerId: "CUST-001", customerName: "SpaceX Corp", date: "2025-02-20", status: "Approved", linkedProjectId: "PRJ-002", description: "Navigation Payload Module" },
  { id: "ORD-003", customerId: "CUST-002", customerName: "ISRO", date: "2025-03-10", status: "Approved", linkedProjectId: "PRJ-003", description: "Earth Observation Satellite" },
  { id: "ORD-004", customerId: "CUST-002", customerName: "ISRO", date: "2025-04-05", status: "Pending", linkedProjectId: "PRJ-004", description: "Mars Orbiter Subsystem" },
  { id: "ORD-005", customerId: "CUST-003", customerName: "ESA", date: "2025-04-18", status: "Approved", linkedProjectId: "PRJ-005", description: "Deep Space Probe Assembly" },
  { id: "ORD-006", customerId: "CUST-003", customerName: "ESA", date: "2025-05-01", status: "Pending", linkedProjectId: null, description: "Solar Panel Array" },
  { id: "ORD-007", customerId: "CUST-004", customerName: "Northrop Grumman", date: "2025-05-20", status: "Approved", linkedProjectId: "PRJ-006", description: "Defense Satellite Bus" },
  { id: "ORD-008", customerId: "CUST-004", customerName: "Northrop Grumman", date: "2025-06-10", status: "Rejected", linkedProjectId: null, description: "Prototype Thruster" },
  { id: "ORD-009", customerId: "CUST-005", customerName: "Airbus Defence", date: "2025-06-25", status: "Pending", linkedProjectId: null, description: "GEO Relay Platform" },
  { id: "ORD-010", customerId: "CUST-001", customerName: "SpaceX Corp", date: "2025-07-01", status: "Approved", linkedProjectId: null, description: "Starlink Batch Module" },
];

// ---------- COMPONENTS ----------
export interface SatComponent {
  id: string;
  name: string;
  status: EntityStatus;
  serialNumber: string;
}

function generateComponents(unitId: string, baseName: string, count: number): SatComponent[] {
  const statuses: EntityStatus[] = ["Available", "Installed", "Testing", "Failed", "Under maintenanceLogs"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${unitId}-CMP-${String(i + 1).padStart(3, "0")}`,
    name: `${baseName} Component ${i + 1}`,
    status: statuses[i % statuses.length],
    serialNumber: `SN-${unitId}-C${String(i + 1).padStart(4, "0")}`,
  }));
}

// ---------- UNITS ----------
export interface Unit {
  id: string;
  name: string;
  status: EntityStatus;
  serialNumber: string;
  components: SatComponent[];
}

function generateUnits(moduleId: string, baseName: string, count: number): Unit[] {
  const statuses: EntityStatus[] = ["Installed", "Available", "Testing", "Under maintenanceLogs", "Failed"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${moduleId}-U-${String(i + 1).padStart(2, "0")}`,
    name: `${baseName} Unit ${i + 1}`,
    status: statuses[i % statuses.length],
    serialNumber: `SN-${moduleId}-U${String(i + 1).padStart(3, "0")}`,
    components: generateComponents(`${moduleId}-U-${String(i + 1).padStart(2, "0")}`, `${baseName} U${i + 1}`, 2 + (i % 3)),
  }));
}

// ---------- MODULES ----------
export interface Module {
  id: string;
  name: string;
  status: EntityStatus;
  serialNumber: string;
  units: Unit[];
}

function generateModules(subsystemId: string, baseName: string, count: number): Module[] {
  const statuses: EntityStatus[] = ["Installed", "Testing", "Available", "Failed", "Under maintenanceLogs"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${subsystemId}-M-${String(i + 1).padStart(2, "0")}`,
    name: `${baseName} Module ${i + 1}`,
    status: statuses[i % statuses.length],
    serialNumber: `SN-${subsystemId}-M${String(i + 1).padStart(3, "0")}`,
    units: generateUnits(`${subsystemId}-M-${String(i + 1).padStart(2, "0")}`, `${baseName} M${i + 1}`, 2),
  }));
}

// ---------- SUBSYSTEMS ----------
export interface Subsystem {
  id: string;
  name: string;
  type: string;
  status: EntityStatus;
  serialNumber: string;
  modules: Module[];
}

function generateSubsystems(systemId: string, baseName: string, types: string[]): Subsystem[] {
  const statuses: EntityStatus[] = ["Installed", "Testing", "Available", "Under maintenanceLogs"];
  return types.map((type, i) => ({
    id: `${systemId}-SS-${String(i + 1).padStart(2, "0")}`,
    name: `${type}`,
    type,
    status: statuses[i % statuses.length],
    serialNumber: `SN-${systemId}-SS${String(i + 1).padStart(3, "0")}`,
    modules: generateModules(`${systemId}-SS-${String(i + 1).padStart(2, "0")}`, type, 2 + (i % 2)),
  }));
}

// ---------- SYSTEMS ----------
export interface System {
  id: string;
  name: string;
  type: string;
  status: EntityStatus;
  serialNumber: string;
  projectId: string;
  subsystems: Subsystem[];
}

export const systems: System[] = [
  // PRJ-001 systems
  { id: "SYS-001", name: "AOCS", type: "AOCS", status: "Installed", serialNumber: "SN-SYS-001", projectId: "PRJ-001", subsystems: generateSubsystems("SYS-001", "AOCS", ["Sensors", "Actuators", "Motors"]) },
  { id: "SYS-002", name: "Power System", type: "EPS", status: "Testing", serialNumber: "SN-SYS-002", projectId: "PRJ-001", subsystems: generateSubsystems("SYS-002", "EPS", ["Solar Array", "Battery Pack", "Power Distribution"]) },
  { id: "SYS-003", name: "Communication", type: "COMM", status: "Installed", serialNumber: "SN-SYS-003", projectId: "PRJ-001", subsystems: generateSubsystems("SYS-003", "COMM", ["Antenna", "Transponder", "Signal Processor"]) },
  { id: "SYS-004", name: "Thermal Control", type: "TCS", status: "Available", serialNumber: "SN-SYS-004", projectId: "PRJ-001", subsystems: generateSubsystems("SYS-004", "TCS", ["Heaters", "Radiators"]) },
  // PRJ-002 systems
  { id: "SYS-005", name: "Navigation Payload", type: "NAV", status: "Installed", serialNumber: "SN-SYS-005", projectId: "PRJ-002", subsystems: generateSubsystems("SYS-005", "NAV", ["GPS Receiver", "Atomic Clock", "Signal Generator"]) },
  { id: "SYS-006", name: "Propulsion", type: "PROP", status: "Testing", serialNumber: "SN-SYS-006", projectId: "PRJ-002", subsystems: generateSubsystems("SYS-006", "PROP", ["Thruster Assembly", "Fuel System"]) },
  { id: "SYS-007", name: "Data Handling", type: "OBC", status: "Installed", serialNumber: "SN-SYS-007", projectId: "PRJ-002", subsystems: generateSubsystems("SYS-007", "OBC", ["Flight Computer", "Memory Unit", "Data Bus"]) },
  // PRJ-003 systems
  { id: "SYS-008", name: "EO Imaging", type: "PAYLOAD", status: "Testing", serialNumber: "SN-SYS-008", projectId: "PRJ-003", subsystems: generateSubsystems("SYS-008", "EO", ["Multispectral Camera", "Infrared Sensor", "Image Processor"]) },
  { id: "SYS-009", name: "Structure", type: "STR", status: "Installed", serialNumber: "SN-SYS-009", projectId: "PRJ-003", subsystems: generateSubsystems("SYS-009", "STR", ["Primary Frame", "Deployment Mechanism"]) },
  { id: "SYS-010", name: "Power System", type: "EPS", status: "Available", serialNumber: "SN-SYS-010", projectId: "PRJ-003", subsystems: generateSubsystems("SYS-010", "EPS", ["Solar Array", "Battery Pack"]) },
  // PRJ-004 systems
  { id: "SYS-011", name: "Mars Comm Relay", type: "COMM", status: "Available", serialNumber: "SN-SYS-011", projectId: "PRJ-004", subsystems: generateSubsystems("SYS-011", "COMM", ["High Gain Antenna", "UHF Relay"]) },
  { id: "SYS-012", name: "Mars Propulsion", type: "PROP", status: "Available", serialNumber: "SN-SYS-012", projectId: "PRJ-004", subsystems: generateSubsystems("SYS-012", "PROP", ["Ion Thruster", "Fuel Management"]) },
  // PRJ-005 systems
  { id: "SYS-013", name: "Deep Space Comm", type: "COMM", status: "Installed", serialNumber: "SN-SYS-013", projectId: "PRJ-005", subsystems: generateSubsystems("SYS-013", "DS-COMM", ["Ka-Band Transmitter", "Receiver Array"]) },
  { id: "SYS-014", name: "Scientific Payload", type: "PAYLOAD", status: "Testing", serialNumber: "SN-SYS-014", projectId: "PRJ-005", subsystems: generateSubsystems("SYS-014", "SCI", ["Spectrometer", "Particle Detector", "Magnetometer"]) },
  { id: "SYS-015", name: "Guidance Navigation", type: "GNC", status: "Installed", serialNumber: "SN-SYS-015", projectId: "PRJ-005", subsystems: generateSubsystems("SYS-015", "GNC", ["Star Tracker", "Gyroscope", "Accelerometer"]) },
  // PRJ-006 systems
  { id: "SYS-016", name: "Defense AOCS", type: "AOCS", status: "Installed", serialNumber: "SN-SYS-016", projectId: "PRJ-006", subsystems: generateSubsystems("SYS-016", "D-AOCS", ["Reaction Wheels", "Magnetorquers"]) },
  { id: "SYS-017", name: "Secure Comm", type: "COMM", status: "Testing", serialNumber: "SN-SYS-017", projectId: "PRJ-006", subsystems: generateSubsystems("SYS-017", "S-COMM", ["Encrypted Transponder", "Secure Antenna", "Crypto Module"]) },
  { id: "SYS-018", name: "Defense Power", type: "EPS", status: "Installed", serialNumber: "SN-SYS-018", projectId: "PRJ-006", subsystems: generateSubsystems("SYS-018", "D-EPS", ["Solar Panel", "Li-Ion Battery"]) },
  { id: "SYS-019", name: "Defense Thermal", type: "TCS", status: "Available", serialNumber: "SN-SYS-019", projectId: "PRJ-006", subsystems: generateSubsystems("SYS-019", "D-TCS", ["MLI Blankets", "Heat Pipes"]) },
  { id: "SYS-020", name: "Surveillance Payload", type: "PAYLOAD", status: "Testing", serialNumber: "SN-SYS-020", projectId: "PRJ-006", subsystems: generateSubsystems("SYS-020", "SURV", ["SAR Radar", "Optical Imager"]) },
];

// ---------- PROJECTS ----------
export interface Project {
  id: string;
  name: string;
  orderId: string;
  status: ProjectStatus;
  deliveryDate: string;
  systemIds: string[];
}

export const projects: Project[] = [
  { id: "PRJ-001", name: "LEO CommSat Alpha", orderId: "ORD-001", status: "Building", deliveryDate: "2025-12-15", systemIds: ["SYS-001", "SYS-002", "SYS-003", "SYS-004"] },
  { id: "PRJ-002", name: "NavSat Bravo", orderId: "ORD-002", status: "Testing", deliveryDate: "2025-10-01", systemIds: ["SYS-005", "SYS-006", "SYS-007"] },
  { id: "PRJ-003", name: "EO Sat Charlie", orderId: "ORD-003", status: "Building", deliveryDate: "2026-03-20", systemIds: ["SYS-008", "SYS-009", "SYS-010"] },
  { id: "PRJ-004", name: "Mars Relay Delta", orderId: "ORD-004", status: "Planning", deliveryDate: "2026-08-01", systemIds: ["SYS-011", "SYS-012"] },
  { id: "PRJ-005", name: "Deep Probe Echo", orderId: "ORD-005", status: "Delivered", deliveryDate: "2025-07-30", systemIds: ["SYS-013", "SYS-014", "SYS-015"] },
  { id: "PRJ-006", name: "DefenseSat Foxtrot", orderId: "ORD-007", status: "maintenanceLogs", deliveryDate: "2025-04-10", systemIds: ["SYS-016", "SYS-017", "SYS-018", "SYS-019", "SYS-020"] },
];

// ---------- maintenanceLogs LOGS ----------
export interface MaintenanceLog {
  id: string;
  projectId: string;
  entityId: string;
  entityType: "System" | "Subsystem" | "Module" | "Unit" | "Component";
  entityName: string;
  faultDescription: string;
  rootCause: string;
  actionTaken: string;
  date: string;
  engineer: string;
  status: MaintenanceStatus;
}

export const maintenanceLogs: MaintenanceLog[] = [
  { id: "MNT-001", projectId: "PRJ-001", entityId: "SYS-001", entityType: "System", entityName: "AOCS", faultDescription: "Gyroscope drift exceeding tolerance", rootCause: "Bearing wear", actionTaken: "Replaced gyroscope bearing assembly", date: "2025-06-10", engineer: "Dr. Sarah Chen", status: "Resolved" },
  { id: "MNT-002", projectId: "PRJ-001", entityId: "SYS-002-SS-02", entityType: "Subsystem", entityName: "Battery Pack", faultDescription: "Cell voltage imbalance", rootCause: "Manufacturing defect in cell 4B", actionTaken: "Replaced defective cell, recalibrated BMS", date: "2025-06-15", engineer: "Raj Patel", status: "Resolved" },
  { id: "MNT-003", projectId: "PRJ-002", entityId: "SYS-006", entityType: "System", entityName: "Propulsion", faultDescription: "Fuel line pressure anomaly", rootCause: "Micro-leak at valve junction", actionTaken: "Sealed junction, pressure test passed", date: "2025-07-01", engineer: "Ana Rodriguez", status: "Monitoring" },
  { id: "MNT-004", projectId: "PRJ-005", entityId: "SYS-014", entityType: "System", entityName: "Scientific Payload", faultDescription: "Spectrometer calibration offset", rootCause: "Thermal expansion of optical bench", actionTaken: "Applied thermal compensation algorithm", date: "2025-07-20", engineer: "Dr. Sarah Chen", status: "Resolved" },
  { id: "MNT-005", projectId: "PRJ-006", entityId: "SYS-017", entityType: "System", entityName: "Secure Comm", faultDescription: "Encryption key rotation failure", rootCause: "Firmware bug in crypto module", actionTaken: "Firmware update applied, keys rotated", date: "2025-08-01", engineer: "James Walker", status: "Resolved" },
  { id: "MNT-006", projectId: "PRJ-006", entityId: "SYS-020", entityType: "System", entityName: "Surveillance Payload", faultDescription: "SAR image artifacts", rootCause: "Antenna misalignment after vibration test", actionTaken: "Realigned antenna, retested", date: "2025-08-10", engineer: "Ana Rodriguez", status: "Monitoring" },
  { id: "MNT-007", projectId: "PRJ-003", entityId: "SYS-008-SS-01", entityType: "Subsystem", entityName: "Multispectral Camera", faultDescription: "Lens contamination detected", rootCause: "Cleanroom protocol breach", actionTaken: "Lens cleaned in ISO-5 environment", date: "2025-08-15", engineer: "Raj Patel", status: "Resolved" },
  { id: "MNT-008", projectId: "PRJ-001", entityId: "SYS-003-SS-02", entityType: "Subsystem", entityName: "Transponder", faultDescription: "Signal attenuation on channel 3", rootCause: "Connector corrosion", actionTaken: "Replaced RF connector, retested all channels", date: "2025-09-01", engineer: "James Walker", status: "Open" },
  { id: "MNT-009", projectId: "PRJ-002", entityId: "SYS-005-SS-02", entityType: "Subsystem", entityName: "Atomic Clock", faultDescription: "Frequency drift exceeding 1ppb", rootCause: "Temperature controller malfunction", actionTaken: "Replaced TEC module, recalibrated", date: "2025-09-10", engineer: "Dr. Sarah Chen", status: "Open" },
  { id: "MNT-010", projectId: "PRJ-006", entityId: "SYS-016-SS-01", entityType: "Subsystem", entityName: "Reaction Wheels", faultDescription: "Vibration anomaly at 4000 RPM", rootCause: "Imbalance in flywheel", actionTaken: "Wheel replacement scheduled", date: "2025-09-15", engineer: "Ana Rodriguez", status: "Open" },
];

// ---------- INVENTORY ----------
export interface InventoryItem {
  id: string;
  name: string;
  type: "System" | "Subsystem" | "Module" | "Unit" | "Component";
  serialNumber: string;
  status: EntityStatus;
  quantity: number;
  assignedProject: string | null;
  location: string;
  lastMaintenanceDate: string | null;
}

export const inventory: InventoryItem[] = [
  { id: "INV-001", name: "Reaction Wheel RW-200", type: "Unit", serialNumber: "SN-RW-200-001", status: "Available", quantity: 12, assignedProject: null, location: "Warehouse A-1", lastMaintenanceDate: null },
  { id: "INV-002", name: "Star Tracker ST-500", type: "Unit", serialNumber: "SN-ST-500-001", status: "Available", quantity: 8, assignedProject: null, location: "Warehouse A-2", lastMaintenanceDate: "2025-05-01" },
  { id: "INV-003", name: "Solar Panel SP-3K", type: "Subsystem", serialNumber: "SN-SP-3K-001", status: "Allocated", quantity: 4, assignedProject: "PRJ-003", location: "Clean Room B-1", lastMaintenanceDate: null },
  { id: "INV-004", name: "Li-Ion Battery Pack", type: "Subsystem", serialNumber: "SN-LIB-001", status: "Installed", quantity: 6, assignedProject: "PRJ-001", location: "Integration Bay", lastMaintenanceDate: "2025-06-15" },
  { id: "INV-005", name: "Ka-Band Transponder", type: "Module", serialNumber: "SN-KBT-001", status: "Testing", quantity: 3, assignedProject: "PRJ-005", location: "Test Lab C-1", lastMaintenanceDate: null },
  { id: "INV-006", name: "Gyroscope MEMS-G1", type: "Component", serialNumber: "SN-MEMS-G1-001", status: "Available", quantity: 25, assignedProject: null, location: "Warehouse A-3", lastMaintenanceDate: null },
  { id: "INV-007", name: "Thruster Assembly TA-50", type: "System", serialNumber: "SN-TA50-001", status: "Under maintenanceLogs", quantity: 2, assignedProject: "PRJ-002", location: "maintenanceLogs Bay", lastMaintenanceDate: "2025-07-01" },
  { id: "INV-008", name: "Flight Computer FC-X", type: "Module", serialNumber: "SN-FCX-001", status: "Installed", quantity: 4, assignedProject: "PRJ-002", location: "Integration Bay", lastMaintenanceDate: null },
  { id: "INV-009", name: "Crypto Module CM-SEC", type: "Module", serialNumber: "SN-CMSEC-001", status: "Installed", quantity: 3, assignedProject: "PRJ-006", location: "Secure Room D-1", lastMaintenanceDate: "2025-08-01" },
  { id: "INV-010", name: "SAR Antenna Feed", type: "Component", serialNumber: "SN-SAR-AF-001", status: "Failed", quantity: 1, assignedProject: "PRJ-006", location: "Test Lab C-2", lastMaintenanceDate: "2025-08-10" },
  { id: "INV-011", name: "Temperature Sensor TS-100", type: "Component", serialNumber: "SN-TS100-001", status: "Available", quantity: 50, assignedProject: null, location: "Warehouse A-1", lastMaintenanceDate: null },
  { id: "INV-012", name: "MLI Blanket Kit", type: "Module", serialNumber: "SN-MLI-001", status: "Available", quantity: 15, assignedProject: null, location: "Warehouse B-2", lastMaintenanceDate: null },
  { id: "INV-013", name: "Data Bus Controller", type: "Unit", serialNumber: "SN-DBC-001", status: "Allocated", quantity: 5, assignedProject: "PRJ-002", location: "Clean Room B-1", lastMaintenanceDate: null },
  { id: "INV-014", name: "IR Sensor Array", type: "Module", serialNumber: "SN-IRSA-001", status: "Testing", quantity: 2, assignedProject: "PRJ-003", location: "Test Lab C-1", lastMaintenanceDate: null },
  { id: "INV-015", name: "Magnetorquer Bar MT-10", type: "Unit", serialNumber: "SN-MT10-001", status: "Available", quantity: 18, assignedProject: null, location: "Warehouse A-2", lastMaintenanceDate: "2025-04-20" },
  { id: "INV-016", name: "Propellant Tank PT-200", type: "Subsystem", serialNumber: "SN-PT200-001", status: "Available", quantity: 3, assignedProject: null, location: "Hazmat Storage E-1", lastMaintenanceDate: null },
  { id: "INV-017", name: "Optical Bench Assembly", type: "System", serialNumber: "SN-OBA-001", status: "Installed", quantity: 1, assignedProject: "PRJ-005", location: "Integration Bay", lastMaintenanceDate: "2025-07-20" },
  { id: "INV-018", name: "Power Distribution Unit", type: "Module", serialNumber: "SN-PDU-001", status: "Available", quantity: 7, assignedProject: null, location: "Warehouse A-1", lastMaintenanceDate: null },
  { id: "INV-019", name: "Deployment Hinge DH-5", type: "Component", serialNumber: "SN-DH5-001", status: "Available", quantity: 30, assignedProject: null, location: "Warehouse A-3", lastMaintenanceDate: null },
  { id: "INV-020", name: "RF Switch Matrix", type: "Unit", serialNumber: "SN-RFSM-001", status: "Retired", quantity: 2, assignedProject: null, location: "Archive Storage", lastMaintenanceDate: "2025-03-10" },
];

// ---------- USERS ----------
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "Active" | "Inactive";
}

export const users: User[] = [
  { id: "USR-001", name: "Admin User", email: "admin@satlife.com", role: "Admin", status: "Active" },
  { id: "USR-002", name: "Dr. Sarah Chen", email: "sarah.chen@satlife.com", role: "Entry Operator", status: "Active" },
  { id: "USR-003", name: "Raj Patel", email: "raj.patel@satlife.com", role: "Entry Operator", status: "Active" },
  { id: "USR-004", name: "Ana Rodriguez", email: "ana.rodriguez@satlife.com", role: "Entry Operator", status: "Active" },
  { id: "USR-005", name: "James Walker", email: "james.walker@satlife.com", role: "Viewer", status: "Active" },
  { id: "USR-006", name: "Emily Tanaka", email: "emily.tanaka@satlife.com", role: "Viewer", status: "Inactive" },
];

// ---------- HIERARCHY RULES ----------
export interface HierarchyRule {
  systemType: string;
  allowedSubsystems: string[];
}

export const hierarchyRules: HierarchyRule[] = [
  { systemType: "AOCS", allowedSubsystems: ["Sensors", "Actuators", "Motors", "Reaction Wheels", "Magnetorquers"] },
  { systemType: "EPS", allowedSubsystems: ["Solar Array", "Battery Pack", "Power Distribution", "Solar Panel", "Li-Ion Battery"] },
  { systemType: "COMM", allowedSubsystems: ["Antenna", "Transponder", "Signal Processor", "High Gain Antenna", "UHF Relay", "Encrypted Transponder", "Secure Antenna", "Crypto Module"] },
  { systemType: "TCS", allowedSubsystems: ["Heaters", "Radiators", "MLI Blankets", "Heat Pipes"] },
  { systemType: "PROP", allowedSubsystems: ["Thruster Assembly", "Fuel System", "Ion Thruster", "Fuel Management"] },
  { systemType: "OBC", allowedSubsystems: ["Flight Computer", "Memory Unit", "Data Bus"] },
  { systemType: "NAV", allowedSubsystems: ["GPS Receiver", "Atomic Clock", "Signal Generator"] },
  { systemType: "PAYLOAD", allowedSubsystems: ["Multispectral Camera", "Infrared Sensor", "Image Processor", "SAR Radar", "Optical Imager", "Spectrometer", "Particle Detector", "Magnetometer"] },
  { systemType: "STR", allowedSubsystems: ["Primary Frame", "Deployment Mechanism"] },
  { systemType: "GNC", allowedSubsystems: ["Star Tracker", "Gyroscope", "Accelerometer"] },
];

// ---------- CHART DATA ----------
export const projectStatusData = [
  { name: "Planning", value: 1, fill: "var(--color-chart-4)" },
  { name: "Building", value: 2, fill: "var(--color-chart-1)" },
  { name: "Testing", value: 1, fill: "var(--color-chart-2)" },
  { name: "Delivered", value: 1, fill: "var(--color-chart-3)" },
  { name: "maintenanceLogs", value: 1, fill: "var(--color-chart-5)" },
];

export const monthlyOrdersData = [
  { month: "Jan", orders: 1 },
  { month: "Feb", orders: 1 },
  { month: "Mar", orders: 1 },
  { month: "Apr", orders: 2 },
  { month: "May", orders: 2 },
  { month: "Jun", orders: 2 },
  { month: "Jul", orders: 1 },
];

export const inventoryDistributionData = [
  { type: "System", count: 2 },
  { type: "Subsystem", count: 3 },
  { type: "Module", count: 6 },
  { type: "Unit", count: 5 },
  { type: "Component", count: 4 },
];
