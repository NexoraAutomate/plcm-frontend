import { DataStoreProvider } from '@/lib/data-store';

export default function LoginUsersLayout({ children }: { children: React.ReactNode }) {
  return <DataStoreProvider>{children}</DataStoreProvider>;
}
