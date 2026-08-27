'use client';

import { useMemo, useRef, useState } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { suggestAbbreviation } from '@/lib/app-definitions';
import { useHierarchiesQuery } from '@/hooks/queries';
import { filterTemplateNames } from '@/lib/hierarchy-template-names';
import {
  CHILD_TEMPLATE_LEVEL,
  INVENTORY_SOURCE,
  INVENTORY_SOURCE_OPTIONS,
  PARENT_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  normalizeInventorySource,
  type InventorySource,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';


export type HierarchyTemplateEditorProps = {
  nodes: TemplateDraftNode[];
  onChange: (nodes: TemplateDraftNode[]) => void;
  readOnly?: boolean;
};

function descendantsOf(nodes: TemplateDraftNode[], clientKey: string): Set<string> {
  const removeKeys = new Set<string>([clientKey]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        node.parent_client_key &&
        removeKeys.has(node.parent_client_key) &&
        !removeKeys.has(node.client_key)
      ) {
        removeKeys.add(node.client_key);
        changed = true;
      }
    }
  }
  return removeKeys;
}

function groupByLevel(nodes: TemplateDraftNode[]) {
  const grouped: Record<TemplateNodeLevel, TemplateDraftNode[]> = {
    system: [],
    subsystem: [],
    module: [],
    unit: [],
    component: [],
  };
  for (const node of nodes) {
    if (grouped[node.level]) grouped[node.level].push(node);
  }
  return grouped;
}

const NODE_WRAP: Record<TemplateNodeLevel, string> = {
  system: 'shadow-sm',
  subsystem: 'border border-border bg-muted',
  module: 'border border-border bg-background',
  unit: '',
  component: '',
};

