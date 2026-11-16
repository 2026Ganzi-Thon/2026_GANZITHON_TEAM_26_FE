import type { EmotionCode } from '../types/api';

/**
 * 감정 카드 목록 — Figma 201_H01_마음고르기 기준 11개.
 * code는 백엔드 enum(MoodRecordCreateRequest.emotions)과 동일.
 * TODO(팀): emo 색(1~6) 매핑은 미확정. 지금은 임시로 순서대로 돌려 씀.
 */
export interface Emotion {
  code: EmotionCode;
  label: string;
  emo: 1 | 2 | 3 | 4 | 5 | 6;
}

export const EMOTIONS: Emotion[] = [
  { code: 'UNMOTIVATED', label: '아무것도 하기 싫어요', emo: 1 },
  { code: 'HOPELESS_FUTURE', label: '미래가 막막해요', emo: 2 },
  { code: 'ANXIETY', label: '불안해서 잠이 안 와요', emo: 3 },
  { code: 'LONELY', label: '혼자인 것 같아요', emo: 4 },
  { code: 'EXHAUSTED', label: '지쳐서 아무 생각이 없어요', emo: 5 },
  { code: 'INADEQUATE', label: '내가 부족한 것 같아요', emo: 6 },
  { code: 'NOWHERE_TO_VENT', label: '화를 풀 곳이 없어요', emo: 1 },
  { code: 'TEARFUL', label: '괜히 눈물이 나요', emo: 2 },
  { code: 'RESTLESS', label: '쉬고 싶은데 못 쉬어요', emo: 3 },
  { code: 'OVERWHELMED', label: '사람들이 버거워요', emo: 4 },
  { code: 'UNSURE', label: '잘 모르겠어요', emo: 6 },
];

export const MAX_EMOTIONS = 2;
export const STORY_MAX_LENGTH = 300;
export const PATCH_MAX_LENGTH = 50;
export const BLANKET_SLOTS = 30;

export function emotionLabel(code: EmotionCode | string): string {
  return EMOTIONS.find((e) => e.code === code)?.label ?? code;
}

export function emotionColor(code: EmotionCode | string | null): string {
  const emo = EMOTIONS.find((e) => e.code === code)?.emo;
  return emo ? `var(--color-emo-${emo})` : 'transparent';
}

/** ITR-MAP-001 / Figma 208: 인원 구간 문구 */
export function countLabel(count: number): string {
  if (count < 5) return '몇몇 사람';
  if (count >= 50) return '50명 이상';
  return `${count}명`;
}

/**
 * ALRT-HELP-002 위기 안내 상담 번호 (프론트 고정값)
 * 109: 자살예방상담전화 (2024.1 통합번호, 24시간)
 * 1577-0199: 정신건강위기상담전화 (24시간)
 * TODO(팀): 명세서에 최종 번호 목록 기재 후 맞출 것
 */
export const CRISIS_LINES = [
  { name: '자살예방상담전화', number: '109', note: '24시간' },
  { name: '정신건강위기상담', number: '1577-0199', note: '24시간' },
  { name: '긴급 상황 (구급)', number: '119', note: '즉시 위험할 때' },
];
