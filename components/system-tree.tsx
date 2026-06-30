"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { System, Subsystem, Module, Unit, SatComponent } from "@/lib/dummy-data";

interface TreeNodeProps {
  label: string;
  type: string;
  status: string;
  serialNumber?: string;
  children?: React.ReactNode;
  hasChildren?: boolean;
  onMaintenance?: () => void;
  depth?: number;
}

function TreeNode({
  label,
  type,
  status,
  serialNumber,
  children,
  hasChildren,
  onMaintenance,
  depth = 0,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors group",
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 shrink-0">
          {type}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 truncate">
          {label}
        </span>
        {serialNumber && (
          <span className="text-[10px] font-mono text-muted-foreground hidden lg:inline">
            {serialNumber}
          </span>
        )}
        <StatusBadge status={status} className="text-[10px]" />
        {onMaintenance && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onMaintenance}
          >
            <Wrench className="h-3 w-3" />
          </Button>
        )}
      </div>
      {expanded && children}
    </div>
  );
}

interface SystemTreeProps {
  systems: System[];
  onShowMaintenance?: (entityId: string, entityName: string) => void;
}

export function SystemTree({ systems: systemList, onShowMaintenance }: SystemTreeProps) {
  function renderComponent(comp: SatComponent, depth: number) {
    return (
      <TreeNode
        key={comp.id}
        label={comp.name}
        type="Component"
        status={comp.status}
        serialNumber={comp.serialNumber}
        depth={depth}
        onMaintenance={
          onShowMaintenance
            ? () => onShowMaintenance(comp.id, comp.name)
            : undefined
        }
      />
    );
  }

  function renderUnit(unit: Unit, depth: number) {
    return (
      <TreeNode
        key={unit.id}
        label={unit.name}
        type="Unit"
        status={unit.status}
        serialNumber={unit.serialNumber}
        hasChildren={unit.components.length > 0}
        depth={depth}
        onMaintenance={
          onShowMaintenance
            ? () => onShowMaintenance(unit.id, unit.name)
            : undefined
        }
      >
        {unit.components.map((c) => renderComponent(c, depth + 1))}
      </TreeNode>
    );
  }

  function renderModule(mod: Module, depth: number) {
    return (
      <TreeNode
        key={mod.id}
        label={mod.name}
        type="Module"
        status={mod.status}
        serialNumber={mod.serialNumber}
        hasChildren={mod.units.length > 0}
        depth={depth}
        onMaintenance={
          onShowMaintenance
            ? () => onShowMaintenance(mod.id, mod.name)
            : undefined
        }
      >
        {mod.units.map((u) => renderUnit(u, depth + 1))}
      </TreeNode>
    );
  }

  function renderSubsystem(sub: Subsystem, depth: number) {
    return (
      <TreeNode
        key={sub.id}
        label={sub.name}
        type="Subsystem"
        status={sub.status}
        serialNumber={sub.serialNumber}
        hasChildren={sub.modules.length > 0}
        depth={depth}
        onMaintenance={
          onShowMaintenance
            ? () => onShowMaintenance(sub.id, sub.name)
            : undefined
        }
      >
        {sub.modules.map((m) => renderModule(m, depth + 1))}
      </TreeNode>
    );
  }

  return (
    <div className="space-y-0.5">
      {systemList.map((sys) => (
        <TreeNode
          key={sys.id}
          label={sys.name}
          type="System"
          status={sys.status}
          serialNumber={sys.serialNumber}
          hasChildren={sys.subsystems.length > 0}
          depth={0}
          onMaintenance={
            onShowMaintenance
              ? () => onShowMaintenance(sys.id, sys.name)
              : undefined
          }
        >
          {sys.subsystems.map((sub) => renderSubsystem(sub, 1))}
        </TreeNode>
      ))}
    </div>
  );
}
