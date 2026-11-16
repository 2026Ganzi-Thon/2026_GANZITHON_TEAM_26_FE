/**
 * 기능 API
 * - 실제 서버(nyam17.site): 마음 기록(moods), 사연 위기 검사, 캘린더, 그날 기록, 상세·삭제, 보내기 가능 확인(cheers)
 * - 아직 서버에 없음 → MSW 목업: 온기 지도, 패치 받기·신고·보내기, 담요
 *   (TODO(백엔드): 나오면 URL만 맞추고 src/mocks/handlers.ts의 해당 핸들러 삭제)
 * 서버 응답은 여기서 화면용 모양으로 바꿔서 돌려준다 → 서버 형식이 바뀌어도 화면 코드는 그대로.
 */
import type {
  ApiResponse,
  BlanketResponse,
  CalendarDay,
  CreateRecordRequest,
  CreateRecordResult,
  DayRecordsResponse,
  EmotionCode,
  ReceivePatchesRequest,
  ReceivePatchesResponse,
  RecordDetail,
  ReportPatchResponse,
  SendPatchRequest,
  SendPatchResult,
  SendStatusResponse,
  ServerCalendarResponse,
  ServerCheerAvailabilityResponse,
  ServerCreateRecordResponse,
  ServerDayListResponse,
  ServerRecordDetailResponse,
  ServerStoryCheckResponse,
  WarmthMapResponse,
} from '../types/api';
import { api, unwrap } from './client';

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO date-time → 'HH:mm' (기기 로컬 시간) */
export const toTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(11, 16) : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ───────── 실제 API ───────── */

export const recordApi = {
  /** CRD-WRITE-003 */
  async create(body: CreateRecordRequest): Promise<CreateRecordResult> {
    const r = await unwrap(api.post<ApiResponse<ServerCreateRecordResponse>>('/api/v1/moods', body));
    return { recordId: r.recordId, todayCount: r.todayCount, recordedAt: r.recordedAt };
  },
  /** CRD-WRITE-002 + ALRT-DETECT-001: 사연 '저장' 시 위기 표현 검사 */
  async checkStory(content: string): Promise<{ crisisDetected: boolean }> {
    return unwrap(api.post<ApiResponse<ServerStoryCheckResponse>>('/api/v1/moods/stories', { content }));
  },
  /** CRD-VIEW-001 */
  async calendar(yearMonth: string): Promise<CalendarDay[]> {
    const r = await unwrap(api.get<ApiResponse<ServerCalendarResponse>>('/api/v1/moods/calendar', { params: { yearMonth } }));
    return (r.recordedDates ?? []).map((date) => ({ date, hasRecord: true, hasSent: false }));
  },
  /** CRD-VIEW-002 */
  async byDate(date: string): Promise<DayRecordsResponse> {
    const r = await unwrap(api.get<ApiResponse<ServerDayListResponse>>('/api/v1/moods', { params: { date } }));
    return {
      sentCount: r.sentPatchCount ?? 0,
      records: (r.records ?? []).map((x) => ({ ...x, time: toTime(x.recordedAt) })),
    };
  },
  /** CRD-VIEW-003 */
  async detail(recordId: number): Promise<RecordDetail> {
    const r = await unwrap(api.get<ApiResponse<ServerRecordDetailResponse>>(`/api/v1/moods/${recordId}`));
    return {
      recordId,
      emotions: r.emotions,
      story: r.story || undefined,
      patches: (r.patches ?? []).map((p) => ({
        emotion: p.emotion,
        status:
          p.status === 'NOT_RECEIVED'
            ? { kind: 'NOT_RECEIVED' as const }
            : { kind: p.status, message: p.message ?? '' },
      })),
    };
  },
  /** CRD-DEL-001 */
  remove: (recordId: number) => unwrap(api.delete<ApiResponse<null>>(`/api/v1/moods/${recordId}`)),
};

export const patchApi = {
  /** BLK-SEND-001 (실제 API) — 감정마다 질문이 여러 개면 하나를 골라 보여 준다 */
  async sendStatus(): Promise<SendStatusResponse> {
    const r = await unwrap(api.get<ApiResponse<ServerCheerAvailabilityResponse>>('/api/v1/cheers/availability'));
    return {
      canSend: r.sendable,
      questions: (r.questions ?? []).map((q) => ({
        emotion: q.emotion,
        question: q.questions[Math.floor(Math.random() * q.questions.length)] ?? '이 마음일 때 나를 조금 버티게 한 건 뭐였어요?',
      })),
    };
  },

  /* ───────── 목업 (서버에 아직 없음) ───────── */

  /** BLK-RCV-001/002 */
  receive: (body: ReceivePatchesRequest) =>
    unwrap(api.post<ApiResponse<ReceivePatchesResponse>>('/api/v1/patches/receive', body)),
  /** BLK-RPT-001 */
  report: (patchMessageId: number) =>
    unwrap(api.post<ApiResponse<ReportPatchResponse>>(`/api/v1/patches/${patchMessageId}/report`)),
  /** BLK-SEND-002 */
  send: (body: SendPatchRequest) => unwrap(api.post<ApiResponse<SendPatchResult>>('/api/v1/patches', body)),
};

export const mapApi = {
  /** ITR-MAP-001 (목업) — 고른 감정을 함께 보냄 */
  get: (emotions: EmotionCode[], todayCount?: number) =>
    unwrap(
      api.get<ApiResponse<WarmthMapResponse>>('/api/v1/map', {
        params: { emotions: emotions.join(','), todayCount },
      }),
    ),
};

export const blanketApi = {
  /** BLK-VIEW-001 (목업) */
  get: (blanketId?: number) =>
    unwrap(api.get<ApiResponse<BlanketResponse>>('/api/v1/blankets', { params: blanketId ? { blanketId } : undefined })),
};
