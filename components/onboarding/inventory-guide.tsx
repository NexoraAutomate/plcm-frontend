'use client';

import {
  Bookmark,
  Package,
  RotateCcw,
  SearchCheck,
  Tag,
  Workflow,
} from 'lucide-react';
import {
  INVENTORY_GUIDE_POINTS,
  INVENTORY_STATUS_HAPPY,
  INVENTORY_STATUS_RETURN,
} from '@/lib/onboarding/content';
import { ONBOARDING_DIAGRAMS } from '@/lib/onboarding/diagrams';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { WorkflowFlowDiagram } from '@/components/onboarding/workflow-flow-diagram';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

const statusDiagram = ONBOARDING_DIAGRAMS.find((d) => d.id === 'inventory-status');

const POINT_ICONS: Record<(typeof INVENTORY_GUIDE_POINTS)[number]['title'], LucideIcon> = {
  'Stock model': Package,
  'Reservation & shortage': Bookmark,
  'Issue, labels & custody': Tag,
  'Returns & inspect': SearchCheck,
};

export function InventoryGuide() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {INVENTORY_GUIDE_POINTS.map((point) => {
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={Workflow}>Happy-path statuses</CardTitleWithIcon>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {INVENTORY_STATUS_HAPPY.map((row) => (
                <div key={row.status} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="shrink-0 font-mono text-xs font-semibold sm:w-56">
                    {row.status}
                  </dt>
                  <dd className="text-muted-foreground">
                    <HighlightRoleNames text={row.meaning} />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={RotateCcw}>Return / inspection branch</CardTitleWithIcon>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {INVENTORY_STATUS_RETURN.map((row) => (
                <div key={row.status} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="shrink-0 font-mono text-xs font-semibold sm:w-36">
                    {row.status}
                  </dt>
                  <dd className="text-muted-foreground">
                    <HighlightRoleNames text={row.meaning} />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {statusDiagram ? (
        <Card>
          <CardHeader>
            <CardTitleWithIcon icon={Workflow}>{statusDiagram.title}</CardTitleWithIcon>
            <CardDescription>
              <HighlightRoleNames text={statusDiagram.description} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowFlowDiagram diagram={statusDiagram} heightClassName="h-[22rem]" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
