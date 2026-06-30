'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, Layers, Code2 } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params.id as string;
  const { components, units, modules, updateComponent } = useDataStore();
  
  const component = components.find((c) => String(c.id) === componentId);
  const unit = component ? units.find((u) => u.id === component.unit_id) : null;
  const module = unit ? modules.find((m) => m.id === unit.module_id) : null;

  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Component Not Found</h2>
        <Link href="/components" className="mt-2 text-sm text-primary underline">
          Back to Components
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/modules">Modules</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/modules/${module?.id}`}>{module?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/units/${unit?.id}`}>{unit?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{component.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href="/components">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{component.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{component.description}</p>
        </div>
      </div>

      {/* Component Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Component ID</p>
              <p className="text-sm font-medium">{component.id}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unit</p>
              <p className="text-sm font-medium">{unit?.name || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Module</p>
              <p className="text-sm font-medium">{module?.name || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-1">
                <StatusBadge status={component.status?.status_name || 'Unknown'} />
                <EntityStatusHistorySheet
                  entityType="component"
                  entityPk={component.id}
                  entityName={component.name}
                  triggerVariant="icon"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityInstallMetadataCard
        ownerType="component"
        entity={component}
        onUpdate={(data) => updateComponent(component.id, data)}
      />

      {/* Component Details */}
      <Card>
        <CardHeader>
          <CardTitle>Component Details</CardTitle>
          <CardDescription>Full information about this component</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-base font-medium mt-1">{component.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={component.status?.status_name || 'Unknown'} />
                  <EntityStatusHistorySheet
                    entityType="component"
                    entityPk={component.id}
                    entityName={component.name}
                    triggerVariant="icon"
                  />
                </div>
              </div>
            </div>
            {component.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-base mt-1">{component.description}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Unit</p>
                <Link href={`/units/${unit?.id}`}>
                  <p className="text-base font-medium text-primary underline mt-1">{unit?.name}</p>
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Module (Parent)</p>
                <Link href={`/modules/${module?.id}`}>
                  <p className="text-base font-medium text-primary underline mt-1">{module?.name}</p>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
