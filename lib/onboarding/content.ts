import type { WorkflowRoleCode } from '@/lib/workflow-roles';

export type OnboardingRole = {
  code: WorkflowRoleCode;
  label: string;
  shortLabel: string;
  /** Tailwind-friendly tint classes for cards / chips */
  badgeClass: string;
  ringClass: string;
  /** Hex used in Mermaid classDef */
  color: string;
  summary: string;
  responsibilities: string[];
};

export type TutorialLink = {
  label: string;
  href: string;
};

export type TutorialStep = {
  id: string;
  title: string;
  summary: string;
  roles: WorkflowRoleCode[];
  details: string[];
  links: TutorialLink[];
};

export type TocItem = {
  id: string;
  label: string;
};

/** Distinct, readable role colors (border + soft fill; no neon glow). */
export const ONBOARDING_ROLES: OnboardingRole[] = [
  {
    code: 'ADMIN',
    label: 'Administrator',
    shortLabel: 'Admin',
    badgeClass: 'border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-100',
    ringClass: 'ring-slate-500/50',
    color: '#64748b',
    summary:
      'Sets up PLCM so everyone else can work. Admins define what product levels exist, approve Hierarchy Configurations and projects, and manage users, roles, statuses, and Settings.',
    responsibilities: [
      'Keep Definitions → Entity List and Labels & Templates up to date so product levels and ID patterns stay consistent',
      'Create Hierarchy Configurations (the product templates) and approve them before projects can use them',
      'Approve projects and Config Changes when the approved structure needs to change',
      'Manage users, roles, statuses, and application Settings so people have the right access',
    ],
  },
  {
    code: 'PD',
    label: 'Project Director',
    shortLabel: 'PD',
    badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100',
    ringClass: 'ring-sky-500/50',
    color: '#0284c7',
    summary:
      'Oversees delivery for a project. The Project Director assigns a Hierarchy Manager, approves or cancels work, and makes key yes/no decisions during Maintenance (MMHD) replacement and verification.',
    responsibilities: [
      'Assign a Hierarchy Manager (HM) so someone owns building the product tree',
      'Approve or cancel projects — canceling can trigger a controlled recall of reserved or issued inventory',
      'Approve or reject replacement requests and AIT (Acceptance / Integration Test) uploads in Maintenance',
      'Assign Inspection Engineers and verify repair or test outcomes before a case can close cleanly',
    ],
  },
  {
    code: 'HM',
    label: 'Hierarchy Manager',
    shortLabel: 'HM',
    badgeClass: 'border-teal-500/40 bg-teal-500/10 text-teal-900 dark:text-teal-100',
    ringClass: 'ring-teal-500/50',
    color: '#0d9488',
    summary:
      'Builds and runs the product tree for a project. After a Hierarchy Configuration is approved, the HM generates the hierarchy, reserves inventory, assigns people, and verifies installations.',
    responsibilities: [
      'Draft a Project / Flight from an approved Hierarchy Configuration (status starts as DRAFT)',
      'Run Generate Hierarchy after approval so Systems → Components appear in the tree',
      'Reserve inventory against Flight → SDLS / hierarchy nodes so the right serials are held for the build',
      'Assign Developers (and Maintenance Engineers on MMHD paths) and verify completed installations',
      'Request Config Changes when the live tree must diverge from the approved template',
    ],
  },
  {
    code: 'IM',
    label: 'Inventory Manager',
    shortLabel: 'IM',
    badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
    ringClass: 'ring-amber-500/50',
    color: '#d97706',
    summary:
      'Runs the warehouse side of PLCM. The Inventory Manager receives stock, clears shortages, issues labeled serials with custody, and decides what happens to returned items.',
    responsibilities: [
      'Receive stock into Storage Locations and keep Inventory Instances (serials) and labels accurate',
      'Work the Shortages queue (first-come, first-served) so waiting reservations can finish',
      'Issue reserved items from the Issue Queue to Developers, with signature / custody and labels as needed',
      'Inspect returned items and mark them REUSABLE, REPAIRABLE, or SCRAPPED',
      'Handle Maintenance reception, discard, and restock of faulty units on the MMHD path',
    ],
  },
  {
    code: 'DEV',
    label: 'Developer',
    shortLabel: 'Dev',
    badgeClass: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100',
    ringClass: 'ring-indigo-500/50',
    color: '#4f46e5',
    summary:
      'Does the hands-on build work on assigned hierarchy nodes. Developers receive issued serials, install parts, run tests, and report results for Hierarchy Manager verification.',
    responsibilities: [
      'Open My Assignments → BHD to see issued or reserved work assigned to you',
      'Request or receive issued serials, and use Scan Label when you need to look up a labeled item',
      'Install components and mark installation as in progress in the app',
      'Run tests (Pass / Fail) and hand the work to the Hierarchy Manager for verification',
      'Report defects so the item can enter the rework loop instead of staying on the happy path',
    ],
  },
  {
    code: 'ME',
    label: 'Maintenance Engineer',
    shortLabel: 'ME',
    badgeClass: 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100',
    ringClass: 'ring-rose-500/50',
    color: '#e11d48',
    summary:
      'Owns Track A in Maintenance (MMHD): getting a replacement into the field quickly after a confirmed fault, then proving the work with AIT evidence.',
    responsibilities: [
      'Take custody of the replacement serial after the Inventory Manager issues it',
      'Perform the site replace / integrate step (often with Field Service Engineer support)',
      'Upload AIT evidence so the Project Director can approve or reject the result',
      'Close Track A after an approved AIT — the overall case still waits on Track B when both tracks are open',
    ],
  },
  {
    code: 'FSE',
    label: 'Field Service Engineer',
    shortLabel: 'FSE',
    badgeClass: 'border-orange-500/40 bg-orange-500/10 text-orange-950 dark:text-orange-100',
    ringClass: 'ring-orange-500/50',
    color: '#ea580c',
    summary:
      'Captures what happened in the field and helps with on-site replacement. Field Service Engineers often appear on the Occurrence Report and support the Maintenance Engineer during replace / integrate.',
    responsibilities: [
      'Appear as officers on the Occurrence Report so field responsibility is recorded',
      'Help with the confirmation channel and add field notes or attachments when something fails',
      'Assist the Maintenance Engineer with site replace and integrate activities',
      'Use Scan Label when custody tracking needs a label check in the field',
    ],
  },
  {
    code: 'IE',
    label: 'Inspection Engineer',
    shortLabel: 'IE',
    badgeClass: 'border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-100',
    ringClass: 'ring-violet-500/50',
    color: '#7c3aed',
    summary:
      'Owns Track B in Maintenance (MMHD): inspecting the faulty returned unit, deciding disposition, and supporting repair, warranty, or discard before restock or scrap.',
    responsibilities: [
      'Request handover of the faulty unit from the Inventory Manager after reception',
      'Inspect the unit and choose a disposition such as repairable, warranty, or discard recommend',
      'Perform or evidence repair work when the unit is dispositioned for repair',
      'Support Project Director verification before restock or discard closes Track B',
    ],
  },
];

