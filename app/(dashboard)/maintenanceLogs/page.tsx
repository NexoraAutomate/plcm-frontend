'use client';

import { useState } from 'react';
import type * as Models from '@/lib/models';
import { entities } from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function MaintenancePage() {
  const { maintenanceLogs, users, loading, createMaintenanceLog } = useDataStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<typeof maintenanceLogs[0] | null>(null);
  const [formData, setFormData] = useState({
    part_number: '',
    entity_id: 0,
    performed_by: 0,
    notes: '',
    maintenance_type: 'preventive',
  });
  type LookupEntity = Models.Entity & {
    parents?: Models.Entity[];
    children?: Models.Entity[];
  };
  const [lookupResult, setLookupResult] = useState<LookupEntity | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const filtered = maintenanceLogs.filter((log) => {
    const entityName = log.entity?.display_name || `Entity #${log.entity_id}`;
    const matchesSearch =
      entityName.toLowerCase().includes(search.toLowerCase()) ||
      (log.notes?.toLowerCase() ?? '').includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.maintenance_type === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCreate() {
    if (!formData.entity_id || !formData.performed_by || !formData.notes.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createMaintenanceLog({
        entity_id: formData.entity_id,
        performed_by: formData.performed_by,
        notes: formData.notes,
        maintenance_type: formData.maintenance_type,
      });
      setFormData({
        part_number: '',
        entity_id: 0,
        performed_by: 0,
        notes: '',
        maintenance_type: 'preventive',
      });
      setLookupResult(null);
      setLookupError('');
      setIsCreateOpen(false);
    } catch {
      // Error handled by DataStore
    }
  }

  const handleLookup = async () => {
    if (!formData.part_number.trim()) {
      toast.error('Enter a part number to lookup');
      return;
    }

    setLookupError('');
    setIsLookupLoading(true);

    try {
      const res = await entities.lookupByPartNumber(formData.part_number.trim());
      const entity = res.data as LookupEntity;

      if (!entity || !entity.id) {
        throw new Error('No entity found for that part number');
      }

      setLookupResult(entity);
      setFormData((prev) => ({ ...prev, entity_id: entity.id }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      setLookupResult(null);
      setLookupError(message);
      toast.error(message);
    } finally {
      setIsLookupLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">maintenanceLogs</h1>
        <p className="text-muted-foreground mt-2">Find an entity by part number, inspect its hierarchy, and log maintenance activity.</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by entity name or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="preventive">Preventive</SelectItem>
            <SelectItem value="corrective">Corrective</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Log maintenanceLogs
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log maintenanceLogs</DialogTitle>
              <DialogDescription>Record a maintenanceLogs activity</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="part_number">Part Number *</Label>
                <div className="flex gap-2">
                  <Input
                    id="part_number"
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="Enter part number to search"
                  />
                  <Button type="button" onClick={handleLookup} disabled={isLookupLoading}>
                    {isLookupLoading ? 'Searching...' : 'Lookup'}
                  </Button>
                </div>
                {lookupError && (
                  <p className="text-sm text-destructive">{lookupError}</p>
                )}
              </div>

              {lookupResult && (
                <div className="rounded-lg border p-4 bg-muted/5">
                  <p className="text-sm font-semibold">{lookupResult.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Type: {lookupResult.entity_type}
                  </p>
                  <p className="text-sm text-muted-foreground">ID: {lookupResult.id}</p>

                  {lookupResult.parents?.length ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Parent hierarchy</p>
                      <ul className="list-disc list-inside text-sm">
                        {lookupResult.parents.map((parent) => (
                          <li key={parent.id}>
                            {parent.entity_type} · {parent.display_name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {lookupResult.children?.length ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Child hierarchy</p>
                      <ul className="list-disc list-inside text-sm">
                        {lookupResult.children.map((child) => (
                          <li key={child.id}>
                            {child.entity_type} · {child.display_name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
              <div>
                <Label>Type *</Label>
                <Select
                  value={formData.maintenance_type}
                  onValueChange={(v) => setFormData({ ...formData, maintenance_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Technician *</Label>
                <Select
                  value={formData.performed_by.toString()}
                  onValueChange={(v) => setFormData({ ...formData, performed_by: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes *</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Describe the maintenance work or issue"
                  className="h-20"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Log</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>maintenanceLogs History</CardTitle>
          <CardDescription>Total records: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No maintenanceLogs records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => {
                    const entityName = log.entity?.display_name || `Entity #${log.entity_id}`;
                    const technician = users.find((u) => u.id === log.performed_by);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{entityName}</TableCell>
                        <TableCell className="capitalize">{log.maintenance_type}</TableCell>
                        <TableCell>{technician?.full_name || 'N/A'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>maintenanceLogs Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <Label>Entity</Label>
                <p className="text-sm">
                  {selectedLog.entity?.display_name || `Entity #${selectedLog.entity_id}`}
                </p>
              </div>
              <div>
                <Label>Type</Label>
                <p className="text-sm capitalize">{selectedLog.maintenance_type}</p>
              </div>
              <div>
                <Label>Technician</Label>
                <p className="text-sm">
                  {users.find((u) => u.id === selectedLog.performed_by)?.full_name}
                </p>
              </div>
              <div>
                <Label>Date</Label>
                <p className="text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <div>
                <Label>Notes</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedLog.notes}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
