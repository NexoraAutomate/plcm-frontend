'use client';

import { useState } from 'react';
import { ONBOARDING_TOC } from '@/lib/onboarding/content';
import { ONBOARDING_DIAGRAMS } from '@/lib/onboarding/diagrams';
import { OverviewGuide } from '@/components/onboarding/overview-guide';
import { RoleGuide } from '@/components/onboarding/role-guide';
import { TutorialSteps } from '@/components/onboarding/tutorial-steps';
import { InventoryGuide } from '@/components/onboarding/inventory-guide';
import { MaintenanceGuide } from '@/components/onboarding/maintenance-guide';
import { OnboardingQuiz } from '@/components/onboarding/onboarding-quiz';
import { WorkflowFlowDiagram } from '@/components/onboarding/workflow-flow-diagram';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch } from 'lucide-react';

const bhdDiagram = ONBOARDING_DIAGRAMS.find((d) => d.id === 'bhd-workflow');

const TAB_COPY: Record<(typeof ONBOARDING_TOC)[number]['id'], { title: string; blurb: string }> = {
  overview: {
    title: 'Overview',
    blurb:
      'A simple introduction to PLCM: what the app is for, the main path, how to use these tabs, key terms, and where to click next.',
  },
  roles: {
    title: 'Roles & responsibilities',
    blurb:
      'Eight workflow roles used across PLCM. Cards that match your account appear first and show a “Your role” badge so you can start with what matters to you.',
  },
  workflow: {
    title: 'Workflow diagram',
    blurb:
      'See how each role fits into the end-to-end build path. Click a phase to expand its steps, or use Expand All. Hover a node for a short tip.',
  },
  tutorial: {
    title: 'Step-by-step tutorial',
    blurb:
      'A recommended learning order: Definitions → Hierarchy Configurations → Customer / Order / Project → Generate Hierarchy → Reserve Inventory → Issue → Install / Verify → branches → Maintenance (MMHD).',
  },
  inventory: {
    title: 'Inventory management',
    blurb:
      'How serials move through reservation, shortages, issue with labels and custody, returns, and the main status names you will see in Inventory.',
  },
  maintenance: {
    title: 'Maintenance (MMHD)',
    blurb:
      'What happens after a field fault: the Occurrence Report, Soft / NFF early exits, and the dual Track A (replacement) / Track B (faulty return) flow that sits alongside existing soft-fix paths.',
  },
  quiz: {
    title: 'Knowledge quiz',
    blurb:
      '25 multiple-choice questions (5 from each learning section). Answer all, submit for a score by section, then review anything you missed.',
  },
};

export default function OnboardingPage() {
  const [tab, setTab] = useState<(typeof ONBOARDING_TOC)[number]['id']>('overview');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Train on how SatLife / PLCM works. Start with Overview, work through the learning tabs,
          then take the quiz to check your understanding.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as (typeof ONBOARDING_TOC)[number]['id'])}
        className="gap-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {ONBOARDING_TOC.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="px-3 py-1.5">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.overview.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.overview.blurb} />
            </p>
          </div>
          <OverviewGuide onSelectTab={(tabId) => setTab(tabId)} />
        </TabsContent>

        <TabsContent value="roles" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.roles.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.roles.blurb} />
            </p>
          </div>
          <RoleGuide />
        </TabsContent>

        <TabsContent value="workflow" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.workflow.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.workflow.blurb} />
            </p>
          </div>
          {tab === 'workflow' && bhdDiagram ? (
            <Card>
              <CardHeader>
                <CardTitleWithIcon icon={GitBranch}>{bhdDiagram.title}</CardTitleWithIcon>
                <CardDescription>
                  <HighlightRoleNames text={bhdDiagram.description} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowFlowDiagram diagram={bhdDiagram} heightClassName="h-[32rem]" />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="tutorial" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.tutorial.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.tutorial.blurb} />
            </p>
          </div>
          <TutorialSteps />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.inventory.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.inventory.blurb} />
            </p>
          </div>
          {tab === 'inventory' ? <InventoryGuide /> : null}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.maintenance.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.maintenance.blurb} />
            </p>
          </div>
          {tab === 'maintenance' ? <MaintenanceGuide /> : null}
        </TabsContent>

        <TabsContent value="quiz" className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{TAB_COPY.quiz.title}</h2>
            <p className="text-sm text-muted-foreground">
              <HighlightRoleNames text={TAB_COPY.quiz.blurb} />
            </p>
          </div>
          {tab === 'quiz' ? <OnboardingQuiz /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
