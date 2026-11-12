/**
 * Expandable React Flow sources for Onboarding.
 * Derived from backend docs/diagrams (Hierarchy + MHD) and Spec 00.
 */

import dagre from '@dagrejs/dagre';
import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import type { WorkflowRoleCode } from '@/lib/workflow-roles';

export type FlowRoleTint = WorkflowRoleCode | 'SYSTEM';

export type FlowStepDef = {
  id: string;
  label: string;
  /** Short beginner-friendly hover explanation. */
  tip: string;
  /** Workflow roles shown as color badges (omit SYSTEM — no badge). */
  roles?: FlowRoleTint[];
  kind?: 'step' | 'decision';
};

export type FlowGroupDef = {
  id: string;
  label: string;
  /** Short beginner-friendly hover explanation. */
  tip: string;
  expandable: true;
  roles?: FlowRoleTint[];
  children: FlowStepDef[];
  /** Edges among children (and optional edges into/out of children handled at top level). */
  childEdges?: Array<{
    source: string;
    target: string;
    label?: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
};

export type FlowNodeDef = FlowStepDef | FlowGroupDef;

export function isFlowGroup(node: FlowNodeDef): node is FlowGroupDef {
  return 'expandable' in node && node.expandable === true;
}

export type FlowEdgeDef = {
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
};

export type OnboardingFlowDiagram = {
  id: string;
  title: string;
  description: string;
  direction: 'TB' | 'LR';
  nodes: FlowNodeDef[];
  edges: FlowEdgeDef[];
  /** Group ids expanded on first paint (default: none — click to open). */
  initiallyExpanded?: string[];
};

export const FLOW_ROLE_COLORS: Record<FlowRoleTint, string> = {
  ADMIN: '#64748b',
  PD: '#0284c7',
  HM: '#0d9488',
  IM: '#d97706',
  DEV: '#4f46e5',
  ME: '#e11d48',
  FSE: '#ea580c',
  IE: '#7c3aed',
  SYSTEM: '#78716c',
};

export const FLOW_ROLE_BADGE_LABELS: Record<FlowRoleTint, string> = {
  ADMIN: 'Admin',
  PD: 'PD',
  HM: 'HM',
  IM: 'IM',
  DEV: 'Dev',
  ME: 'ME',
  FSE: 'FSE',
  IE: 'IE',
  SYSTEM: 'System',
};

export function displayRoles(roles?: FlowRoleTint[]): FlowRoleTint[] {
  return (roles ?? []).filter((r) => r !== 'SYSTEM');
}

export function accentRole(roles?: FlowRoleTint[]): FlowRoleTint {
  return displayRoles(roles)[0] ?? 'SYSTEM';
}

export const BHD_WORKFLOW: OnboardingFlowDiagram = {
  id: 'bhd-workflow',
  title: 'End-to-end build workflow (BHD)',
  description:
    'From Definitions and Hierarchy Configuration through project approval, reservation / shortage, issue, install / verify, plus defect rework, recall, and audit. Click a phase to expand its steps.',
  direction: 'TB',
  initiallyExpanded: [],
  nodes: [
    {
      id: 'phase-config',
      label: '1. Config',
      tip: 'Set up the building blocks of your product tree — names, labels, and templates — before any project starts.',
      expandable: true,
      roles: ['ADMIN'],
      children: [
        {
          id: 'el',
          label: 'Entity List & Labels',
          tip: 'Create the master list of parts/levels and how their IDs should look. Think of it as the dictionary the rest of the app uses.',
          roles: ['ADMIN'],
        },
        {
          id: 'hc',
          label: 'Hierarchy Configuration',
          tip: 'Build a reusable blueprint of how a satellite/product is structured (systems → components). Projects later copy from this blueprint.',
          roles: ['ADMIN'],
        },
      ],
      childEdges: [{ source: 'el', target: 'hc' }],
    },
    {
      id: 'phase-project',
      label: '2. Project',
      tip: 'Turn a customer need into an approved project and generate its full product tree from a configuration.',
      expandable: true,
      roles: ['PD', 'HM', 'ADMIN'],
      children: [
        {
          id: 'cust',
          label: 'Customer & Order',
          tip: 'Record who the customer is and what they ordered. Projects always hang under an order.',
          roles: ['PD'],
        },
        {
          id: 'draft',
          label: 'Draft Project',
          tip: 'The Hierarchy Manager starts a draft project and picks which approved configuration to use.',
          roles: ['HM'],
        },
        {
          id: 'appr',
          label: 'Approve Project',
          tip: 'A reviewer (Admin or Project Director) checks the draft and unlocks the next steps.',
          roles: ['ADMIN', 'PD'],
        },
        {
          id: 'gen',
          label: 'Generate Hierarchy',
          tip: 'One click expands the blueprint into the real tree of systems, modules, units, and components for this project.',
          roles: ['HM'],
        },
      ],
      childEdges: [
        { source: 'cust', target: 'draft' },
        { source: 'draft', target: 'appr' },
        { source: 'appr', target: 'gen' },
      ],
    },
    {
      id: 'phase-reserve',
      label: '3. Reserve',
      tip: 'Hold the right stock for this project so nobody else uses it — or wait in line if stock is short.',
      expandable: true,
      roles: ['HM', 'IM'],
      children: [
        {
          id: 'rsv',
          label: 'Reserve Inventory',
          tip: 'Lock specific serials/parts to nodes in the project tree so they are ready for issue later.',
          roles: ['HM'],
        },
        {
          id: 'short',
          label: 'Shortage?',
          tip: 'Do we have enough free stock? If not, the request waits until more arrives.',
          kind: 'decision',
        },
        {
          id: 'fcfs',
          label: 'Fulfill Shortage FCFS',
          tip: 'When new stock comes in, Inventory Manager fills waiting requests in first-come, first-served order.',
          roles: ['IM'],
        },
        {
          id: 'ready',
          label: 'Ready to Issue',
          tip: 'Reservations are complete — parts can now be handed to the Developer.',
        },
        {
          id: 'exp',
          label: 'Expiry Auto-Release',
          tip: 'If a reservation sits too long unused, the system frees that stock automatically so others can use it.',
          roles: ['IM'],
        },
      ],
      childEdges: [
        { source: 'rsv', target: 'short', targetHandle: 'target-top' },
        {
          source: 'short',
          target: 'fcfs',
          label: 'yes',
          sourceHandle: 'source-left',
        },
        { source: 'fcfs', target: 'rsv' },
        {
          source: 'short',
          target: 'ready',
          label: 'no',
          sourceHandle: 'source-right',
        },
        { source: 'exp', target: 'rsv' },
      ],
    },
    {
      id: 'phase-issue',
      label: '4. Issue',
      tip: 'Physically hand reserved parts to the person who will install them, with labels and a signature trail.',
      expandable: true,
      roles: ['IM', 'DEV'],
      children: [
        {
          id: 'asg',
          label: 'Assign Developer',
          tip: 'Pick which Developer is responsible for installing these reserved items.',
          roles: ['HM'],
        },
        {
          id: 'iss',
          label: 'Issue Serial & Labels',
          tip: 'Warehouse issues the serials, prints/scans labels, and transfers custody to the Developer.',
          roles: ['IM'],
        },
      ],
      childEdges: [{ source: 'asg', target: 'iss' }],
    },
    {
      id: 'phase-install',
      label: '5. Install',
      tip: 'Put the parts into the product, test them, and get a second person to confirm they are good.',
      expandable: true,
      roles: ['DEV', 'HM'],
      children: [
        {
          id: 'inst',
          label: 'Install',
          tip: 'The Developer mounts or connects the issued item on the hierarchy node.',
          roles: ['DEV'],
        },
        {
          id: 'test',
          label: 'Test Pass / Fail',
          tip: 'Run the checks. Pass moves toward verification; Fail starts a rework path.',
          roles: ['DEV'],
        },
        {
          id: 'ver',
          label: 'Verify Install',
          tip: 'Hierarchy Manager reviews the install and test result and marks it verified when ready.',
          roles: ['HM'],
        },
      ],
      childEdges: [
        { source: 'inst', target: 'test' },
        { source: 'test', target: 'ver' },
      ],
    },
    {
      id: 'phase-branches',
      label: '6. Branches',
      tip: 'Things that can interrupt the happy path: failed tests, project cancel, and the audit log of who did what.',
      expandable: true,
      roles: ['DEV', 'PD', 'IM'],
      children: [
        {
          id: 'def',
          label: 'Defect Rework Loop',
          tip: 'If a test fails, the item goes back through fix/rework and then testing again.',
          roles: ['DEV'],
        },
        {
          id: 'rec',
          label: 'Cancel Triggers Recall',
          tip: 'If a project is cancelled, reserved or issued stock is pulled back under controlled rules.',
          roles: ['PD'],
        },
        {
          id: 'aud',
          label: 'Audit Trail',
          tip: 'A permanent history of important actions — who did them and when — across the whole workflow.',
        },
      ],
    },
    {
      id: 'done',
      label: 'Installed & Verified',
      tip: 'Happy ending for a part: installed, tested, and signed off. Progress on the project moves forward.',
    },
  ],
  edges: [
    { source: 'phase-config', target: 'phase-project' },
    { source: 'phase-project', target: 'phase-reserve' },
    { source: 'phase-reserve', target: 'phase-issue' },
    { source: 'phase-issue', target: 'phase-install' },
    { source: 'phase-install', target: 'done' },
    { source: 'phase-install', target: 'phase-branches', label: 'fail / cancel', dashed: true },
    { source: 'done', target: 'phase-branches', dashed: true },
  ],
};

export const INVENTORY_STATUS_FLOW: OnboardingFlowDiagram = {
  id: 'inventory-status',
  title: 'Inventory status spine',
  description:
    'Happy-path serial lifecycle. Expand the return path for inspection outcomes. Click the return group to open its steps.',
  direction: 'LR',
  initiallyExpanded: [],
  nodes: [
    {
      id: 'avail',
      label: 'Available',
      tip: 'Free stock in the warehouse — anyone eligible can reserve it for a project.',
      roles: ['IM'],
    },
    {
      id: 'res',
      label: 'Reserved',
      tip: 'This serial is held for a specific project node. It is no longer free for others.',
      roles: ['HM', 'IM'],
    },
    {
      id: 'iss',
      label: 'Issued',
      tip: 'The part left the warehouse and is now in the Developer’s custody.',
      roles: ['IM'],
    },
    {
      id: 'iip',
      label: 'Installation in Progress',
      tip: 'Someone is actively installing or integrating this item into the product.',
      roles: ['DEV'],
    },
    {
      id: 'utr',
      label: 'Under Testing / Review',
      tip: 'Install is done; checks are running or waiting for a reviewer.',
      roles: ['DEV', 'HM'],
    },
    {
      id: 'iv',
      label: 'Installed & Verified',
      tip: 'Final good state: installed, tested, and officially accepted.',
      roles: ['HM'],
    },
    {
      id: 'return-path',
      label: 'Return / Inspection',
      tip: 'When a part comes back from the floor, warehouse inspects it and decides: reuse, repair, or scrap.',
      expandable: true,
      roles: ['IM'],
      children: [
        {
          id: 'ret',
          label: 'Returned',
          tip: 'The item is back at the warehouse but not judged yet.',
          roles: ['IM'],
        },
        {
          id: 'insp',
          label: 'Inspection',
          tip: 'Inventory Manager checks condition and decides the next status.',
          roles: ['IM'],
        },
        {
          id: 'reu',
          label: 'Reusable',
          tip: 'Good to go back into Available stock after inspection.',
          roles: ['IM'],
        },
        {
          id: 'rep',
          label: 'Repairable',
          tip: 'Needs repair work before it can be stocked again.',
          roles: ['IM'],
        },
        {
          id: 'scr',
          label: 'Scrapped',
          tip: 'Not usable anymore — permanently removed from stock.',
          roles: ['IM'],
        },
      ],
      childEdges: [
        { source: 'ret', target: 'insp' },
        { source: 'insp', target: 'reu' },
        { source: 'insp', target: 'rep' },
        { source: 'insp', target: 'scr' },
      ],
    },
  ],
  edges: [
    { source: 'avail', target: 'res' },
    { source: 'res', target: 'iss' },
    { source: 'iss', target: 'iip' },
    { source: 'iip', target: 'utr' },
    { source: 'utr', target: 'iv' },
    {
      source: 'iss',
      target: 'return-path',
      label: 'return',
      dashed: true,
      sourceHandle: 'source',
      targetHandle: 'target',
    },
    {
      source: 'iip',
      target: 'return-path',
      dashed: true,
      sourceHandle: 'source',
      targetHandle: 'target',
    },
    {
      source: 'utr',
      target: 'return-path',
      dashed: true,
      sourceHandle: 'source',
      targetHandle: 'target',
    },
    {
      source: 'return-path',
      target: 'avail',
      label: 'reusable',
      dashed: true,
    },
  ],
};

export const MMHD_DUAL_TRACK_FLOW: OnboardingFlowDiagram = {
  id: 'mmhd-dual-track',
  title: 'Maintenance dual-track (MMHD)',
  description:
    'Occurrence Report → Soft/NFF early exit or parallel Track A replacement and Track B faulty inspection. Expand each track for its steps.',
  direction: 'TB',
  initiallyExpanded: [],
  nodes: [
    {
      id: 'open',
      label: 'Case Open',
      tip: 'A maintenance case is created for a field problem on a specific serial/unit.',
    },
    {
      id: 'occ',
      label: 'Occurrence Report',
      tip: 'Capture what happened on site: when, who was there, fault type, and attachments.',
      roles: ['FSE'],
    },
    {
      id: 'out',
      label: 'Outcome?',
      tip: 'Was it a soft fix / no fault found, or a real hardware fault that needs replacement?',
      kind: 'decision',
    },
    {
      id: 'early',
      label: 'Early Exit & Close',
      tip: 'Soft fix or NFF — no dual-track work needed; the case can close early.',
    },
    {
      id: 'split',
      label: 'Dual-Track Split',
      tip: 'Fault confirmed: start replacement now (Track A) and inspect the faulty unit in parallel (Track B).',
    },
    {
      id: 'track-a',
      label: 'Track A - Immediate Replacement',
      tip: 'Get a good spare to site quickly, install it, and prove it with AIT evidence.',
      expandable: true,
      roles: ['ME', 'PD', 'IM', 'FSE'],
      children: [
        {
          id: 'a1',
          label: 'Replacement Request',
          tip: 'Ask for a same-spec replacement unit so the site can keep working.',
          roles: ['ME'],
        },
        {
          id: 'a2',
          label: 'Approve / Reject',
          tip: 'Project Director decides whether the replacement request may proceed.',
          roles: ['PD'],
        },
        {
          id: 'a3',
          label: 'Issue Serial Number',
          tip: 'Warehouse picks and issues the replacement serial to the maintenance engineer.',
          roles: ['IM'],
        },
        {
          id: 'a4',
          label: 'Site Replace',
          tip: 'Swap the unit on site (ME, often with FSE help) and bring the system back up.',
          roles: ['ME', 'FSE'],
        },
        {
          id: 'a5',
          label: 'Upload AIT',
          tip: 'Upload acceptance / integration test evidence that the new unit works.',
          roles: ['ME'],
        },
        {
          id: 'a6',
          label: 'AIT Approve / Reject',
          tip: 'PD reviews AIT. Reject sends you back to fix evidence; approve closes Track A.',
          roles: ['PD'],
        },
        {
          id: 'a-close',
          label: 'Track A Closed',
          tip: 'Replacement path is done. Case close still waits for Track B if it is running.',
        },
      ],
      childEdges: [
        { source: 'a1', target: 'a2' },
        { source: 'a2', target: 'a3' },
        { source: 'a3', target: 'a4' },
        { source: 'a4', target: 'a5' },
        { source: 'a5', target: 'a6' },
        {
          source: 'a6',
          target: 'a5',
          label: 'reject',
          sourceHandle: 'source-left',
        },
        {
          source: 'a6',
          target: 'a-close',
          label: 'approve',
          sourceHandle: 'source-right',
        },
      ],
    },
    {
      id: 'track-b',
      label: 'Track B - Faulty Return',
      tip: 'Handle the broken unit: receive it, inspect it, then repair, warranty, or discard.',
      expandable: true,
      roles: ['IM', 'IE', 'PD', 'HM'],
      children: [
        {
          id: 'b1',
          label: 'Receive Faulty Unit',
          tip: 'Warehouse logs that the faulty unit has arrived from the field.',
          roles: ['IM'],
        },
        {
          id: 'b2',
          label: 'Assign IE',
          tip: 'Choose an Inspection Engineer who will examine the returned unit.',
          roles: ['PD', 'HM'],
        },
        {
          id: 'b3',
          label: 'Issue to IE',
          tip: 'Hand the faulty serial to the Inspection Engineer for detailed checks.',
          roles: ['IM'],
        },
        {
          id: 'b4',
          label: 'Inspect & Disposition',
          tip: 'Decide the outcome: repairable, send to warranty, or recommend discard.',
          roles: ['IE'],
        },
        {
          id: 'b5',
          label: 'Repair / Warranty / Discard',
          tip: 'Carry out the chosen path and attach evidence where required.',
          roles: ['IE'],
        },
        {
          id: 'b6',
          label: 'Verify then Restock',
          tip: 'PD verifies results; good units can return to stock, discards stay out.',
          roles: ['PD'],
        },
        {
          id: 'b-close',
          label: 'Track B Complete',
          tip: 'Faulty-return path finished — one of the two gates needed before case close.',
        },
      ],
      childEdges: [
        { source: 'b1', target: 'b2' },
        { source: 'b2', target: 'b3' },
        { source: 'b3', target: 'b4' },
        { source: 'b4', target: 'b5' },
        { source: 'b5', target: 'b6' },
        { source: 'b6', target: 'b-close' },
      ],
    },
    {
      id: 'gate',
      label: 'Close Gate',
      tip: 'Both tracks must be finished (AIT approved + Track B done) before the case can close — unless you took the early Soft/NFF exit.',
      roles: ['PD'],
      kind: 'decision',
    },
    {
      id: 'close',
      label: 'Case Close',
      tip: 'Maintenance case is complete and recorded. Soft/NFF cases may reach here without dual tracks.',
    },
  ],
  edges: [
    { source: 'open', target: 'occ' },
    { source: 'occ', target: 'out', targetHandle: 'target-top' },
    {
      source: 'out',
      target: 'early',
      label: 'Soft fix / NFF',
      sourceHandle: 'source-left',
    },
    {
      source: 'out',
      target: 'split',
      label: 'Fault identified',
      sourceHandle: 'source-right',
    },
    { source: 'split', target: 'track-a' },
    { source: 'split', target: 'track-b' },
    { source: 'track-a', target: 'gate', targetHandle: 'target-left' },
    { source: 'track-b', target: 'gate', targetHandle: 'target-top' },
    {
      source: 'gate',
      target: 'close',
      label: 'A pass + B complete',
      sourceHandle: 'source-bottom',
    },
    { source: 'early', target: 'close' },
  ],
};

export const ONBOARDING_DIAGRAMS: OnboardingFlowDiagram[] = [
  BHD_WORKFLOW,
  INVENTORY_STATUS_FLOW,
  MMHD_DUAL_TRACK_FLOW,
];

export type OnboardingFlowNodeData = {
  label: string;
  tip: string;
  roles?: FlowRoleTint[];
  kind: 'step' | 'decision' | 'group';
  expandable?: boolean;
  expanded?: boolean;
  childCount?: number;
  groupId?: string;
};

const NODE_W = 210;
const NODE_H = 68;
/** Equal sides so a 45°-rotated square reads as a proper diamond. */
const DECISION_SIZE = 120;
const GROUP_W = 260;
const GROUP_H = 78;

const ARROW_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 18,
  height: 18,
} as const;

