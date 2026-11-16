/**
 * 목업용 인메모리 DB — 화면끼리 상태가 이어지도록 한 곳에서 관리한다. 새로고침하면 초기화.
 */
import { BLANKET_SLOTS, EMOTIONS } from '../constants/emotions';
import type { EmotionCode, ReceivedPatch } from '../types/api';

export interface MockRecord {
  id: number;
  recordedAt: string; // ISO
  date: string; // YYYY-MM-DD
  emotions: EmotionCode[];
  story?: string;
  todayIndex: number;
  patches: { emotion: EmotionCode; status: 'RECEIVED' | 'NOT_RECEIVED' | 'DEFAULT_COMFORT'; message?: string }[];
}

interface QueuedPatch {
  id: number;
  emotion: EmotionCode;
  message: string;
  fromMe: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());

const SEED_MESSAGES = [
  '자소서 쓰다 막힐 땐 산책 10분 하고 왔어요',
  '혼자인 것 같던 날, 라디오를 틀어두니 덜 외로웠어요',
  '오늘은 따뜻한 물 한 잔이면 충분해요',
  '잠이 안 올 땐 창문을 조금 열고 바람 소리를 들어요',
  '지친 날엔 아무것도 안 해도 괜찮다고 스스로에게 말해요',
];

let nextId = 1000;

export const db = {
  records: [] as MockRecord[],
  queue: EMOTIONS.flatMap((e, i) =>
    [0, 1].map((j) => ({ id: nextId++, emotion: e.code, message: SEED_MESSAGES[(i + j) % SEED_MESSAGES.length], fromMe: false })),
  ) as QueuedPatch[],
  sendable: 5,
  sentByDate: {} as Record<string, number>,
  /** 패치 받기를 이미 한 기록 (재요청 409) */
  receivedRecordIds: new Set<number>(),
  delivered: new Map<number, { emotion: EmotionCode; reported: boolean }>(),
  blankets: [{ id: 1, slots: Array.from({ length: BLANKET_SLOTS }, () => null as EmotionCode | null) }],
  nextRecordId: 1,
};

export function todayRecordCount() {
  const t = todayStr();
  return db.records.filter((r) => r.date === t).length;
}

export function takeFromQueue(emotion: EmotionCode): QueuedPatch | null {
  const idx = db.queue.findIndex((p) => p.emotion === emotion && !p.fromMe);
  return idx === -1 ? null : db.queue.splice(idx, 1)[0];
}

export function enqueue(emotion: EmotionCode, message: string) {
  db.queue.push({ id: nextId++, emotion, message, fromMe: true });
}

/** BLK-STACK-001: 현재 담요 다음 칸에 적립. 30칸이면 완성 후 새 담요 */
export function stackOnBlanket(emotion: EmotionCode): { slotIndex: number; completed: boolean } {
  let current = db.blankets[db.blankets.length - 1];
  let slotIndex = current.slots.findIndex((s) => s === null);
  if (slotIndex === -1) {
    current = { id: current.id + 1, slots: Array.from({ length: BLANKET_SLOTS }, () => null) };
    db.blankets.push(current);
    slotIndex = 0;
  }
  current.slots[slotIndex] = emotion;
  return { slotIndex, completed: slotIndex === BLANKET_SLOTS - 1 };
}

export const DEFAULT_COMFORT = '오늘도 여기까지 온 당신, 충분히 잘하고 있어요';

export function toReceived(emotion: EmotionCode, queued: QueuedPatch | null, stack: boolean): ReceivedPatch {
  const stacked = stack ? stackOnBlanket(emotion) : null;
  return {
    patchMessageId: queued?.id ?? null,
    emotion,
    message: queued?.message ?? DEFAULT_COMFORT,
    isDefault: !queued,
    slotIndex: stacked?.slotIndex ?? null,
    blanketCompleted: stacked?.completed ?? false,
  };
}

/** 목업 전용 위기 표현 판별 — 실제는 서버 AI 분류(ALRT-DETECT-001) */
const CRISIS_WORDS = ['죽고 싶', '사라지고 싶', '끝내고 싶'];
export const mockDetectCrisis = (text = '') => CRISIS_WORDS.some((w) => text.includes(w));

/** 목업 전용 부적절 판별 — 연락처·링크 */
export const mockIsInappropriate = (text: string) => /https?:\/\/|www\.|\d{3}-?\d{3,4}-?\d{4}|@/.test(text);
