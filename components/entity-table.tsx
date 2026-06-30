'use client';

import React, { useState } from 'react';
import { Eye, Edit, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { MaintenanceTable } from '@/components/maintenance-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { MaintenanceLog } from '@/lib/models';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface EntityTableProps {
  columns: Column[];
  data: any[];
  entityName: string;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  getMaintenanceLogs?: (id: number) => Promise<MaintenanceLog[]>;
  isLoading?: boolean;
}

interface ExpandedRow {
  id: number;
  logs: MaintenanceLog[];
  isLoading: boolean;
}

export function EntityTable({
  columns,
  data,
  entityName,
  onView,
  onEdit,
  onDelete,
  getMaintenanceLogs,
  isLoading = false,
}: EntityTableProps) {
  const [expandedRows, setExpandedRows] = useState<Map<number, ExpandedRow>>(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  const toggleExpand = async (id: number) => {
    const current = expandedRows.get(id);
    
    if (current) {
      setExpandedRows(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } else if (getMaintenanceLogs) {
      setExpandedRows(prev => new Map(prev).set(id, { id, logs: [], isLoading: true }));
      
      try {
        const logs = await getMaintenanceLogs(id);
        setExpandedRows(prev => {
          const next = new Map(prev);
          if (next.has(id)) {
            next.set(id, { id, logs, isLoading: false });
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to fetch maintenance logs:', error);
        setExpandedRows(prev => {
          const next = new Map(prev);
          if (next.has(id)) {
            next.set(id, { id, logs: [], isLoading: false });
          }
          return next;
        });
      }
    }
  };

  const handleDelete = (item: any) => {
    setDeleteConfirm({ open: true, id: item.id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id !== null) {
      const item = data.find(d => d.id === deleteConfirm.id);
      if (item && onDelete) {
        onDelete(item);
      }
    }
    setDeleteConfirm({ open: false, id: null });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading {entityName}...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No {entityName.toLowerCase()} found.
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {getMaintenanceLogs && <TableHead className="w-12"></TableHead>}
              {columns.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const isExpanded = expandedRows.has(row.id);
              const expanded = expandedRows.get(row.id);
              
              return (
                <React.Fragment key={row.id}>
                  <TableRow className={cn(
                    'hover:bg-muted/50',
                    isExpanded && 'bg-muted/30'
                  )}>
                    {getMaintenanceLogs && (
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleExpand(row.id)}
                        >
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </Button>
                      </TableCell>
                    )}
                    {columns.map(col => (
                      <TableCell key={col.key} className="text-sm">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(row)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(row)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && expanded && getMaintenanceLogs && (
                    <TableRow className="bg-muted/30 border-b">
                      <TableCell colSpan={100} className="p-4">
                        <div className="space-y-4">
                          <h4 className="font-medium">Maintenance Logs</h4>
                          <MaintenanceTable
                            logs={expanded.logs}
                            isLoading={expanded.isLoading}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Item"
        description={`Are you sure you want to delete this ${entityName.toLowerCase()}? This action cannot be undone.`}
        onConfirm={confirmDelete}
      />
    </>
  );
}
