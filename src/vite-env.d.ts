/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  /** 배포 시 백엔드 주소 (개발 중에는 비워 두고 vite 프록시 사용) */
  readonly VITE_API_BASE_URL?: string;
  /** 개발 프록시 대상 */
  readonly VITE_PROXY_TARGET?: string;
  /** 'true'면 MSW 목업 사용 */
  readonly VITE_USE_MOCK?: string;
  /** 'true'면 인증까지 목업 (서버가 꺼져 있을 때) */
  readonly VITE_MOCK_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
