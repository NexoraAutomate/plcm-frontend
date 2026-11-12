export type OverviewPathStep = {
  step: string;
  title: string;
  body: string;
  owners: string;
};

export type OverviewTabGuide = {
  tabId: 'roles' | 'workflow' | 'tutorial' | 'inventory' | 'maintenance' | 'quiz';
  label: string;
  body: string;
};

export type OverviewConcept = {
  title: string;
  body: string;
};

export type OverviewQuickLink = {
  label: string;
  href: string;
  body: string;
};

export const OVERVIEW_INTRO = [
  'PLCM (Product Lifecycle Control) is the SatLife application for tracking a complex product from an approved configuration through inventory, installation, verification, and later maintenance.',
  'Its job is to keep one connected record of what was approved, which serials were reserved and issued, what was installed and verified, and what happened if something failed in the field.',
  'When someone asks “exactly what went into this system?”, the answer should come from PLCM — not from spreadsheets, email threads, or handwritten notes.',
  'Different people use different parts of the app (Definitions, Projects, Inventory, My Assignments, Maintenance), but they all contribute to the same lifecycle story.',
] as const;

export const OVERVIEW_PATH: OverviewPathStep[] = [
  {
    step: '1',
    title: 'Definitions & Hierarchy Configuration',
    body: 'Admins set up Entity List and Labels & Templates, then create and approve a Hierarchy Configuration — the product template projects will use.',
    owners: 'Usually Admin',
  },
  {
    step: '2',
    title: 'Customer → Order → Project',
    body: 'Commercial work is linked as Customer, then Order, then Project. The Project holds the selected Hierarchy Configuration and sizing (for example Flight / SDLS).',
    owners: 'Usually Admin, Project Director, Hierarchy Manager',
  },
  {
    step: '3',
    title: 'Generate Hierarchy',
    body: 'After the Project is approved, Generate Hierarchy creates the live product tree (Systems down through Components) so build and inventory work have real nodes to attach to.',
    owners: 'Usually Hierarchy Manager (after Admin / PD approval)',
  },
  {
    step: '4',
    title: 'Reserve → Issue → Install / Verify',
    body: 'The Hierarchy Manager reserves serials against hierarchy nodes. The Inventory Manager issues them from the Issue Queue with custody. Developers install and test; the Hierarchy Manager verifies on the happy path toward INSTALLED VERIFIED.',
    owners: 'Usually HM, IM, Developer',
  },
  {
    step: '5',
    title: 'Maintenance (MMHD)',
    body: 'If something fails in the field, a maintenance case starts with an Occurrence Report. Soft fix / NFF can exit early; a confirmed fault opens Track A (replacement) and Track B (faulty return) in parallel.',
    owners: 'Usually FSE, ME, IM, IE, Project Director',
  },
];

export const OVERVIEW_TAB_GUIDE: OverviewTabGuide[] = [
  {
    tabId: 'roles',
    label: 'Roles',
    body: 'Who does what across the eight workflow roles. Cards for your account appear first.',
  },
  {
    tabId: 'workflow',
    label: 'Workflow diagram',
    body: 'A map of the end-to-end build path. Expand phases and hover nodes for short tips.',
  },
  {
    tabId: 'tutorial',
    label: 'Step-by-step tutorial',
    body: 'Recommended learning order with links into the live screens.',
  },
  {
    tabId: 'inventory',
    label: 'Inventory management',
    body: 'Reservations, shortages, issue / labels / custody, returns, and serial statuses.',
  },
  {
    tabId: 'maintenance',
    label: 'Maintenance (MMHD)',
    body: 'Occurrence Report, Soft / NFF exits, and Track A / Track B after a confirmed fault.',
  },
  {
    tabId: 'quiz',
    label: 'Quiz',
    body: 'Check your understanding with scored questions from each learning section.',
  },
];

export const OVERVIEW_CONCEPTS: OverviewConcept[] = [
  {
    title: 'Hierarchy Configuration vs generated hierarchy',
    body: 'A Hierarchy Configuration is the approved template. Generate Hierarchy turns that template into the live Project tree you reserve against and install into.',
  },
  {
    title: 'Inventory Instance, groups, and Storage Locations',
    body: 'Inventory groups describe catalog / structure. Inventory Instances are the serial-numbered items you reserve, issue, and scan. Storage Locations are where those serials sit in the warehouse.',
  },
  {
    title: 'Happy-path statuses',
    body: 'A common path for a serial is AVAILABLE → RESERVED → ISSUED → INSTALLATION IN PROGRESS → UNDER TESTING REVIEW → INSTALLED VERIFIED. Returns and defects leave this path.',
  },
  {
    title: 'BHD vs MMHD',
    body: 'BHD is build / hierarchy delivery work (My Assignments → BHD). MMHD is maintenance after a field fault (My Assignments → MMHD and Maintenance cases).',
  },
  {
    title: 'Occurrence Report, Track A, Track B',
    body: 'The Occurrence Report captures field facts. Track A gets a replacement out quickly; Track B inspects the faulty returned unit. Soft / NFF can close without both tracks.',
  },
];

export const OVERVIEW_QUICK_LINKS: OverviewQuickLink[] = [
  {
    label: 'Definitions',
    href: '/definitions',
    body: 'Entity List, Labels & Templates, and Hierarchy Configurations.',
  },
  {
    label: 'Projects',
    href: '/projects',
    body: 'Draft, approve, generate hierarchy, and reserve inventory.',
  },
  {
    label: 'Inventory',
    href: '/inventory',
    body: 'Serials, storage, and related inventory screens.',
  },
  {
    label: 'Issue Queue',
    href: '/issue-queue',
    body: 'Where reserved items are issued with signature / custody.',
  },
  {
    label: 'My Assignments',
    href: '/my-assignments',
    body: 'Your BHD and MMHD work lists.',
  },
  {
    label: 'Maintenance',
    href: '/maintenance',
    body: 'Maintenance cases, returned units, and related MMHD screens.',
  },
];