export function HierarchyTemplateEditor({
  nodes,
  onChange,
  readOnly = false,
}: HierarchyTemplateEditorProps) {
  const { entityLabel } = useAppDefinitions();
  const { data: entityListItems = [] } = useHierarchiesQuery(undefined, !readOnly);
  const levelLabel = (level: TemplateNodeLevel) => entityLabel(level);
  const grouped = useMemo(() => groupByLevel(nodes), [nodes]);

  const [selectedLevel, setSelectedLevel] = useState<TemplateNodeLevel>('system');
  const [newName, setNewName] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [parentByLevel, setParentByLevel] = useState<
    Partial<Record<TemplateNodeLevel, string | null>>
  >({});
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateDraftNode | null>(null);
  const [editTarget, setEditTarget] = useState<TemplateDraftNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editAbbr, setEditAbbr] = useState('');
  const [newInventorySource, setNewInventorySource] = useState<InventorySource>(
    INVENTORY_SOURCE.TURNKEY
  );
  const [editInventorySource, setEditInventorySource] = useState<InventorySource>(
    INVENTORY_SOURCE.TURNKEY
  );
  const addSectionRef = useRef<HTMLDivElement | null>(null);

  const currentParentKey =
    selectedLevel === 'system' ? null : parentByLevel[selectedLevel] ?? null;

  const parentOptions = useMemo(() => {
    const parentLevel = PARENT_TEMPLATE_LEVEL[selectedLevel];
    if (!parentLevel) return [];
    return grouped[parentLevel];
  }, [grouped, selectedLevel]);

  const entityNameOptions = useMemo(() => {
    // Entity List is a flat catalog by level — parent/child is chosen in this
    // configuration tree, not pre-bound in the catalog.
    const alreadyUsed = new Set(
      nodes
        .filter(
          (n) =>
            n.level === selectedLevel &&
            (n.parent_client_key ?? null) === (currentParentKey ?? null)
        )
        .map((n) => n.name.trim().toLowerCase())
    );
    return filterTemplateNames(entityListItems, selectedLevel).filter(
      (item) => !alreadyUsed.has(item.name.trim().toLowerCase())
    );
  }, [currentParentKey, entityListItems, nodes, selectedLevel]);

  const editEntityOptions = useMemo(() => {
    if (!editTarget) return [];
    return filterTemplateNames(entityListItems, editTarget.level);
  }, [editTarget, entityListItems]);

  function setParentForLevel(level: TemplateNodeLevel, key: string | null) {
    setParentByLevel((prev) => {
      const next = { ...prev, [level]: key };
      if (level === 'subsystem') {
        next.module = null;
        next.unit = null;
        next.component = null;
      } else if (level === 'module') {
        next.unit = null;
        next.component = null;
      } else if (level === 'unit') {
        next.component = null;
      }
      return next;
    });
  }

  function handleCreate() {
    if (!newName.trim()) {
      setValidationResult({
        valid: false,
        message: 'Select an entity name from the Entity List.',
      });
      return;
    }
    if (selectedLevel !== 'system' && !currentParentKey) {
      const parentLevel = PARENT_TEMPLATE_LEVEL[selectedLevel];
      setValidationResult({
        valid: false,
        message: `Select a parent ${levelLabel(parentLevel as TemplateNodeLevel)} before adding a ${levelLabel(selectedLevel)}.`,
      });
      return;
    }

    const selectedEntity = entityNameOptions.find((item) => item.name === newName.trim());
    const name = newName.trim();
    const abbreviation = (
      selectedEntity?.abbreviation ||
      newAbbr.trim() ||
      suggestAbbreviation(name)
    ).toUpperCase();
    onChange([
      ...nodes,
      {
        client_key: newClientKey(selectedLevel.slice(0, 3)),
        parent_client_key: currentParentKey,
        level: selectedLevel,
        name,
        abbreviation,
        sort_order: nodes.length,
        inventory_source: INVENTORY_SOURCE.TURNKEY,
      },
    ]);
    setNewName('');
    setNewAbbr('');
    setValidationResult({
      valid: true,
      message: `${levelLabel(selectedLevel)} created.`,
    });
  }


  function confirmDelete() {
    if (!deleteTarget) return;
    const removeKeys = descendantsOf(nodes, deleteTarget.client_key);
    onChange(nodes.filter((n) => !removeKeys.has(n.client_key)));
    setDeleteTarget(null);
    toast.success('Hierarchy item deleted');
  }

  function handleEditSave() {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    const hasChildren = nodes.some(
      (n) => n.parent_client_key === editTarget.client_key
    );
    const inventory_source =
      editTarget.level !== 'component' &&
      hasChildren &&
      editInventorySource === INVENTORY_SOURCE.BUILD_FROM_CHILDREN
        ? INVENTORY_SOURCE.BUILD_FROM_CHILDREN
        : INVENTORY_SOURCE.TURNKEY;
    onChange(
      nodes.map((n) =>
        n.client_key === editTarget.client_key
          ? {
              ...n,
              name: editName.trim(),
              abbreviation: (editAbbr.trim() || suggestAbbreviation(editName)).toUpperCase(),
              inventory_source,
            }
          : n
      )
    );
    setEditTarget(null);
    toast.success('Hierarchy item updated');
  }

  function prepareAddChild(level: TemplateNodeLevel, parent: TemplateDraftNode) {
    setSelectedLevel(level);
    setNewName('');
    setNewAbbr('');
    setParentForLevel(level, parent.client_key);
    addSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderActions(node: TemplateDraftNode) {
    const childLevel = CHILD_TEMPLATE_LEVEL[node.level];
    if (readOnly) return null;
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={() => {
            setEditTarget(node);
            setEditName(node.name);
            setEditAbbr((node.abbreviation || suggestAbbreviation(node.name)).toUpperCase());
            setEditInventorySource(normalizeInventorySource(node.inventory_source));
          }}
          aria-label={`Edit ${node.level}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
        {childLevel ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => prepareAddChild(childLevel, node)}
            aria-label={`Add ${childLevel}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteTarget(node)}
          aria-label={`Delete ${node.level}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderNode(node: TemplateDraftNode) {
    const childLevel = CHILD_TEMPLATE_LEVEL[node.level];
    const children = childLevel
      ? grouped[childLevel].filter((c) => c.parent_client_key === node.client_key)
      : [];
    const abbr = node.abbreviation ? ` [${node.abbreviation}]` : '';
    const sourceLabel =
      normalizeInventorySource(node.inventory_source) ===
      INVENTORY_SOURCE.BUILD_FROM_CHILDREN
        ? 'Build'
        : 'Turnkey';

    if (node.level === 'component') {
      return (
        <Badge key={node.client_key} className="flex items-center justify-between gap-2">
          <span>
            {node.name}
            {abbr}
          </span>
          {renderActions(node)}
        </Badge>
      );
    }

    const inner = (
      <>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-card-foreground">
              {node.name}
              {abbr}
            </div>
            <div className="text-[11px] text-muted-foreground">{sourceLabel}</div>
            <div className="text-xs text-muted-foreground">{levelLabel(node.level)}</div>
          </div>
          {renderActions(node)}
        </div>
        {childLevel ? (
          <div className={node.level === 'component' ? '' : 'space-y-2 pt-3'}>
            {children.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No {entityLabel(childLevel, true).toLowerCase()} defined.
              </p>
            ) : node.level === 'unit' ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {children.map(renderNode)}
              </div>
            ) : (
              children.map(renderNode)
            )}
          </div>
        ) : null}
      </>
    );

    if (node.level === 'unit') {
      return (
        <div key={node.client_key} className="rounded-lg border border-border bg-muted p-3">
          {inner}
        </div>
      );
    }

    if (node.level === 'system') {
      return (
        <Card key={node.client_key} className={NODE_WRAP.system}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-card-foreground">
                  {node.name}
                  {abbr}
                </div>
                <div className="text-xs text-muted-foreground">{levelLabel('system')}</div>
              </div>
              {renderActions(node)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {children.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {entityLabel('subsystem', true).toLowerCase()} defined.
              </p>
            ) : (
              children.map(renderNode)
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={node.client_key} className={NODE_WRAP[node.level]}>
        <CardContent className="space-y-3 py-4">{inner}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <div ref={addSectionRef}>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Add Configuration Node</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Pick any registered name from the Entity List for this level. Parent/child
                links are defined here in the configuration — not in the Entity List catalog.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category (level)</Label>
                  <Select
                    value={selectedLevel}
                    onValueChange={(value) => {
                      const level = value as TemplateNodeLevel;
                      setSelectedLevel(level);
                      if (level === 'system') {
                        setParentByLevel({});
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_NODE_LEVELS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {entityLabel(key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLevel !== 'system' ? (
                  <div className="space-y-2">
                    <Label>
                      {levelLabel(PARENT_TEMPLATE_LEVEL[selectedLevel] as TemplateNodeLevel)}
                    </Label>
                    <Select
                      value={currentParentKey ?? '0'}
                      onValueChange={(value) =>
                        setParentForLevel(selectedLevel, value === '0' ? null : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={`Select ${levelLabel(PARENT_TEMPLATE_LEVEL[selectedLevel] as TemplateNodeLevel)}`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {parentOptions.map((item) => (
                          <SelectItem key={item.client_key} value={item.client_key}>
                            {item.name || item.client_key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Entity name</Label>
                  <Select
                    value={newName || '0'}
                    onValueChange={(value) => {
                      const name = value === '0' ? '' : value;
                      setNewName(name);
                      const match = entityNameOptions.find((item) => item.name === name);
                      if (match?.abbreviation) {
                        setNewAbbr(match.abbreviation.toUpperCase());
                      }
                    }}
                    disabled={entityNameOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          entityNameOptions.length === 0
                            ? 'No entities in Entity List for this level'
                            : `Select ${levelLabel(selectedLevel)}`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Select…</SelectItem>
                      {entityNameOptions.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name}
                          {item.abbreviation ? ` (${item.abbreviation})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Inventory Source</Label>
                  <RadioGroup
                    value={newInventorySource}
                    onValueChange={(value) =>
                      setNewInventorySource(normalizeInventorySource(value))
                    }
                    className="gap-2"
                  >
                    {INVENTORY_SOURCE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <RadioGroupItem
                          value={option.value}
                          disabled={
                            option.value === INVENTORY_SOURCE.BUILD_FROM_CHILDREN
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    New nodes start as Turnkey. After you add children, edit the node
                    to switch it to Build from Children.
                  </p>
                </div>

                <div className="flex flex-col gap-3 md:col-span-2">
                  <Button type="button" onClick={handleCreate} disabled={!newName.trim()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add {levelLabel(selectedLevel)}
                  </Button>
                  {validationResult ? (
                    <div
                      className={`rounded-lg border p-3 text-sm ${
                        validationResult.valid
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-red-200 bg-red-50 text-red-800'
                      }`}
                    >
                      {validationResult.message}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Confirm delete"
        description={`Delete "${deleteTarget?.name ?? 'item'}" and all its descendants from this configuration.`}
        onConfirm={confirmDelete}
      />

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Configuration Node</DialogTitle>
            <DialogDescription>
              Choose a different entity name from the Entity List. Abbreviation is taken from the
              catalog entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Entity name</Label>
              <Select
                value={editName || '0'}
                onValueChange={(value) => {
                  const name = value === '0' ? '' : value;
                  setEditName(name);
                  const match = editEntityOptions.find((item) => item.name === name);
                  if (match?.abbreviation) {
                    setEditAbbr(match.abbreviation.toUpperCase());
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select…</SelectItem>
                  {editEntityOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                      {item.abbreviation ? ` (${item.abbreviation})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Inventory Source</Label>
              <RadioGroup
                value={editInventorySource}
                onValueChange={(value) =>
                  setEditInventorySource(normalizeInventorySource(value))
                }
                className="gap-2"
              >
                {INVENTORY_SOURCE_OPTIONS.map((option) => {
                  const hasChildren = Boolean(
                    editTarget &&
                      nodes.some((n) => n.parent_client_key === editTarget.client_key)
                  );
                  const disabled =
                    option.value === INVENTORY_SOURCE.BUILD_FROM_CHILDREN &&
                    (editTarget?.level === 'component' || !hasChildren);
                  return (
                    <label
                      key={option.value}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <RadioGroupItem
                        value={option.value}
                        disabled={disabled}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hierarchy items found yet.</p>
        ) : (
          grouped.system.map(renderNode)
        )}
      </div>
    </div>
  );
}
