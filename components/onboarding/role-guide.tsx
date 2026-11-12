'use client';

import { useMemo } from 'react';
import {
  Briefcase,
  GitBranch,
  HardHat,
  MapPinned,
  Package,
  SearchCheck,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ONBOARDING_ROLES } from '@/lib/onboarding/content';
import { resolveWorkflowRoles, type WorkflowRoleCode } from '@/lib/workflow-roles';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

const ROLE_ICONS: Record<WorkflowRoleCode, LucideIcon> = {
  ADMIN: Settings,
  PD: Briefcase,
  HM: GitBranch,
  IM: Package,
  DEV: Wrench,
  ME: HardHat,
  FSE: MapPinned,
  IE: SearchCheck,
};

export function RoleGuide() {
  const { user } = useAuth();
  const mine = useMemo(
    () => resolveWorkflowRoles(user?.roles ?? []),
    [user?.roles]
  );

  const ordered = useMemo(() => {
    const yours = ONBOARDING_ROLES.filter((r) => mine.has(r.code));
    const others = ONBOARDING_ROLES.filter((r) => !mine.has(r.code));
    return [...yours, ...others];
  }, [mine]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ONBOARDING_ROLES.map((role) => (
          <span
            key={role.code}
            className={cn(
              'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium',
              role.badgeClass,
              mine.has(role.code) && 'ring-2 ring-offset-2 ring-offset-background',
              mine.has(role.code) && role.ringClass
            )}
          >
            <span
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ backgroundColor: role.color }}
              aria-hidden
            />
            {role.shortLabel}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((role) => {
          const isYours = mine.has(role.code);
          const Icon = ROLE_ICONS[role.code];
          return (
            <Card
              key={role.code}
              className={cn(
                'overflow-hidden border-l-4',
                isYours && 'ring-2 ring-offset-2 ring-offset-background',
                isYours && role.ringClass
              )}
              style={{ borderLeftColor: role.color }}
            >
              <CardHeader className="gap-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitleWithIcon
                    icon={Icon}
                    iconClassName="text-current"
                    className="text-base font-semibold"
                    style={{ color: role.color }}
                  >
                    {role.label}
                  </CardTitleWithIcon>
                  {isYours ? (
                    <Badge variant="secondary" className="shrink-0">
                      Your role
                    </Badge>
                  ) : null}
                </div>
                <CardDescription className="leading-relaxed">
                  <HighlightRoleNames text={role.summary} />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {role.responsibilities.map((item) => (
                    <li key={item}>
                      <HighlightRoleNames text={item} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function RoleChip({ code }: { code: (typeof ONBOARDING_ROLES)[number]['code'] }) {
  const role = ONBOARDING_ROLES.find((r) => r.code === code);
  if (!role) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        role.badgeClass
      )}
    >
      <span
        className="mr-1.5 inline-block size-2 rounded-full"
        style={{ backgroundColor: role.color }}
        aria-hidden
      />
      {role.shortLabel}
    </span>
  );
}
