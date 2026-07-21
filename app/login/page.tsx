'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Satellite, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { firstAccessiblePath } from '@/lib/permission-codes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, authReady, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) {
      router.replace(firstAccessiblePath(can));
    }
  }, [isAuthenticated, authReady, router, can]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Logged in successfully');
      const stored = localStorage.getItem('sat-user');
      let destination = '/executive-dashboard';
      if (stored) {
        try {
          const user = JSON.parse(stored) as { permissions?: string[] };
          const perms = user.permissions ?? [];
          destination = firstAccessiblePath((p) => {
            const list = Array.isArray(p) ? p : [p];
            return list.some((code) => perms.includes(code));
          });
        } catch {
          /* keep default */
        }
      }
      router.push(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
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
    </div>
  );
}
