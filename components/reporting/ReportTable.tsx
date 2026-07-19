'use client';

import { cn } from '@/lib/utils';

export interface ReportTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface ReportTableProps<T extends Record<string, unknown>> {
  columns: ReportTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  className?: string;
  dense?: boolean;
}

export function ReportTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = 'No data available',
  className,
  dense = true,
}: ReportTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'font-medium text-muted-foreground',
                  dense ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-border/60 last:border-0 even:bg-muted/20"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'text-foreground',
                      dense ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
