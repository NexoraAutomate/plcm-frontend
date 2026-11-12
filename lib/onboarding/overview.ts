export type OverviewCapability = {
  title: string;
  body: string;
};

export type OverviewJourneyStep = {
  step: string;
  title: string;
  body: string;
};

export type OverviewSlide =
  | {
      id: string;
      kind: 'hero';
      eyebrow: string;
      headline: string;
      subhead: string;
      accent: string;
    }
  | {
      id: string;
      kind: 'problem';
      eyebrow: string;
      headline: string;
      body: string;
      questions: string[];
    }
  | {
      id: string;
      kind: 'journey';
      eyebrow: string;
      headline: string;
      body: string;
      steps: OverviewJourneyStep[];
    }
  | {
      id: string;
      kind: 'capabilities';
      eyebrow: string;
      headline: string;
      body: string;
      items: OverviewCapability[];
    }
  | {
      id: string;
      kind: 'close';
      eyebrow: string;
      headline: string;
      body: string;
      audiences: string[];
      cta: string;
    };

/** Marketing-aligned overview for first-time users (inspired by plcm.vercel.app). */
export const OVERVIEW_SLIDES: OverviewSlide[] = [
  {
    id: 'hero',
    kind: 'hero',
    eyebrow: 'Product lifecycle control',
    headline: 'Build it once.\nProve it forever.',
    subhead:
      'When someone asks, “Exactly what went into this system?”, PLCM gives your team one trusted answer — from approved configuration to serialized part, installation, verification and final proof.',
    accent: 'One product. One controlled lifecycle. One accountable history.',
  },
  {
    id: 'gap',
    kind: 'problem',
    eyebrow: 'The control gap',
    headline: 'You built the system.\nCan you prove what went into it?',
    body: 'When a complex product moves from configuration to the bench, its story gets fragmented. Engineering has one version. Inventory has another. The installer has handwritten notes. Verification evidence lives somewhere else. PLCM brings every decision, part and proof into one accountable lifecycle.',
    questions: [
      'Which configuration was approved?',
      'Which serial-numbered part was assigned?',
      'Was it installed and tested?',
      'Can you prove it years later?',
    ],
  },
  {
    id: 'journey',
    kind: 'journey',
    eyebrow: 'Order to dossier',
    headline: 'The entire journey stays connected.',
    body: 'PLCM keeps demand, configuration, custody, install and verification on one continuous record — so audits and recalls are a lookup, not a reconstruction.',
    steps: [
      { step: '01', title: 'Order', body: 'Capture customer demand & scope' },
      { step: '02', title: 'Configure', body: 'Approve the product template' },
      { step: '03', title: 'Generate', body: 'Create the living hierarchy' },
      { step: '04', title: 'Reserve', body: 'Hold serialized inventory' },
      { step: '05', title: 'Issue', body: 'Hand parts to the installer' },
      { step: '06', title: 'Install', body: 'Build, fit & test' },
      { step: '07', title: 'Verify', body: 'Confirm every pass' },
      { step: '08', title: 'Dossier', body: 'History on demand' },
    ],
  },
  {
    id: 'capabilities',
    kind: 'capabilities',
    eyebrow: 'Built for the hard parts',
    headline: 'Control the build.\nProtect the proof.',
    body: 'Purpose-built where a missing serial number is more than an inconvenience.',
    items: [
      {
        title: 'Product hierarchy',
        body: 'From one approved Hierarchy Configuration, generate a living tree such as Flight → System → Subsystem → Module → Unit → Component.',
      },
      {
        title: 'Inventory custody',
        body: 'Track each serial through statuses like AVAILABLE, RESERVED, ISSUED, INSTALLATION IN PROGRESS, UNDER TESTING REVIEW, and INSTALLED VERIFIED.',
      },
      {
        title: 'Work queues',
        body: 'Shortages, Issue Queue, inspection, and Verify Installations turn waiting work into clear, accountable lists.',
      },
      {
        title: 'Validated scanning',
        body: 'QR and Code 128 labels work with Scan Label — the server checks the label before stock details are shown.',
      },
      {
        title: 'Build dossiers',
        body: 'Keep a searchable history of what was approved, issued, installed, and verified — without rebuilding the story from spreadsheets and email.',
      },
      {
        title: 'Role-based control',
        body: 'Permissions apply to the action itself (who may approve, issue, verify), not only to which menu items are visible.',
      },
    ],
  },
  {
    id: 'close',
    kind: 'close',
    eyebrow: 'Designed for high-consequence work',
    headline: 'Stop reconstructing the past.\nStart controlling the lifecycle.',
    body: 'Use the remaining onboarding tabs to learn roles, the workflow map, inventory custody, maintenance, and take the knowledge quiz.',
    audiences: ['Aerospace & avionics', 'Defense systems', 'Precision manufacturing', 'Industrial OEMs'],
    cta: 'Continue with Roles →',
  },
];
