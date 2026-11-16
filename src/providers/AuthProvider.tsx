import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { onAuthFailure } from '../api/client';
import { tokenStorage } from '../api/tokenStorage';
import type { LoginRequest } from '../types/api';

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (body: LoginRequest) => Promise<{ isOnboardingCompleted: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setLoggedIn] = useState(() => !!tokenStorage.getAccess());

  // refresh까지 실패하면 로그아웃 상태로
  useEffect(() => {
    const unsubscribe = onAuthFailure(() => setLoggedIn(false));
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (body: LoginRequest) => {
    const res = await authApi.login(body);
    tokenStorage.set(res.accessToken, res.refreshToken);
    setLoggedIn(true);
    return { isOnboardingCompleted: res.isOnboardingCompleted };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      tokenStorage.clear();
      setLoggedIn(false);
    }
  }, []);

  const value = useMemo(() => ({ isLoggedIn, login, logout }), [isLoggedIn, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
