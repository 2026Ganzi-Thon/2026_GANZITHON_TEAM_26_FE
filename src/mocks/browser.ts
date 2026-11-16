import { setupWorker } from 'msw/browser';
import { featureHandlers, serverHandlers } from './handlers';

/** VITE_MOCK_AUTH=true: 서버에 있는 API(인증·마음 기록 등)까지 목업 — 백엔드 없이 시연할 때 */
const mockServer = import.meta.env.VITE_MOCK_AUTH === 'true';

export const worker = setupWorker(...featureHandlers, ...(mockServer ? serverHandlers : []));
