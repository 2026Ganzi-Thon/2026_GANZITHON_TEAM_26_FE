import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/** VITE_USE_MOCK=true 이면 MSW로 아직 없는 API를 목업한다. 인증은 실제 서버로 통과(bypass). */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass' });
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
