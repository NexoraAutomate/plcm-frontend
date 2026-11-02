'use client';

import { useMemo } from 'react';
import { NodeToolbar, useStore } from '@xyflow/react';
import { Group, Pencil, Ungroup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  areSiblingKeys,
  parseSiblingGroupFlowId,
} from '@/lib/config-tree-layout';
import type { TemplateDraftNode } from '@/lib/hierarchy-config';

type Props = {
  draftNodes: TemplateDraftNode[];
  locked: boolean;
  readOnly: boolean;
  onGroup: (memberIds: string[]) => void;
  onUngroup: (groupId: string) => void;
  onEditGroup: (groupId: string) => void;
};

/**
 * Floating toolbar for multi-select grouping (Shift+click), matching
 * https://reactflow.dev/examples/grouping/selection-grouping — plus named groups.
 */
export function ConfigTreeSelectionToolbar({
  draftNodes,
  locked,
  readOnly,
  onGroup,
  onUngroup,
  onEditGroup,
}: Props) {
  const selected = useStore((s) => s.nodes.filter((n) => n.selected));

  const { mode, anchorId, memberIds, groupId } = useMemo(() => {
    const treeSelected = selected.filter((n) => n.type === 'configTree');
    const groupSelected = selected.filter((n) => n.type === 'siblingGroup');

    if (groupSelected.length === 1 && treeSelected.length === 0) {
      const gid = parseSiblingGroupFlowId(String(groupSelected[0].id));
      return {
        mode: 'edit-group' as const,
        anchorId: groupSelected[0].id,
        memberIds: [] as string[],
        groupId: gid,
      };
    }

    const ids = treeSelected.map((n) => n.id);
    if (ids.length >= 2 && areSiblingKeys(draftNodes, ids)) {
      return {
        mode: 'group' as const,
        anchorId: ids[0],
        memberIds: ids,
        groupId: null as string | null,
      };
    }

    return {
      mode: 'none' as const,
      anchorId: null as string | null,
      memberIds: [] as string[],
      groupId: null as string | null,
    };
  }, [draftNodes, selected]);

  if (locked || readOnly || mode === 'none' || !anchorId) return null;

  return (
    <NodeToolbar
      nodeId={anchorId}
      isVisible
      position="top"
      offset={12}
      className="nodrag nopan flex items-center gap-1 rounded-lg border border-teal-500/25 bg-background/95 p-1 shadow-md backdrop-blur-md"
    >
      {mode === 'group' ? (
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onGroup(memberIds)}
        >
          <Group className="size-3.5" />
          Group nodes
        </Button>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => groupId && onEditGroup(groupId)}
          >
            <Pencil className="size-3.5" />
            Edit group
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5"
            onClick={() => groupId && onUngroup(groupId)}
          >
            <Ungroup className="size-3.5" />
            Ungroup
          </Button>
        </>
      )}
    </NodeToolbar>
  );
}
