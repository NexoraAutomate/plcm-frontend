'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as Models from './models';

interface AuthContextType {
  user: Models.User | null;
  isAuthenticated: boolean;
  /** True after localStorage session hydration completes (avoids redirect churn). */
  authReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasAccess: (roles?: string[], permissions?: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sat-user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('sat-user');
        localStorage.removeItem('token');
      }
    }
    setAuthReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api' ||'http://193.193.193.80:8000/api';
    // const apiUrl = 'http://192.168.1.10:8000/api';
    
    // ✅ Create form-encoded body (IMPORTANT)
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData, // ✅ NOT JSON.stringify
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();

    // ✅ Store token
    localStorage.setItem('token', data.access_token);

    // Optional (like your pet project)
    document.cookie = `token=${data.access_token}; path=/;`;

    // Fetch user info using token
    const userResponse = await fetch(`${apiUrl}/auth/me/`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json();
    const userDataWithRole = {
      ...userData,
      roles: Array.isArray(userData.roles)
        ? userData.roles.map((r: { name?: string } | string) =>
            typeof r === 'string' ? r : r.name
          ).filter(Boolean)
        : [],
    };
    
    setUser(userDataWithRole);
    localStorage.setItem('sat-user', JSON.stringify(userDataWithRole));

  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sat-user');
    localStorage.removeItem('token');
  }, []);

  const hasAccess = () => true; // Placeholder for actual access control logic

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, authReady, login, logout, hasAccess }}
    >
      {children}
    </AuthContext.Provider>
  );


}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
