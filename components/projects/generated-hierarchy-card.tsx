'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as api from '@/lib/api';
import type { Project } from '@/lib/models';
import { isProjectReadOnly, ProjectWorkflowStatus } from '@/lib/workflow-status';
import { cn } from '@/lib/utils';

type HierarchyTree = Awaited<
  ReturnType<typeof api.projects.hierarchyTree>
>['data'];

type HierarchySystemNode = HierarchyTree['flights'][number]['sdls'][number]['systems'][number];

function TreeNode({
  kind,
  name,
  href,
  children,
}: {
  kind: string;
  name: string;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {kind}
        </span>
        {href ? (
          <Link
            href={href}
            className="text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="text-foreground">{name}</span>
        )}
      </div>
      {children ? (
        <ul className="ml-3 mt-1 space-y-1 border-l border-border/60 pl-3">{children}</ul>
      ) : null}
    </li>
  );
}

function renderSystemBranch(system: HierarchySystemNode) {
  return (
    <TreeNode
      key={`system-${system.id}`}
      kind="System"
      name={system.name}
      href={`/systems/${system.id}`}
    >
      {(system.subsystems ?? []).map((subsystem) => (
        <TreeNode
          key={`subsystem-${subsystem.id}`}
          kind="Subsystem"
          name={subsystem.name}
          href={`/subsystems/${subsystem.id}`}
        >
          {(subsystem.modules ?? []).map((module) => (
            <TreeNode
              key={`module-${module.id}`}
              kind="Module"
              name={module.name}
              href={`/modules/${module.id}`}
            >
              {(module.units ?? []).map((unit) => (
                <TreeNode
                  key={`unit-${unit.id}`}
                  kind="Unit"
                  name={unit.name}
                  href={`/units/${unit.id}`}
                >
                  {(unit.components ?? []).map((component) => (
                    <TreeNode
                      key={`component-${component.id}`}
                      kind="Component"
                      name={component.name}
                      href={`/components/${component.id}`}
                    />
                  ))}
                </TreeNode>
              ))}
            </TreeNode>
          ))}
        </TreeNode>
      ))}
    </TreeNode>
  );
}

export function GeneratedHierarchyCard({
  project,
  configurationLabel,
}: {
  project: Project;
  configurationLabel?: string | null;
}) {
  const [tree, setTree] = useState<HierarchyTree | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const status = project.status_name ?? '';
  const isReady =
    status === ProjectWorkflowStatus.READY_FOR_INVENTORY ||
    status === ProjectWorkflowStatus.HIERARCHY_GENERATED;
  const isCancelled = isProjectReadOnly(status);

  useEffect(() => {
    if (!isReady && !isCancelled) {
      setTree(null);
      return;
    }
    let cancelled = false;
    void api.projects
      .hierarchyTree(project.id)
      .then((res) => {
        if (!cancelled) setTree(res.data);
      })
      .catch(() => {
        if (!cancelled) setTree(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, isReady, isCancelled]);

  if (!tree || tree.flights.length === 0) return null;

  return (
    <Collapsible open={treeOpen} onOpenChange={setTreeOpen}>
      <div className="rounded-lg border bg-muted/30 text-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-medium hover:bg-muted/50"
          >
            <span>
              {isCancelled ? 'Generated hierarchy (read-only)' : 'Generated hierarchy'}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                treeOpen && 'rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="border-t px-3 py-3 text-muted-foreground">
            <TreeNode kind="Configuration" name={configurationLabel || '—'}>
              {tree.flights.map((flight) => (
                <TreeNode key={flight.id} kind="Flight" name={flight.name}>
                  {flight.sdls.flatMap((sdls) => sdls.systems).map((system) =>
                    renderSystemBranch(system)
                  )}
                </TreeNode>
              ))}
            </TreeNode>
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