function makeEdge(
  partial: Omit<Edge, 'markerEnd' | 'type'> & { type?: Edge['type'] }
): Edge {
  return {
    type: 'smoothstep',
    markerEnd: ARROW_MARKER,
    ...partial,
  };
}

export function expandableGroupIds(diagram: OnboardingFlowDiagram): string[] {
  return diagram.nodes.filter(isFlowGroup).map((g) => g.id);
}

function isDecisionNode(
  diagram: OnboardingFlowDiagram,
  nodeId: string
): boolean {
  for (const def of diagram.nodes) {
    if (isFlowGroup(def)) {
      const child = def.children.find((c) => c.id === nodeId);
      if (child) return child.kind === 'decision';
    } else if (def.id === nodeId) {
      return def.kind === 'decision';
    }
  }
  return false;
}

/** Spread sibling edges that share a source→target corridor so paths don't stack. */
function withParallelOffsets(edges: Edge[]): Edge[] {
  const byPair = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = `${edge.source}→${edge.target}`;
    const list = byPair.get(key) ?? [];
    list.push(edge);
    byPair.set(key, list);
  }

  const bySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = bySource.get(edge.source) ?? [];
    list.push(edge);
    bySource.set(edge.source, list);
  }

  return edges.map((edge) => {
    const samePair = byPair.get(`${edge.source}→${edge.target}`) ?? [edge];
    const sameSource = bySource.get(edge.source) ?? [edge];
    const pairIndex = samePair.indexOf(edge);
    const sourceIndex = sameSource.indexOf(edge);

    // Prefer spreading multi-out from one source; also separate identical pair stacks.
    const spreadCount = Math.max(samePair.length, sameSource.length > 1 ? sameSource.length : 1);
    const spreadIndex = samePair.length > 1 ? pairIndex : sourceIndex;
    if (spreadCount <= 1) {
      return {
        ...edge,
        pathOptions: { borderRadius: 12 },
      };
    }
    const mid = (spreadCount - 1) / 2;
    const offset = Math.round((spreadIndex - mid) * 28);
    return {
      ...edge,
      pathOptions: { offset, borderRadius: 16 },
    };
  });
}

