'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { LocationTreeEditor } from '@/components/settings/location-tree-editor';
import { usePageDataRefresh } from '@/components/page-data-refresh';
import { useAuth } from '@/lib/auth-context';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import * as api from '@/lib/api';
import { P } from '@/lib/permission-codes';
import {
  normalizeLocationTree,
  type InventoryLocationTree,
} from '@/lib/inventory-location-tree';

export function StorageLocationsPanel() {
  const { can } = useAuth();
  const { refresh: refreshGlobal } = useAppDefinitions();
  const canManage = can([P.edit_inventory, P.manage_settings]);

  const [tree, setTree] = useState<InventoryLocationTree>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auth.getAppDefinitions();
      setTree(normalizeLocationTree(res.data.inventory_location_tree));
      setDirty(false);
    } catch {
      toast.error('Failed to load storage locations');
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePageDataRefresh(load);

  const onChange = useCallback((next: InventoryLocationTree) => {
    setTree(normalizeLocationTree(next));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.auth.updateAppDefinitions({
        inventory_location_tree: normalizeLocationTree(tree),
      });
      setTree(normalizeLocationTree(res.data.inventory_location_tree));
      setDirty(false);
      await refreshGlobal();
      toast.success('Storage locations saved');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save storage locations';
      toast.error(typeof detail === 'string' ? detail : 'Failed to save storage locations');
    } finally {
      setSaving(false);
    }
  }, [refreshGlobal, tree]);

  if (!canManage) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You need edit inventory permission to manage storage locations."
      />
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save locations'}
        </Button>
        {dirty ? (
          <p className="text-xs text-muted-foreground">Unsaved changes</p>
        ) : null}
      </div>
      <LocationTreeEditor value={tree} onChange={onChange} />
      <p className="text-xs text-muted-foreground">
        Use Add / Edit / Delete on each node. Room and Cabinet Add asks sibling or child; Rack Add
        only creates a sibling. Inventory forms pick Room first, then Cabinet, then Rack.
      </p>
    </div>
  );
}
