'use client';

import {
  ClipboardList,
  DoorClosed,
  GitBranch,
  Layers,
  PackageOpen,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MAINTENANCE_GUIDE_POINTS } from '@/lib/onboarding/content';
import { ONBOARDING_DIAGRAMS } from '@/lib/onboarding/diagrams';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { WorkflowFlowDiagram } from '@/components/onboarding/workflow-flow-diagram';
import { RoleChip } from '@/components/onboarding/role-guide';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

const mmhdDiagram = ONBOARDING_DIAGRAMS.find((d) => d.id === 'mmhd-dual-track');

const POINT_ICONS: Record<(typeof MAINTENANCE_GUIDE_POINTS)[number]['title'], LucideIcon> = {
  'Augment, do not replace': Layers,
  'Occurrence Report': ClipboardList,
  'Track A — immediate replacement': RefreshCw,
  'Track B — faulty return': PackageOpen,
  'Close gate': DoorClosed,
};

export function MaintenanceGuide() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(['FSE', 'ME', 'PD', 'IM', 'IE', 'HM'] as const).map((code) => (
          <RoleChip key={code} code={code} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MAINTENANCE_GUIDE_POINTS.map((point) => {
          const Icon = POINT_ICONS[point.title];
          return (
            <Card key={point.title}>
              <CardHeader>
                <CardTitleWithIcon icon={Icon}>{point.title}</CardTitleWithIcon>
                <CardDescription className="leading-relaxed">
                  <HighlightRoleNames text={point.body} />
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {mmhdDiagram ? (
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={GitBranch}>{mmhdDiagram.title}</CardTitleWithIcon>
            <CardDescription>
              <HighlightRoleNames text={mmhdDiagram.description} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowFlowDiagram diagram={mmhdDiagram} heightClassName="h-[32rem]" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
