/**
 * API 타입
 * - Server*: 백엔드(https://nyam17.site, Swagger "PATCH API")의 실제 응답 모양 — 서버와 1:1
 * - 그 외: 화면에서 쓰는 모양. src/api/patch.ts가 서버 응답을 이 모양으로 바꿔 준다.
 * - 온기 지도·패치 받기/신고/보내기·담요는 아직 서버에 없어 기능명세서 기준 초안 (MSW 목업)
 */

/** 모든 응답 공통 래퍼 */
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

/* ───────────── 감정 코드 (서버 enum과 동일) ───────────── */

export type EmotionCode =
  | 'UNMOTIVATED'
  | 'HOPELESS_FUTURE'
  | 'ANXIETY'
  | 'LONELY'
  | 'EXHAUSTED'
  | 'INADEQUATE'
  | 'NOWHERE_TO_VENT'
  | 'TEARFUL'
  | 'RESTLESS'
  | 'OVERWHELMED'
  | 'UNSURE';

/* ───────────── Auth (실제 API) ───────────── */

export type Agreement = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'USAGE_PRINCIPLES';

export interface SignupRequest {
  email: string;
  password: string; // 8~20자
  agreements: Agreement[];
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  isOnboardingCompleted: boolean;
}
export interface TokenReissueRequest {
  refreshToken: string;
}
export interface TokenReissueResponse {
  accessToken: string;
}
export interface EmailCodeSendRequest {
  email: string;
}
export interface EmailCodeVerifyRequest {
  email: string;
  code: string; // ^\d{6}$
}

/* ───────────── 마음 기록 — 실제 API 응답 (Server*) ───────────── */

export interface CreateRecordRequest {
  emotions: EmotionCode[]; // 1~2개
  story?: string; // 300자 이내
}
export interface ServerCreateRecordResponse {
  recordId: number;
  emotions: EmotionCode[];
  recordedAt: string; // ISO date-time
  todayCount: number;
}
export interface ServerStoryCheckResponse {
  crisisDetected: boolean;
}
export interface ServerCalendarResponse {
  recordedDates: string[]; // YYYY-MM-DD
}
export interface ServerDayListResponse {
  sentPatchCount: number;
  records: { recordId: number; recordedAt: string; emotions: EmotionCode[]; hasStory: boolean }[];
}
export interface ServerRecordDetailResponse {
  emotions: EmotionCode[];
  patches: { emotion: EmotionCode; status: 'RECEIVED' | 'NOT_RECEIVED' | 'DEFAULT_COMFORT'; message?: string }[];
  story?: string;
}
export interface ServerCheerAvailabilityResponse {
  /** 발송 한도 폐지로 서버에서 빠질 예정 — 프론트는 쓰지 않음 */
  sendable?: boolean;
  questions: { emotion: EmotionCode; questions: string[] }[];
}
/** POST /api/v1/cheers — 위기 표현이면 거절하지 않고 crisisDetected: true. 검수 거절은 400_CHEER_* */
export interface ServerCheerSendResponse {
  crisisDetected: boolean;
}

/* ───────────── 마음 기록 — 화면용 모양 ───────────── */

export interface CreateRecordResult {
  recordId: number;
  todayCount: number;
  recordedAt: string;
}
export interface CalendarDay {
  date: string;
  hasRecord: boolean;
  /** 서버가 아직 주지 않음(항상 false) — TODO(백엔드): '패치만 보낸 날' 표시용 */
  hasSent: boolean;
}
export interface DayRecordSummary {
  recordId: number;
  recordedAt: string;
  time: string; // HH:mm
  emotions: EmotionCode[];
  hasStory: boolean;
}
export interface DayRecordsResponse {
  sentCount: number;
  records: DayRecordSummary[];
}
export type ReceivedPatchStatus =
  | { kind: 'RECEIVED'; message: string }
  | { kind: 'NOT_RECEIVED' }
  | { kind: 'DEFAULT_COMFORT'; message: string };
export interface RecordDetail {
  recordId: number;
  emotions: EmotionCode[];
  patches: { emotion: EmotionCode; status: ReceivedPatchStatus }[];
  story?: string;
}

/* ───────────── 온기 지도 (ITR-MAP-001) — 목업 ───────────── */

export type MapMode = 'NOW' | 'QUIET_7D' | 'FIRST_LIGHT';
export interface WarmthMapResponse {
  mode: MapMode;
  count: number;
  emotions: EmotionCode[];
  noBlanketNotice: boolean;
}

/* ───────────── 패치 (BLK-*) ───────────── */

export interface ReceivedPatch {
  patchMessageId: number | null; // 기본 메시지면 null
  emotion: EmotionCode;
  message: string;
  isDefault: boolean;
  slotIndex: number | null; // 담요 칸 0~29, 4번째 이후면 null
  blanketCompleted: boolean;
}
export interface ReceivePatchesRequest {
  /** 목업용: 서버 기록과 목업 받기를 이어 주기 위해 함께 보냄 */
  recordId?: number;
  emotions?: EmotionCode[];
  todayCount?: number;
}
export interface ReceivePatchesResponse {
  patches: ReceivedPatch[];
}
export interface ReportPatchResponse {
  replaced: ReceivedPatch;
}
/** BLK-SEND-001 (실제 API: /cheers/availability) — 발송 한도·쿨타임 없음(회의 결정), 감정별 질문만 */
export interface SendStatusResponse {
  questions: { emotion: EmotionCode; question: string }[];
}
export interface SendPatchRequest {
  targetEmotion: EmotionCode;
  content: string; // 1~50자
}
export type SendPatchResult =
  | { result: 'SENT' }
  | { result: 'NEEDS_REVISION'; reason: string }
  | { result: 'CRISIS' };

/* ───────────── 담요 (BLK-VIEW-001) — 목업 ───────────── */

export interface BlanketSlot {
  index: number;
  emotion: EmotionCode | null;
  filled: boolean;
  /** BLK-VIEW-002 칸을 채운 패치 (413). 서버 확정 전 목업 필드 */
  message?: string | null;
  receivedAt?: string | null;
  recordId?: number | null;
}
export interface BlanketResponse {
  blanketId: number;
  slots: BlanketSlot[];
  hasPrev: boolean;
  hasNext: boolean;
}
