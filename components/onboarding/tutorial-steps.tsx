'use client';

import Link from 'next/link';
import {
  ClipboardPen,
  ExternalLink,
  GitBranch,
  LayoutTemplate,
  Package,
  Rocket,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { RoleChip } from '@/components/onboarding/role-guide';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { TUTORIAL_STEPS } from '@/lib/onboarding/content';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

const STEP_ICONS: Record<(typeof TUTORIAL_STEPS)[number]['id'], LucideIcon> = {
  definitions: Tags,
  configurations: LayoutTemplate,
  commercial: Users,
  'approve-generate': Rocket,
  reserve: Package,
  issue: ClipboardPen,
  'install-verify': ShieldCheck,
  branches: GitBranch,
  mmhd: Wrench,
};

export function TutorialSteps() {
  return (
    <ol className="space-y-4">
      {TUTORIAL_STEPS.map((step, index) => {
        const Icon = STEP_ICONS[step.id];
        return (
          <li key={step.id}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <CardTitleWithIcon icon={Icon} className="text-lg">
                    {step.title}
                  </CardTitleWithIcon>
                </div>
                <CardDescription className="leading-relaxed">
                  <HighlightRoleNames text={step.summary} />
                </CardDescription>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {step.roles.map((code) => (
                    <RoleChip key={code} code={code} />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {step.details.map((detail) => (
                    <li key={detail}>
                      <HighlightRoleNames text={detail} />
                    </li>
                  ))}
                </ul>
                {step.links.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {step.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {link.label}
                        <ExternalLink className="size-3 opacity-60" aria-hidden />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
