import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), svgr()],
    server: {
      port: 5173,
      // 개발 중 /api 요청을 백엔드로 넘김 → CORS 설정 없이도 동작
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'https://nyam17.site',
          changeOrigin: true,
        },
      },
    },
  };
});