export const ONBOARDING_TOC: TocItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'roles', label: 'Roles' },
  { id: 'workflow', label: 'Workflow diagram' },
  { id: 'tutorial', label: 'Step-by-step tutorial' },
  { id: 'inventory', label: 'Inventory management' },
  { id: 'maintenance', label: 'Maintenance (MMHD)' },
  { id: 'quiz', label: 'Quiz' },
];

/** Slide presentation kept for later: components/onboarding/overview-presentation.tsx + lib/onboarding/overview.ts */

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'definitions',
    title: 'Create Entity definitions & labels',
    summary:
      'Before you build anything, PLCM needs a shared vocabulary. Under Definitions, Entity List is the master catalog of hierarchy entity names (the kinds of nodes in a product tree). Labels & Templates set how those levels are named, abbreviated, and given IDs.',
    roles: ['ADMIN'],
    details: [
      'Open Definitions → Entity List and make sure every level you will use in a product tree exists in the catalog.',
      'Open Definitions → Labels & Templates to set display names, abbreviations, and ID patterns people will see on screens and labels.',
      'Later Hierarchy Configurations and generated trees pull from these definitions, so fixing them early avoids confusion downstream.',
    ],
    links: [
      { label: 'Entity List', href: '/definitions/entity-list' },
      { label: 'Labels & Templates', href: '/definitions/labels' },
    ],
  },
  {
    id: 'configurations',
    title: 'Define Hierarchy Configurations',
    summary:
      'A Hierarchy Configuration is a named, approvable product template. It describes how a project’s tree should be built (which levels, how they nest) before anyone generates a live hierarchy.',
    roles: ['ADMIN'],
    details: [
      'Create a Hierarchy Configuration using the Entity List catalog and Labels & Templates rules.',
      'Submit it for approval. Projects can only pick configurations that are approved / available.',
      'If the live tree later needs to diverge, that goes through Config Changes (Admin / Project Director approve) instead of editing quietly.',
    ],
    links: [
      { label: 'Configurations', href: '/definitions/configurations' },
      { label: 'Config Changes', href: '/config-changes' },
    ],
  },
  {
    id: 'commercial',
    title: 'Create Customer, Order, then Project',
    summary:
      'Commercial work follows Customer → Order → Project. The Project is where you attach an approved Hierarchy Configuration and sizing (for example product / Flight / SDLS) so build work has a home.',
    roles: ['ADMIN', 'PD', 'HM'],
    details: [
      'Create the Customer first, then create an Order under that customer.',
      'Create a Project linked to the Order — this is the container for hierarchy and inventory work.',
      'The Project Director assigns a Hierarchy Manager; the HM drafts the Project / Flight from an approved Hierarchy Configuration (status DRAFT).',
    ],
    links: [
      { label: 'Customers', href: '/customers' },
      { label: 'Orders', href: '/orders' },
      { label: 'Projects', href: '/projects' },
    ],
  },
  {
    id: 'approve-generate',
    title: 'Approve project & generate hierarchy',
    summary:
      'A draft project cannot be built against until it is approved. Approval unlocks Generate Hierarchy, which creates the live tree from the selected Hierarchy Configuration so inventory and install work can begin.',
    roles: ['ADMIN', 'PD', 'HM'],
    details: [
      'An Administrator or Project Director approves the draft (status moves DRAFT → APPROVED).',
      'The Hierarchy Manager runs Generate Hierarchy (status moves toward HIERARCHY GENERATED → READY FOR INVENTORY).',
      'Browse the generated tree under Project Hierarchy (Systems down through Components) to confirm the structure looks right.',
    ],
    links: [
      { label: 'Projects', href: '/projects' },
      { label: 'Hierarchy Dashboard', href: '/hierarchy-dashboard' },
    ],
  },
  {
    id: 'reserve',
    title: 'Reserve inventory (and clear shortages)',
    summary:
      'Reservation holds specific serials for the build. The Hierarchy Manager reserves Inventory Instances against Flight → SDLS / hierarchy nodes. If stock is short, Shortages appear for the Inventory Manager; reservations can also expire and auto-release back to AVAILABLE.',
    roles: ['HM', 'IM'],
    details: [
      'From the Project, open Reserve Inventory and lock AVAILABLE serials to the right nodes (status becomes RESERVED).',
      'If there is not enough stock, shortages show on the Shortages page so the Inventory Manager can receive stock and fulfill them first-come, first-served.',
      'Watch reservation expiry windows (for example a hold period plus grace) so stale RESERVED stock returns to AVAILABLE automatically.',
    ],
    links: [
      { label: 'Projects', href: '/projects' },
      { label: 'Shortages', href: '/shortages' },
      { label: 'Inventory', href: '/inventory' },
    ],
  },
  {
    id: 'issue',
    title: 'Issue to Developer',
    summary:
      'Issuing is how reserved parts leave the warehouse and reach the person who will install them. The Inventory Manager completes issue from the Issue Queue with signature / custody, and labeled serials can be checked later with Scan Label.',
    roles: ['IM', 'HM', 'DEV'],
    details: [
      'The Hierarchy Manager assigns a Developer where required; items waiting to leave the warehouse appear in the Issue Queue.',
      'The Inventory Manager completes issue (RESERVED → ISSUED), captures signature / custody, and prints or uses labels (QR / barcode) as needed.',
      'The Developer then sees the work under My Assignments → BHD. Past issues are listed under Inventory → Issuances, and Scan Label looks up a labeled serial when you need to confirm what you are holding.',
    ],
    links: [
      { label: 'Issue Queue', href: '/issue-queue' },
      { label: 'BHD assignments', href: '/my-assignments/bhd' },
      { label: 'Scan Label', href: '/scan' },
      { label: 'Issuances', href: '/inventory/issuances' },
    ],
  },
  {
    id: 'install-verify',
    title: 'Install, test, and verify',
    summary:
      'After issue, the Developer installs and tests; the Hierarchy Manager verifies. That handoff is what turns “someone fitted a part” into a trusted, recorded result on the happy path toward project completion.',
    roles: ['DEV', 'HM'],
    details: [
      'The Developer marks installation in progress, then moves into under testing / review when ready.',
      'A Pass plus Hierarchy Manager verification reaches INSTALLED VERIFIED — the happy-path terminal status.',
      'A Fail or defect enters the rework loop instead of staying on the verified path.',
      'Hierarchy Managers work the Verify Installations queue to confirm installs that are waiting on them.',
    ],
    links: [
      { label: 'BHD assignments', href: '/my-assignments/bhd' },
      { label: 'Verify Installations', href: '/verify-queue' },
    ],
  },
  {
    id: 'branches',
    title: 'Rework, recall, and config changes',
    summary:
      'Not every build is a straight line. Failed tests can loop into rework, canceling a project can recall inventory, and changing the approved structure needs Config Changes — with an Audit Trail recording who did what.',
    roles: ['DEV', 'HM', 'IM', 'PD', 'ADMIN'],
    details: [
      'Defect / rework: failed tests send items toward repair or re-issue paths instead of INSTALLED VERIFIED.',
      'Project cancel / recall: reserved or issued stock is pulled back under controlled status transitions so the warehouse stays accurate.',
      'Config change: the Hierarchy Manager requests a change; an Administrator or Project Director approves it on Config Changes before the live tree diverges.',
      'Audit Trail keeps an actor-and-role record of these mutations when you need to explain what happened later.',
    ],
    links: [
      { label: 'Config Changes', href: '/config-changes' },
      { label: 'Audit Trail', href: '/audit' },
      { label: 'Inspect Queue', href: '/inspect-queue' },
    ],
  },
  {
    id: 'mmhd',
    title: 'Maintenance (MMHD) after field fault',
    summary:
      'When something fails in the field, Maintenance (MMHD) starts with an Occurrence Report. Soft fix / NFF can exit early; a confirmed fault opens dual tracks — Track A (immediate replacement) and Track B (faulty return inspection) in parallel.',
    roles: ['FSE', 'ME', 'PD', 'IM', 'IE', 'HM'],
    details: [
      'Open or continue a maintenance case and fill in the Occurrence Report (occurrence date, officers, fault type, attachments).',
      'Soft fix, NFF (no fault found), or inconclusive outcomes can close without opening both tracks.',
      'When a fault is identified, Track A (ME / PD / IM / FSE) and Track B (IM / IE / PD) run in parallel so the customer is not left waiting while the returned unit is inspected.',
      'Case close waits for Track A AIT pass and a terminal Track B disposition (unless Soft / NFF exited early).',
      'Day-to-day MMHD work also appears under My Assignments → MMHD.',
    ],
    links: [
      { label: 'Maintenance cases', href: '/maintenance' },
      { label: 'MMHD Assignments', href: '/my-assignments/mmhd' },
      { label: 'Returned Units', href: '/maintenance/returned-units' },
      { label: 'Warranty claims', href: '/maintenance/warranty-claims' },
    ],
  },
];