export function buildOnboardingFlowElements(
  diagram: OnboardingFlowDiagram,
  expanded: Set<string>
): { nodes: Node<OnboardingFlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<OnboardingFlowNodeData>[] = [];
  const edges: Edge[] = [];
  const direction = diagram.direction;

  for (const def of diagram.nodes) {
    if (isFlowGroup(def)) {
      const isExpanded = expanded.has(def.id);
      nodes.push({
        id: def.id,
        type: 'onboardingGroup',
        position: { x: 0, y: 0 },
        data: {
          label: def.label,
          tip: def.tip,
          roles: def.roles,
          kind: 'group',
          expandable: true,
          expanded: isExpanded,
          childCount: def.children.length,
          groupId: def.id,
        },
        style: { width: GROUP_W, height: GROUP_H },
      });

      if (isExpanded) {
        for (const child of def.children) {
          const size = child.kind === 'decision' ? DECISION_SIZE : null;
          nodes.push({
            id: child.id,
            type: child.kind === 'decision' ? 'onboardingDecision' : 'onboardingStep',
            position: { x: 0, y: 0 },
            data: {
              label: child.label,
              tip: child.tip,
              roles: child.roles,
              kind: child.kind ?? 'step',
              groupId: def.id,
            },
            style: {
              width: size ?? NODE_W,
              height: size ?? NODE_H,
            },
          });
        }
        for (const [i, ce] of (def.childEdges ?? []).entries()) {
          edges.push(
            makeEdge({
              id: `${def.id}-child-${i}-${ce.source}-${ce.target}`,
              source: ce.source,
              target: ce.target,
              label: ce.label,
              sourceHandle: ce.sourceHandle,
              targetHandle: ce.targetHandle,
            })
          );
        }
        if (def.children[0]) {
          const first = def.children[0];
          edges.push(
            makeEdge({
              id: `${def.id}-to-first`,
              source: def.id,
              target: first.id,
              sourceHandle: 'source',
              targetHandle:
                first.kind === 'decision'
                  ? direction === 'LR'
                    ? 'target-left'
                    : 'target-top'
                  : 'target',
              style: { strokeDasharray: '6 4' },
            })
          );
        }
      }
    } else {
      const size = def.kind === 'decision' ? DECISION_SIZE : null;
      nodes.push({
        id: def.id,
        type: def.kind === 'decision' ? 'onboardingDecision' : 'onboardingStep',
        position: { x: 0, y: 0 },
        data: {
          label: def.label,
          tip: def.tip,
          roles: def.roles,
          kind: def.kind ?? 'step',
        },
        style: {
          width: size ?? NODE_W,
          height: size ?? NODE_H,
        },
      });
    }
  }

  for (const [i, e] of diagram.edges.entries()) {
    const sourceIsDecision = isDecisionNode(diagram, e.source);
    const targetIsDecision = isDecisionNode(diagram, e.target);
    edges.push(
      makeEdge({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label,
        sourceHandle:
          e.sourceHandle ??
          (sourceIsDecision
            ? direction === 'LR'
              ? 'source-right'
              : 'source-bottom'
            : 'source'),
        targetHandle:
          e.targetHandle ??
          (targetIsDecision
            ? direction === 'LR'
              ? 'target-left'
              : 'target-top'
            : 'target'),
        style: e.dashed ? { strokeDasharray: '6 4' } : undefined,
      })
    );
  }

  return layoutElements(nodes, withParallelOffsets(edges), direction);
}

