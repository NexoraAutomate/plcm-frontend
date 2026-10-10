'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Satellite, Loader2 } from 'lucide-react';
import {
  ActiveSessionConflictError,
  type ExistingActiveSession,
  useAuth,
} from '@/lib/auth-context';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { firstAccessiblePath } from '@/lib/permission-codes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { validateLoginForm } from '@/lib/form-validation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionConflictOpen, setSessionConflictOpen] = useState(false);
  const [sessionConflictMessage, setSessionConflictMessage] = useState('');
  const [existingSession, setExistingSession] = useState<ExistingActiveSession | null>(null);
  const [requiresSuperPassword, setRequiresSuperPassword] = useState(false);
  const [superPassword, setSuperPassword] = useState('');
  const [pendingCredentials, setPendingCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const { login, isAuthenticated, authReady, can, user } = useAuth();
  const router = useRouter();

  async function completeLogin(
    username: string,
    password: string,
    options?: { forceSessionTakeover?: boolean; superPassword?: string }
  ) {
    await login(username, password, options);
    toast.success('Logged in successfully');
    const stored = localStorage.getItem('sat-user');
    let destination = '/executive-dashboard';
    if (stored) {
      try {
        const storedUser = JSON.parse(stored) as {
          permissions?: string[];
          roles?: string[];
        };
        const perms = storedUser.permissions ?? [];
        destination = firstAccessiblePath(
          (p) => {
            const list = Array.isArray(p) ? p : [p];
            return list.some((code) => perms.includes(code));
          },
          storedUser.roles
        );
      } catch {
        /* keep default */
      }
    }
    router.push(destination);
  }

  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) {
      router.replace(firstAccessiblePath(can, user?.roles));
    }
  }, [isAuthenticated, authReady, router, can, user?.roles]);

  function resetSessionConflict() {
    setPendingCredentials(null);
    setExistingSession(null);
    setRequiresSuperPassword(false);
    setSuperPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateLoginForm(username, password)) {
      toast.error('Please enter username and password');
      return;
    }

    setIsLoading(true);
    try {
      await completeLogin(username.trim(), password);
    } catch (err) {
      if (err instanceof ActiveSessionConflictError) {
        setPendingCredentials({ username: username.trim(), password });
        setSessionConflictMessage(err.conflictMessage);
        setExistingSession(err.existingSession);
        setRequiresSuperPassword(err.requiresSuperPassword);
        setSuperPassword('');
        setSessionConflictOpen(true);
      } else {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmSessionTakeover() {
    if (!pendingCredentials) return;
    if (requiresSuperPassword && !superPassword.trim()) {
      toast.error('Enter the admin super password to continue');
      return;
    }
    setIsLoading(true);
    try {
      await completeLogin(pendingCredentials.username, pendingCredentials.password, {
        forceSessionTakeover: true,
        ...(requiresSuperPassword ? { superPassword: superPassword.trim() } : {}),
      });
      setSessionConflictOpen(false);
      resetSessionConflict();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  function formatExistingSessionHint(sessionInfo: ExistingActiveSession | null): string {
    if (!sessionInfo) return '';
    const parts: string[] = [];
    if (sessionInfo.operating_system) parts.push(sessionInfo.operating_system);
    if (sessionInfo.browser) parts.push(sessionInfo.browser);
    if (sessionInfo.ip_address) parts.push(`IP ${sessionInfo.ip_address}`);
    if (parts.length === 0) return '';
    return ` Active session: ${parts.join(' · ')}.`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5" />
      </div>
      <Card className="relative w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Satellite className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Smart SDLS</CardTitle>
          <CardDescription className="text-muted-foreground">
            Product Lifecycle Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username"
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                required
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground pt-2">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Request access
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <AlertDialog
        open={sessionConflictOpen}
        onOpenChange={(open) => {
          setSessionConflictOpen(open);
          if (!open) resetSessionConflict();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already signed in elsewhere</AlertDialogTitle>
            <AlertDialogDescription>
              {sessionConflictMessage ||
                'This user is already logged in on another PC. Signing in here will log them out from that session.'}
              {formatExistingSessionHint(existingSession)}
              {requiresSuperPassword
                ? ' This is an Administrator account. Enter the admin super password to continue.'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requiresSuperPassword ? (
            <div className="space-y-2 py-1">
              <Label htmlFor="admin-super-password">Super password</Label>
              <Input
                id="admin-super-password"
                type="password"
                autoComplete="off"
                value={superPassword}
                onChange={(e) => setSuperPassword(e.target.value)}
                placeholder="Enter admin super password"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleConfirmSessionTakeover();
                  }
                }}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isLoading}
              onClick={() => {
                resetSessionConflict();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isLoading || (requiresSuperPassword && !superPassword.trim())}
              onClick={() => void handleConfirmSessionTakeover()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in and sign out other device'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
