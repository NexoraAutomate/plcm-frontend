'use client';

import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  HelpCircle,
  Map,
} from 'lucide-react';
import { CardTitleWithIcon } from '@/components/onboarding/card-title-with-icon';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import {
  OVERVIEW_CONCEPTS,
  OVERVIEW_INTRO,
  OVERVIEW_PATH,
  OVERVIEW_QUICK_LINKS,
  OVERVIEW_TAB_GUIDE,
  type OverviewTabGuide,
} from '@/lib/onboarding/overview-page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type OverviewGuideProps = {
  onSelectTab?: (tabId: OverviewTabGuide['tabId']) => void;
};

export function OverviewGuide({ onSelectTab }: OverviewGuideProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitleWithIcon icon={BookOpen}>What this app is for</CardTitleWithIcon>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {OVERVIEW_INTRO.map((paragraph) => (
            <p key={paragraph}>
              <HighlightRoleNames text={paragraph} />
            </p>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">The big picture</h3>
          <p className="text-sm text-muted-foreground">
            The main path most products follow in PLCM, from setup through build and field
            maintenance.
          </p>
        </div>
        <ol className="space-y-3">
          {OVERVIEW_PATH.map((item) => (
            <li key={item.step}>
              <Card>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {item.step}
                    </span>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                  <CardDescription className="leading-relaxed">
                    <HighlightRoleNames text={item.body} />
                  </CardDescription>
                  <p className="text-xs text-muted-foreground">
                    <HighlightRoleNames text={item.owners} />
                  </p>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">How to use Onboarding</h3>
          <p className="text-sm text-muted-foreground">
            Start with Roles if you only care about your job. Otherwise work through Tutorial in
            order, then use Inventory and Maintenance for deeper detail, and finish with the Quiz.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OVERVIEW_TAB_GUIDE.map((item) => (
            <Card key={item.tabId}>
              <CardHeader className="gap-2">
                <CardTitleWithIcon icon={Map} className="text-base">
                  {item.label}
                </CardTitleWithIcon>
                <CardDescription className="leading-relaxed">
                  <HighlightRoleNames text={item.body} />
                </CardDescription>
                {onSelectTab ? (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectTab(item.tabId)}
                    >
                      Open {item.label}
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Key ideas beginners trip on
          </h3>
          <p className="text-sm text-muted-foreground">
            Short definitions using the same terms you will see in the app.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {OVERVIEW_CONCEPTS.map((concept) => (
            <Card key={concept.title}>
              <CardHeader>
                <CardTitleWithIcon icon={HelpCircle} className="text-base">
                  {concept.title}
                </CardTitleWithIcon>
                <CardDescription className="leading-relaxed">
                  <HighlightRoleNames text={concept.body} />
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Where do I click?</h3>
          <p className="text-sm text-muted-foreground">
            Primary screens to open after you understand the basics.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OVERVIEW_QUICK_LINKS.map((link) => (
            <Card key={link.href}>
              <CardHeader className="gap-2">
                <CardTitleWithIcon icon={ExternalLink} className="text-base">
                  {link.label}
                </CardTitleWithIcon>
                <CardDescription className="leading-relaxed">{link.body}</CardDescription>
                <div>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Open {link.label}
                    <ExternalLink className="size-3 opacity-60" aria-hidden />
                  </Link>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Menus, queues, and actions depend on your role and permissions. On the Roles tab, cards that
        match your account are listed first with a “Your role” badge.
      </p>
    </div>
  );
}
