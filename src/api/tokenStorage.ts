/**
 * 토큰 저장소.
 * 현재 Swagger는 refreshToken을 body로 주고받으므로 localStorage에 둔다.
 * TODO(백엔드): httpOnly 쿠키로 바뀌면 refreshToken 관련 코드를 지우면 된다.
 */
const ACCESS_KEY = 'patch.accessToken';
const REFRESH_KEY = 'patch.refreshToken';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

export const tokenStorage = {
  getAccess: () => safeGet(ACCESS_KEY),
  getRefresh: () => safeGet(REFRESH_KEY),
  set(access: string, refresh?: string) {
    safeSet(ACCESS_KEY, access);
    if (refresh !== undefined) safeSet(REFRESH_KEY, refresh);
  },
  clear() {
    safeSet(ACCESS_KEY, null);
    safeSet(REFRESH_KEY, null);
  },
};
