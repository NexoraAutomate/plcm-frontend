import { AppShell } from '@/components/app-shell';
import { DataStoreProvider } from '@/lib/data-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataStoreProvider>
      <AppShell>{children}</AppShell>
    </DataStoreProvider>
  );
}
