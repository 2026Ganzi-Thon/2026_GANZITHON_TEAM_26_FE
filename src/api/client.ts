import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, TokenReissueResponse } from '../types/api';
import { tokenStorage } from './tokenStorage';

/**
 * axios 인스턴스
 * - 개발: baseURL 비움 → vite.config.ts 프록시가 /api 를 백엔드로 넘김 (CORS 회피)
 * - 배포: VITE_API_BASE_URL 지정 (백엔드가 HTTPS여야 Mixed Content 차단을 피함)
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ───── 401 → refresh 토큰으로 재발급 후 원래 요청 재시도 (동시 요청은 한 번만 재발급) ───── */

let refreshPromise: Promise<string> | null = null;
const onAuthFailureListeners = new Set<() => void>();

/** 재발급까지 실패하면 호출됨 (AuthProvider가 로그인 화면으로 보냄) */
export function onAuthFailure(listener: () => void) {
  onAuthFailureListeners.add(listener);
  return () => onAuthFailureListeners.delete(listener);
}

async function reissueAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');
  // 인터셉터를 타지 않도록 axios 기본 인스턴스 사용
  const res = await axios.post<ApiResponse<TokenReissueResponse>>(
    `${api.defaults.baseURL ?? ''}/api/v1/auth/token/refresh`,
    { refreshToken },
  );
  const { accessToken } = res.data.data;
  tokenStorage.set(accessToken);
  return accessToken;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthCall = original?.url?.includes('/api/v1/auth/');
    if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      refreshPromise ??= reissueAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      tokenStorage.clear();
      onAuthFailureListeners.forEach((fn) => fn());
      return Promise.reject(refreshError);
    }
  },
);

/** ApiResponse 래퍼를 벗겨서 data만 돌려주는 헬퍼 */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}
