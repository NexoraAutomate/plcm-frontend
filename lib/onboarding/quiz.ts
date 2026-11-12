export type QuizSectionId =
  | 'roles'
  | 'workflow'
  | 'tutorial'
  | 'inventory'
  | 'maintenance';

export type QuizQuestion = {
  id: string;
  section: QuizSectionId;
  prompt: string;
  options: string[];
  /** Index into options */
  correctIndex: number;
  explain: string;
};

export const QUIZ_SECTION_LABELS: Record<QuizSectionId, string> = {
  roles: 'Roles',
  workflow: 'Workflow',
  tutorial: 'Tutorial',
  inventory: 'Inventory',
  maintenance: 'Maintenance',
};

/** Five beginner questions per onboarding tab (25 total). */
export const ONBOARDING_QUIZ: QuizQuestion[] = [
  // —— Roles ——
  {
    id: 'roles-1',
    section: 'roles',
    prompt: 'Who mainly builds Hierarchy Configurations and manages definitions?',
    options: ['Developer', 'Administrator', 'Field Service Engineer', 'Inspection Engineer'],
    correctIndex: 1,
    explain: 'Admin owns definitions, hierarchy configs, and many approvals.',
  },
  {
    id: 'roles-2',
    section: 'roles',
    prompt: 'Which role drafts a project and generates the product hierarchy?',
    options: ['Inventory Manager', 'Project Director', 'Hierarchy Manager', 'Maintenance Engineer'],
    correctIndex: 2,
    explain: 'HM drafts from a config, generates the tree, reserves stock, and verifies installs.',
  },
  {
    id: 'roles-3',
    section: 'roles',
    prompt: 'Who issues serials from the warehouse and inspects returns?',
    options: ['Inventory Manager', 'Developer', 'Project Director', 'Inspection Engineer'],
    correctIndex: 0,
    explain: 'IM runs receive, shortage fulfill, issue, and return inspection.',
  },
  {
    id: 'roles-4',
    section: 'roles',
    prompt: 'On MMHD Track A, who uploads AIT evidence after a site replace?',
    options: ['Hierarchy Manager', 'Maintenance Engineer', 'Inventory Manager', 'Administrator'],
    correctIndex: 1,
    explain: 'ME owns replacement custody, site replace, and AIT upload.',
  },
  {
    id: 'roles-5',
    section: 'roles',
    prompt: 'Who inspects a faulty returned unit on Track B?',
    options: ['Developer', 'Field Service Engineer', 'Inspection Engineer', 'Administrator'],
    correctIndex: 2,
    explain: 'IE dispositions the faulty unit (repair / warranty / discard).',
  },

  // —— Workflow ——
  {
    id: 'workflow-1',
    section: 'workflow',
    prompt: 'What should you set up before creating projects?',
    options: [
      'Issue Queue only',
      'Config / definitions (entity list, labels, hierarchy configuration)',
      'Warranty claims',
      'AIT uploads',
    ],
    correctIndex: 1,
    explain: 'Phase 1 is Config: definitions and hierarchy configurations first.',
  },
  {
    id: 'workflow-2',
    section: 'workflow',
    prompt: 'After a project is approved, what does HM run next?',
    options: ['Generate Hierarchy', 'Discard the unit', 'Close Gate', 'Soft fix'],
    correctIndex: 0,
    explain: 'Generate Hierarchy expands the blueprint into the real product tree.',
  },
  {
    id: 'workflow-3',
    section: 'workflow',
    prompt: 'If stock is missing during reserve, what happens?',
    options: [
      'The project auto-closes',
      'A shortage waits and IM fulfills first-come, first-served',
      'The Developer scraps the item',
      'Audit Trail is deleted',
    ],
    correctIndex: 1,
    explain: 'Shortage branch: wait, then FCFS fulfill when stock arrives.',
  },
  {
    id: 'workflow-4',
    section: 'workflow',
    prompt: 'What does “Installed & Verified” mean on the happy path?',
    options: [
      'Only reserved in the warehouse',
      'Installed, tested, and signed off',
      'Scrapped after inspection',
      'Waiting for occurrence report',
    ],
    correctIndex: 1,
    explain: 'That is the successful end state after install, test, and HM verify.',
  },
  {
    id: 'workflow-5',
    section: 'workflow',
    prompt: 'Cancelling a project can trigger which side process?',
    options: ['Inventory recall', 'Entity List rename', 'Soft fix only', 'Label template reset'],
    correctIndex: 0,
    explain: 'Cancel can recall reserved or issued stock under controlled rules.',
  },

  // —— Tutorial ——
  {
    id: 'tutorial-1',
    section: 'tutorial',
    prompt: 'In the recommended learning order, what comes first?',
    options: [
      'Issue to Developer',
      'Entity definitions & labels',
      'MMHD Close Gate',
      'Defect rework',
    ],
    correctIndex: 1,
    explain: 'Start with Definitions (Entity List + Labels), then configurations.',
  },
  {
    id: 'tutorial-2',
    section: 'tutorial',
    prompt: 'What is the commercial chain before a project?',
    options: [
      'Component → Unit → Module',
      'Customer → Order → Project',
      'Issue → Install → Verify',
      'Track A → Track B → Close',
    ],
    correctIndex: 1,
    explain: 'Customer owns the Order; Project hangs under the Order.',
  },
  {
    id: 'tutorial-3',
    section: 'tutorial',
    prompt: 'Where does a Developer usually see install work?',
    options: [
      'My Assignments → BHD',
      'Definitions → Labels',
      'Audit Trail only',
      'Executive Dashboard only',
    ],
    correctIndex: 0,
    explain: 'BHD assignments list the Developer’s issued / install tasks.',
  },
  {
    id: 'tutorial-4',
    section: 'tutorial',
    prompt: 'Who verifies installs in the Verify queue?',
    options: ['Inventory Manager', 'Hierarchy Manager', 'Field Service Engineer', 'Viewer'],
    correctIndex: 1,
    explain: 'HM works Verify Installations after Dev test.',
  },
  {
    id: 'tutorial-5',
    section: 'tutorial',
    prompt: 'Configuration changes after go-live need what?',
    options: [
      'No approval — anyone can edit live trees',
      'A request and Admin / PD approval path',
      'Only a Developer password',
      'Scrapping all stock first',
    ],
    correctIndex: 1,
    explain: 'Config-change requests go through an approve path (Admin / PD).',
  },

  // —— Inventory ——
  {
    id: 'inventory-1',
    section: 'inventory',
    prompt: 'What does Available mean?',
    options: [
      'Free stock that can be reserved',
      'Already installed and verified',
      'Scrapped permanently',
      'Waiting for AIT approve',
    ],
    correctIndex: 0,
    explain: 'Available = in stock and free for reservation.',
  },
  {
    id: 'inventory-2',
    section: 'inventory',
    prompt: 'Reserved means the serial is…',
    options: [
      'Deleted from the catalog',
      'Locked to a project / hierarchy node',
      'Already scrapped',
      'Only a label template',
    ],
    correctIndex: 1,
    explain: 'Reservation holds stock for a Flight / SDLS / node.',
  },
  {
    id: 'inventory-3',
    section: 'inventory',
    prompt: 'Issued means…',
    options: [
      'Still free in the warehouse for anyone',
      'Physically handed to a Developer with custody',
      'Only a draft project status',
      'Track B is closed',
    ],
    correctIndex: 1,
    explain: 'Issue transfers the serial to the Developer (labels / signature).',
  },
  {
    id: 'inventory-4',
    section: 'inventory',
    prompt: 'After return inspection, which outcome can put stock back to Available?',
    options: ['Scrapped', 'Reusable', 'Under Testing / Review', 'Installation in Progress'],
    correctIndex: 1,
    explain: 'Reusable can return to Available after inspection.',
  },
  {
    id: 'inventory-5',
    section: 'inventory',
    prompt: 'What does Expiry Auto-Release do?',
    options: [
      'Deletes the project hierarchy',
      'Frees stale reservations so others can use the stock',
      'Approves AIT automatically',
      'Creates a warranty claim',
    ],
    correctIndex: 1,
    explain: 'Unused reservations that sit too long are released automatically.',
  },

  // —— Maintenance ——
  {
    id: 'maintenance-1',
    section: 'maintenance',
    prompt: 'What does the Occurrence Report capture?',
    options: [
      'Only warehouse bin locations',
      'Field facts: when, officers, fault type, attachments',
      'Hierarchy Configuration blueprints',
      'Customer invoice totals',
    ],
    correctIndex: 1,
    explain: 'Occurrence Report records the field event details (often with FSE).',
  },
  {
    id: 'maintenance-2',
    section: 'maintenance',
    prompt: 'Soft fix / NFF usually leads to…',
    options: [
      'Mandatory Track A and Track B',
      'Early exit without dual tracks',
      'Automatic scrap of all stock',
      'Hierarchy Generate',
    ],
    correctIndex: 1,
    explain: 'Soft / NFF can close early without dual-track work.',
  },
  {
    id: 'maintenance-3',
    section: 'maintenance',
    prompt: 'Track A is mainly about…',
    options: [
      'Immediate replacement of the unit on site',
      'Only renaming entity labels',
      'Creating a new Customer',
      'Deleting Audit Trail',
    ],
    correctIndex: 0,
    explain: 'Track A: request → approve → issue spare → site replace → AIT.',
  },
  {
    id: 'maintenance-4',
    section: 'maintenance',
    prompt: 'Track B focuses on…',
    options: [
      'Drafting hierarchy configs',
      'The faulty unit’s return, inspection, and disposition',
      'BHD install assignments only',
      'Executive dashboards',
    ],
    correctIndex: 1,
    explain: 'Track B handles reception → IE inspect → repair / warranty / discard.',
  },
  {
    id: 'maintenance-5',
    section: 'maintenance',
    prompt: 'Before a dual-track case can close, what is generally required?',
    options: [
      'Only a Customer record',
      'Track A AIT approved and Track B finished',
      'All inventory marked Scrapped',
      'Expand All on the workflow diagram',
    ],
    correctIndex: 1,
    explain: 'Close Gate waits for AIT pass (Track A) and a terminal Track B outcome.',
  },
];

export function quizScore(
  answers: Record<string, number | undefined>
): {
  correct: number;
  total: number;
  percent: number;
  bySection: Record<QuizSectionId, { correct: number; total: number }>;
} {
  const bySection = {} as Record<QuizSectionId, { correct: number; total: number }>;
  for (const section of Object.keys(QUIZ_SECTION_LABELS) as QuizSectionId[]) {
    bySection[section] = { correct: 0, total: 0 };
  }

  let correct = 0;
  for (const q of ONBOARDING_QUIZ) {
    bySection[q.section].total += 1;
    if (answers[q.id] === q.correctIndex) {
      correct += 1;
      bySection[q.section].correct += 1;
    }
  }

  const total = ONBOARDING_QUIZ.length;
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    bySection,
  };
}

export function scoreMessage(percent: number): string {
  if (percent >= 90) return 'Excellent — you are ready to work in the app.';
  if (percent >= 70) return 'Good job — review the missed topics, then you are in good shape.';
  if (percent >= 50) return 'Getting there — revisit the weaker tabs and try again.';
  return 'Keep learning — walk through the tabs once more, then retake the quiz.';
}
