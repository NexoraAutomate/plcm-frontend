'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as api from '@/lib/api';
import type { Project } from '@/lib/models';
import { isProjectReadOnly, ProjectWorkflowStatus } from '@/lib/workflow-status';

type HierarchyTree = Awaited<
  ReturnType<typeof api.projects.hierarchyTree>
>['data'];

type HierarchySystemNode = HierarchyTree['flights'][number]['sdls'][number]['systems'][number];
type HierarchySubsystemNode = NonNullable<HierarchySystemNode['subsystems']>[number];
type HierarchyModuleNode = NonNullable<
  HierarchySystemNode['modules']
>[number];
type HierarchyUnitNode = NonNullable<HierarchySystemNode['units']>[number];
type HierarchyComponentNode = NonNullable<HierarchySystemNode['components']>[number];

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

function renderComponent(component: HierarchyComponentNode) {
  return (
    <TreeNode
      key={`component-${component.id}`}
      kind="Component"
      name={component.name}
      href={`/components/${component.id}`}
    />
  );
}

function renderUnit(unit: HierarchyUnitNode) {
  const components = unit.components ?? [];
  return (
    <TreeNode
      key={`unit-${unit.id}`}
      kind="Unit"
      name={unit.name}
      href={`/units/${unit.id}`}
    >
      {components.map(renderComponent)}
    </TreeNode>
  );
}

function renderModule(module: HierarchyModuleNode) {
  const units = module.units ?? [];
  const components = module.components ?? [];
  return (
    <TreeNode
      key={`module-${module.id}`}
      kind="Module"
      name={module.name}
      href={`/modules/${module.id}`}
    >
      {units.map(renderUnit)}
      {components.map(renderComponent)}
    </TreeNode>
  );
}

function renderSubsystem(subsystem: HierarchySubsystemNode) {
  const modules = subsystem.modules ?? [];
  const units = subsystem.units ?? [];
  const components = subsystem.components ?? [];
  return (
    <TreeNode
      key={`subsystem-${subsystem.id}`}
      kind="Subsystem"
      name={subsystem.name}
      href={`/subsystems/${subsystem.id}`}
    >
      {modules.map(renderModule)}
      {units.map(renderUnit)}
      {components.map(renderComponent)}
    </TreeNode>
  );
}

function renderSystemBranch(system: HierarchySystemNode) {
  const subsystems = system.subsystems ?? [];
  const modules = system.modules ?? [];
  const units = system.units ?? [];
  const components = system.components ?? [];
  return (
    <TreeNode
      key={`system-${system.id}`}
      kind="System"
      name={system.name}
      href={`/systems/${system.id}`}
    >
      {subsystems.map(renderSubsystem)}
      {modules.map(renderModule)}
      {units.map(renderUnit)}
      {components.map(renderComponent)}
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
  const [loading, setLoading] = useState(false);
  const status = project.status_name ?? '';
  const isReady =
    status === ProjectWorkflowStatus.READY_FOR_INVENTORY ||
    status === ProjectWorkflowStatus.HIERARCHY_GENERATED;
  const isCancelled = isProjectReadOnly(status);
  const canLoad = isReady || isCancelled;

  useEffect(() => {
    if (!canLoad) {
      setTree(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api.projects
      .hierarchyTree(project.id)
      .then((res) => {
        if (!cancelled) setTree(res.data);
      })
      .catch(() => {
        if (!cancelled) setTree(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, canLoad]);

  if (!canLoad) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Generate the hierarchy to view the project tree.
      </div>
    );
  }

  if (loading && !tree) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Loading hierarchy…
      </div>
    );
  }

  if (!tree || tree.flights.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        No generated hierarchy is available yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 text-sm">
      <ul className="px-3 py-3 text-muted-foreground">
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
    </div>
  );
}
