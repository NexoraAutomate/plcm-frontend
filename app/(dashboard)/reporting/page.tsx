'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { REPORT_REGISTRY } from '@/components/reporting/registry';

export default function ReportingHubPage() {
  const { can } = useAuth();
  const visible = REPORT_REGISTRY.filter((r) => can(r.permission));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate professional dossiers and enterprise reports from live PLCM data.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((report) => (
          <Link key={report.id} href={report.href} className="group">
            <Card className="h-full transition-colors group-hover:border-foreground/30">
              <CardHeader>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/40">
                  <FileText className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs font-medium text-muted-foreground">
                  Open report →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You do not have permission to view any reports.
        </p>
      )}
    </div>
  );
}
