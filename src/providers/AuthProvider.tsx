import { isAxiosError } from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

  // 진행 중인 로그아웃 요청 — 중복 클릭 시 같은 요청을 기다리게 함
  const logoutPromise = useRef<Promise<void> | null>(null);

  const logout = useCallback(() => {
    logoutPromise.current ??= (async () => {
      try {
        await authApi.logout();
      } catch (err) {
        // 같은 토큰으로 두 번째 호출부터는 401 — 이미 로그아웃된 상태라 에러로 취급하지 않음
        if (!(isAxiosError(err) && err.response?.status === 401)) throw err;
      } finally {
        tokenStorage.clear();
        setLoggedIn(false);
        logoutPromise.current = null;
      }
    })();
    return logoutPromise.current;
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
