/**
 * API 타입
 * - Server*: 백엔드(https://nyam17.site, Swagger "PATCH API")의 실제 응답 모양 — 서버와 1:1
 * - 그 외: 화면에서 쓰는 모양. src/api/patch.ts가 서버 응답을 이 모양으로 바꿔 준다.
 * - 패치 신고만 아직 서버에 없어 기능명세서 기준 초안 (MSW 목업)
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

/* ───────────── 온기 지도 (ITR-MAP-001) ───────────── */

/** GET /api/v1/interactions/map — 서버 응답 */
export interface ServerMapResponse {
  status: 'ACTIVE' | 'QUIET' | 'FIRST_LIGHT';
  emotions: { emotion: EmotionCode; count: number }[];
  blanketNotStackedNotice: boolean;
}
/** 화면용: NOW = 지금 같은 마음인 사람이 있음, QUIET_7D = 조용한 시간, FIRST_LIGHT = 첫 빛 */
export type MapMode = 'NOW' | 'QUIET_7D' | 'FIRST_LIGHT';
export interface WarmthMapResponse {
  mode: MapMode;
  count: number;
  noBlanketNotice: boolean;
}

/* ───────────── 패치 (BLK-*) ───────────── */

/** POST /api/v1/cheers/receive — 서버 응답 (요청 본문 없음: 서버가 가장 최근 기록 기준으로 준다) */
export interface ServerReceiveResponse {
  patches: { cheerId: number; emotion: EmotionCode; message: string; isDefault: boolean }[];
}
/** BLK-RPT-001 서버 응답 — replaced는 Swagger의 ReceivedCheerResponse */
export interface ServerReportResponse {
  replaced: {
    cheerId: number;
    emotion: EmotionCode;
    message: string;
    isDefault: boolean;
    slotIndex?: number;
    blanketCompleted?: boolean;
  };
}
export interface ReceivedPatch {
  patchMessageId: number | null; // 기본 메시지면 null
  emotion: EmotionCode;
  message: string;
  isDefault: boolean;
  /** TODO(백엔드): 서버 응답에 아직 없음 → 항상 null ('담요에 한 칸이 생겼어요' 문구 숨김) */
  slotIndex: number | null;
  /** TODO(백엔드): 서버 응답에 아직 없음 → 항상 false */
  blanketCompleted: boolean;
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

/* ───────────── 담요 (BLK-VIEW-001/002) ───────────── */

/** GET /api/v1/blankets — 서버 응답 */
export interface ServerBlanketResponse {
  blanketId: number;
  slots: { slotIndex: number; filled: boolean }[];
  hasPrevious: boolean;
  hasNext: boolean;
}
/** GET /api/v1/blankets/{blanketId}/slots/{slotIndex} — 서버 응답 */
export interface ServerBlanketSlotResponse {
  slotIndex: number;
  cheerId: number | null;
  emotion: EmotionCode | null;
  message: string;
  isDefault: boolean;
  receivedAt: string; // ISO date-time
  sentAt: string | null;
  hasMoodRecordOnDate: boolean;
}

export interface BlanketSlot {
  index: number;
  /** TODO(백엔드): 칸 목록에 감정이 없음 → 항상 null (기본 니트 색으로 칠함) */
  emotion: EmotionCode | null;
  filled: boolean;
}
export interface BlanketResponse {
  blanketId: number;
  slots: BlanketSlot[];
  hasPrev: boolean;
  hasNext: boolean;
}
/** BLK-VIEW-002 담요 칸 패치 카드 (413) */
export interface BlanketSlotDetail {
  index: number;
  emotion: EmotionCode | null;
  message: string;
  isDefault: boolean;
  receivedAt: string;
  /** 받은 날 마음 기록이 남아 있는지 — false면 '이날의 기록은 지워졌어요'(414) */
  hasRecordOnDate: boolean;
}
