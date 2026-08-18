'use client';

import { useMemo, useRef, useState } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { JsonBatchUploadButton } from '@/components/settings/json-batch-upload-button';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { suggestAbbreviation } from '@/lib/app-definitions';
import {
  CHILD_TEMPLATE_LEVEL,
  PARENT_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';

const LEVEL_SET = new Set<string>(TEMPLATE_NODE_LEVELS);

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
  const [validateSystemKey, setValidateSystemKey] = useState<string | null>(null);
  const [validateSubsystemKey, setValidateSubsystemKey] = useState<string | null>(null);
  const addSectionRef = useRef<HTMLDivElement | null>(null);

  const currentParentKey =
    selectedLevel === 'system' ? null : parentByLevel[selectedLevel] ?? null;

  const parentOptions = useMemo(() => {
    const parentLevel = PARENT_TEMPLATE_LEVEL[selectedLevel];
    if (!parentLevel) return [];
    return grouped[parentLevel];
  }, [grouped, selectedLevel]);

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
      setValidationResult({ valid: false, message: 'Hierarchy name is required.' });
      return;
    }
    if (selectedLevel !== 'system' && !currentParentKey) {
      const parentLevel = PARENT_TEMPLATE_LEVEL[selectedLevel];
      setValidationResult({
        valid: false,
        message: `Select a parent ${levelLabel(parentLevel as TemplateNodeLevel)} before creating a ${levelLabel(selectedLevel)}.`,
      });
      return;
    }

    const name = newName.trim();
    const abbreviation = (newAbbr.trim() || suggestAbbreviation(name)).toUpperCase();
    onChange([
      ...nodes,
      {
        client_key: newClientKey(selectedLevel.slice(0, 3)),
        parent_client_key: currentParentKey,
        level: selectedLevel,
        name,
        abbreviation,
        sort_order: nodes.length,
      },
    ]);
    setNewName('');
    setNewAbbr('');
    setValidationResult({
      valid: true,
      message: `${levelLabel(selectedLevel)} created.`,
    });
  }

  function handleBatchUpload(items: unknown[]) {
    const existingKeys = new Map(nodes.map((n, index) => [index + 1, n.client_key]));
    const imported: TemplateDraftNode[] = [];
    const importIds = new Map<number, string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`Item at index ${i} must be an object.`);
      }
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const hierarchyType =
        typeof record.hierarchy_type === 'string'
          ? record.hierarchy_type.trim().toLowerCase()
          : typeof record.level === 'string'
            ? record.level.trim().toLowerCase()
            : '';

      if (!name) {
        throw new Error(`Item at index ${i} is missing a valid name.`);
      }
      if (!LEVEL_SET.has(hierarchyType)) {
        throw new Error(
          `Item at index ${i} has an invalid hierarchy_type. Expected one of: ${TEMPLATE_NODE_LEVELS.join(', ')}.`
        );
      }

      const clientKey =
        typeof record.client_key === 'string' && record.client_key.trim()
          ? record.client_key.trim()
          : newClientKey(hierarchyType.slice(0, 3));
      const seqId = nodes.length + i + 1;
      importIds.set(seqId, clientKey);

      let parentKey: string | null = null;
      if (typeof record.parent_client_key === 'string' && record.parent_client_key.trim()) {
        parentKey = record.parent_client_key.trim();
      } else if ('parent_id' in record) {
        if (record.parent_id === null || record.parent_id === undefined) {
          parentKey = null;
        } else if (typeof record.parent_id === 'number' && Number.isFinite(record.parent_id)) {
          parentKey =
            existingKeys.get(record.parent_id) ??
            importIds.get(record.parent_id) ??
            null;
          if (hierarchyType !== 'system' && !parentKey) {
            throw new Error(
              `Item at index ${i} parent_id ${record.parent_id} was not found. Use 1-based indexes of existing nodes then this file.`
            );
          }
        } else {
          throw new Error(`Item at index ${i} has an invalid parent_id.`);
        }
      }

      const expectedParent = PARENT_TEMPLATE_LEVEL[hierarchyType as TemplateNodeLevel];
      if (expectedParent && !parentKey) {
        throw new Error(
          `Item at index ${i} (${hierarchyType}) requires parent_id matching a ${expectedParent}.`
        );
      }

      const abbreviation =
        typeof record.abbreviation === 'string' && record.abbreviation.trim()
          ? record.abbreviation.trim().toUpperCase()
          : suggestAbbreviation(name);

      imported.push({
        client_key: clientKey,
        parent_client_key: hierarchyType === 'system' ? null : parentKey,
        level: hierarchyType as TemplateNodeLevel,
        name,
        description: typeof record.description === 'string' ? record.description : null,
        abbreviation,
        sort_order: nodes.length + i,
      });
    }

    onChange([...nodes, ...imported]);
    toast.success(`Imported ${imported.length} hierarchy item${imported.length === 1 ? '' : 's'}`);
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
    onChange(
      nodes.map((n) =>
        n.client_key === editTarget.client_key
          ? {
              ...n,
              name: editName.trim(),
              abbreviation: (editAbbr.trim() || suggestAbbreviation(editName)).toUpperCase(),
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

  function validateAssignment() {
    if (!validateSystemKey || !validateSubsystemKey) {
      setValidationResult({
        valid: false,
        message: `Select a ${levelLabel('system')} and ${levelLabel('subsystem')} to validate the relationship.`,
      });
      return;
    }
    const subsystem = grouped.subsystem.find((item) => item.client_key === validateSubsystemKey);
    const valid = subsystem?.parent_client_key === validateSystemKey;
    setValidationResult({
      valid: !!valid,
      message: valid
        ? `This ${levelLabel('subsystem').toLowerCase()} belongs to the selected ${levelLabel('system').toLowerCase()}.`
        : `This ${levelLabel('subsystem').toLowerCase()} is not connected to that ${levelLabel('system').toLowerCase()}.`,
    });
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
        <div className="flex justify-end">
          <JsonBatchUploadButton onUpload={handleBatchUpload} />
        </div>
      ) : null}

      {!readOnly ? (
        <div ref={addSectionRef}>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Add Hierarchy Item</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Or upload a JSON array with <code className="text-xs">name</code>,{' '}
                <code className="text-xs">hierarchy_type</code>, optional{' '}
                <code className="text-xs">abbreviation</code>,{' '}
                <code className="text-xs">description</code>, and <code className="text-xs">parent_id</code>{' '}
                (1-based index of existing nodes, then items in this file).
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hierarchy Level</Label>
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
                  <Label>{levelLabel(selectedLevel)} Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={`e.g. Primary ${levelLabel(selectedLevel)}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Abbreviation</Label>
                  <Input
                    className="font-mono uppercase"
                    value={newAbbr}
                    onChange={(e) => setNewAbbr(e.target.value.toUpperCase())}
                    placeholder={suggestAbbreviation(newName) || 'e.g. ACU'}
                  />
                </div>

                <div className="flex flex-col gap-3 md:col-span-2">
                  <Button type="button" onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {levelLabel(selectedLevel)}
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

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Hierarchy Validator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{levelLabel('system')}</Label>
              <Select
                value={validateSystemKey ?? '0'}
                onValueChange={(value) => setValidateSystemKey(value === '0' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${levelLabel('system')}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.system.map((system) => (
                    <SelectItem key={system.client_key} value={system.client_key}>
                      {system.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{levelLabel('subsystem')}</Label>
              <Select
                value={validateSubsystemKey ?? '0'}
                onValueChange={(value) => setValidateSubsystemKey(value === '0' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${levelLabel('subsystem')}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.subsystem.map((subsystem) => (
                    <SelectItem key={subsystem.client_key} value={subsystem.client_key}>
                      {subsystem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={validateAssignment}>
                Validate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <DialogTitle>Edit Hierarchy Item</DialogTitle>
            <DialogDescription>Update the name and abbreviation for this template node.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Abbreviation</Label>
              <Input
                className="font-mono uppercase"
                value={editAbbr}
                onChange={(e) => setEditAbbr(e.target.value.toUpperCase())}
              />
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