export const INVENTORY_STATUS_HAPPY = [
  {
    status: 'AVAILABLE',
    meaning: 'In stock and free — anyone eligible can reserve this serial for a build.',
  },
  {
    status: 'RESERVED',
    meaning: 'Held for a specific Flight → SDLS / hierarchy node so it cannot be taken for something else.',
  },
  {
    status: 'ISSUED',
    meaning: 'Physically handed to a Developer (or other assignee) with custody recorded.',
  },
  {
    status: 'INSTALLATION IN PROGRESS',
    meaning: 'Install work has started on this serial (or the system moved it here after issue dwell).',
  },
  {
    status: 'UNDER TESTING REVIEW',
    meaning: 'Installed and now being tested or reviewed before verification.',
  },
  {
    status: 'INSTALLED VERIFIED',
    meaning: 'Passed testing and Hierarchy Manager verification — happy-path terminal status.',
  },
] as const;

export const INVENTORY_STATUS_RETURN = [
  {
    status: 'RETURNED',
    meaning: 'Back with the Inventory Manager, waiting for inspection / disposition.',
  },
  {
    status: 'INSPECTION',
    meaning: 'The Inventory Manager is actively inspecting what came back.',
  },
  {
    status: 'REUSABLE',
    meaning: 'Safe to put back into stock as AVAILABLE after disposition.',
  },
  {
    status: 'REPAIRABLE',
    meaning: 'Needs repair before it can be considered for reuse.',
  },
  {
    status: 'SCRAPPED',
    meaning: 'Permanently removed from usable stock for that unit.',
  },
] as const;

