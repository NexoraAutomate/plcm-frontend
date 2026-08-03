import { AppShell } from '@/components/app-shell';
import { DataStoreProvider } from '@/lib/data-store';
import { AppDefinitionsProvider } from '@/lib/app-definitions-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataStoreProvider>
      <AppDefinitionsProvider>
        <AppShell>{children}</AppShell>
      </AppDefinitionsProvider>
    </DataStoreProvider>
  );
}