function layoutElements(
  nodes: Node<OnboardingFlowNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR'
): { nodes: Node<OnboardingFlowNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: direction === 'LR' ? 72 : 64,
    ranksep: direction === 'LR' ? 88 : 80,
    edgesep: 48,
    marginx: 32,
    marginy: 32,
  });

  for (const node of nodes) {
    const w = Number(node.style?.width ?? NODE_W);
    const h = Number(node.style?.height ?? NODE_H);
    g.setNode(node.id, { width: w, height: h });
  }
  // Dagre ranks nodes; React Flow path offsets keep parallel edges visually apart.
  const seenPairs = new Set<string>();
  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    const pair = `${edge.source}→${edge.target}`;
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;
  const targetPosition = direction === 'LR' ? Position.Left : Position.Top;

  const laidOut = nodes.map((node) => {
    const meta = g.node(node.id);
    const w = Number(node.style?.width ?? NODE_W);
    const h = Number(node.style?.height ?? NODE_H);
    const isDecision = node.type === 'onboardingDecision';
    return {
      ...node,
      // Decision nodes keep dedicated side handles; others follow layout direction.
      sourcePosition: isDecision ? undefined : sourcePosition,
      targetPosition: isDecision ? undefined : targetPosition,
      position: {
        x: (meta?.x ?? 0) - w / 2,
        y: (meta?.y ?? 0) - h / 2,
      },
    };
  });

  return { nodes: laidOut, edges };
}