export const INVENTORY_GUIDE_POINTS = [
  {
    title: 'Stock model',
    body: 'Think of Inventory in two layers. Inventory groups describe the catalog / structure of what you keep. Inventory Instances are the individual serial-numbered items you actually reserve, issue, and scan. Storage Locations are where those serials sit in the warehouse so people know where to find them.',
  },
  {
    title: 'Reservation & shortage',
    body: 'The Hierarchy Manager reserves serials against hierarchy nodes so the build has dedicated stock. If there is not enough quantity, a shortage is queued on Shortages. The Inventory Manager receives stock and fulfills shortages first-come, first-served so waiting reservations can complete. If a reservation sits too long, expiry / auto-release can return stale RESERVED stock to AVAILABLE.',
  },
  {
    title: 'Issue, labels & custody',
    body: 'When a reserved item is ready to leave the warehouse, the Inventory Manager opens the Issue Queue and issues it to the assigned person. Issuing records signature / custody so PLCM knows who took physical responsibility for the serial. Labels (QR / barcode) can be printed and later checked with Scan Label. A history of what was issued lives under Inventory → Issuances.',
  },
  {
    title: 'Returns & inspect',
    body: 'Items that leave the happy path can come back as RETURNED, then move into INSPECTION. The Inventory Manager dispositions each unit as REUSABLE, REPAIRABLE, or SCRAPPED. If a project is canceled, a controlled recall can pull reserved or issued stock back so warehouse records stay honest.',
  },
] as const;

