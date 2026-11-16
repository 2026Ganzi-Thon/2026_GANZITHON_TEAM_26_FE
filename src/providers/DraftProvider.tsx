/**
 * 마음 기록 작성 중 상태 (CRD-WRITE-001 감정 선택 · CRD-WRITE-002 사연)
 * 서버 저장은 '들어가기'(CRD-WRITE-003) 시점에 한 번에 한다.
 * TODO(팀): 사연 '저장' 시점 위기 검사를 별도 API로 할지 결정되면 여기 반영.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EmotionCode } from '../types/api';

interface DraftContextValue {
  emotions: EmotionCode[];
  setEmotions: (e: EmotionCode[]) => void;
  story: string;
  setStory: (s: string) => void;
  reset: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [emotions, setEmotions] = useState<EmotionCode[]>([]);
  const [story, setStory] = useState('');
  const value = useMemo(
    () => ({
      emotions,
      setEmotions,
      story,
      setStory,
      reset: () => {
        setEmotions([]);
        setStory('');
      },
    }),
    [emotions, story],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used within DraftProvider');
  return ctx;
}