export const MAINTENANCE_GUIDE_POINTS = [
  {
    title: 'Augment, do not replace',
    body: 'Maintenance (MMHD) does not throw away the rest of PLCM. It adds an Occurrence Report and dual-track replacement / inspection on top of paths you may already use — soft-fix, investigation, Inventory Manager rework, warranty, and delivery close.',
  },
  {
    title: 'Occurrence Report',
    body: 'The Occurrence Report is the field story for the case. It records the occurrence date (which can differ from when the system logged the record), officers (often a Field Service Engineer), fault type, confirmation channel, and named attachments. Soft fix, NFF, or inconclusive outcomes can exit early without opening both tracks.',
  },
  {
    title: 'Track A — immediate replacement',
    body: 'Track A gets a working replacement to the customer quickly. Typical flow: replacement request → Project Director approve → Inventory Manager issue serial → site replace (Maintenance Engineer, often with Field Service Engineer) → AIT upload → Project Director approve / reject loop → Track A closed.',
  },
  {
    title: 'Track B — faulty return',
    body: 'Track B handles the unit that came back. Typical flow: Inventory Manager reception → Inspection Engineer assign → issue to IE → inspection → repair / warranty / discard → Project Director verify → restock or discard. Track B runs in parallel with Track A so inspection does not block replacement.',
  },
  {
    title: 'Close gate',
    body: 'A maintenance case normally closes only when Track A has an approved AIT pass and Track B has reached a terminal outcome — unless Soft / NFF already exited early. Badges and notifications (including RED alerts) help you see which sub-statuses are still waiting.',
  },
] as const;

export function roleByCode(code: WorkflowRoleCode): OnboardingRole | undefined {
  return ONBOARDING_ROLES.find((r) => r.code === code);
}
