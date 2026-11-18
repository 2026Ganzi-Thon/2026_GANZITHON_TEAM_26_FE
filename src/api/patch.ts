/**
 * 기능 API
 * - 실제 서버(nyam17.site): 마음 기록(moods), 사연 위기 검사, 캘린더, 그날 기록, 상세·삭제,
 *   보내기 질문(cheers/availability), 패치 보내기(cheers), 온기 지도, 패치 받기, 담요·담요 칸
 * - 아직 서버에 없음 → MSW 목업: 패치 신고
 *   (TODO(백엔드): Swagger에 올라오면 형식 맞추고 src/mocks/handlers.ts의 해당 핸들러 삭제)
 * 서버 응답은 여기서 화면용 모양으로 바꿔서 돌려준다 → 서버 형식이 바뀌어도 화면 코드는 그대로.
 */
import type {
  ApiResponse,
  BlanketResponse,
  BlanketSlotDetail,
  CalendarDay,
  CreateRecordRequest,
  CreateRecordResult,
  DayRecordsResponse,
  EmotionCode,
  ReceivePatchesResponse,
  RecordDetail,
  ReportPatchResponse,
  SendPatchRequest,
  SendPatchResult,
  SendStatusResponse,
  ServerBlanketResponse,
  ServerBlanketSlotResponse,
  ServerCalendarResponse,
  ServerCheerAvailabilityResponse,
  ServerCheerSendResponse,
  ServerCreateRecordResponse,
  ServerDayListResponse,
  ServerMapResponse,
  ServerReceiveResponse,
  ServerRecordDetailResponse,
  ServerStoryCheckResponse,
  WarmthMapResponse,
} from '../types/api';
import { api, unwrap } from './client';
import { cheerRejectReason } from './errors';

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
  /** BLK-SEND-001 (실제 API) — 감정마다 질문이 여러 개면 하나를 골라 보여 준다. 발송 한도 없음 */
  async sendStatus(): Promise<SendStatusResponse> {
    const r = await unwrap(api.get<ApiResponse<ServerCheerAvailabilityResponse>>('/api/v1/cheers/availability'));
    return {
      questions: (r.questions ?? []).map((q) => ({
        emotion: q.emotion,
        question: q.questions[Math.floor(Math.random() * q.questions.length)] ?? '이 마음일 때 나를 조금 버티게 한 건 뭐였어요?',
      })),
    };
  },

  /**
   * BLK-SEND-002 (실제 API) 검수·발송
   * - 200 crisisDetected: false → 발송 완료
   * - 200 crisisDetected: true  → 위기 안내 (서버는 거절하지 않고 조용히 처리)
   * - 400 400_CHEER_*           → 수정 요청(305), 작성 내용 유지
   * 그 외 에러(400_INVALID_INPUT 등)는 그대로 던져서 화면이 에러 문구를 보여 준다.
   */
  async send(body: SendPatchRequest): Promise<SendPatchResult> {
    try {
      const r = await unwrap(api.post<ApiResponse<ServerCheerSendResponse>>('/api/v1/cheers', body));
      return r.crisisDetected ? { result: 'CRISIS' } : { result: 'SENT' };
    } catch (err) {
      const reason = cheerRejectReason(err);
      if (reason) return { result: 'NEEDS_REVISION', reason };
      throw err;
    }
  },

  /**
   * BLK-RCV-001/002 (실제 API) — 요청 본문 없음. 서버가 가장 최근 기록 기준으로 패치를 준다.
   * TODO(백엔드): 응답에 담요 칸 번호(slotIndex)·담요 완성 여부(blanketCompleted)가 없어 기본값으로 채움
   */
  async receive(): Promise<ReceivePatchesResponse> {
    const r = await unwrap(api.post<ApiResponse<ServerReceiveResponse>>('/api/v1/cheers/receive'));
    return {
      patches: (r.patches ?? []).map((p) => ({
        patchMessageId: p.isDefault ? null : p.cheerId,
        emotion: p.emotion,
        message: p.message,
        isDefault: p.isDefault,
        slotIndex: null,
        blanketCompleted: false,
      })),
    };
  },

  /* ───────── 목업 (서버에 아직 없음 — URL만 실제 주소) ───────── */

  /** BLK-RPT-001 (목업) — emotion은 목업이 같은 마음의 다른 패치를 고르는 데만 씀 */
  report: (cheerId: number, emotion: EmotionCode) =>
    unwrap(api.post<ApiResponse<ReportPatchResponse>>(`/api/v1/cheers/${cheerId}/report`, { emotion })),
};

const MAP_MODE: Record<ServerMapResponse['status'], WarmthMapResponse['mode']> = {
  ACTIVE: 'NOW',
  QUIET: 'QUIET_7D',
  FIRST_LIGHT: 'FIRST_LIGHT',
};

export const mapApi = {
  /**
   * ITR-MAP-001 (실제 API) — 서버가 가장 최근 기록의 감정별 인원을 준다. 30초 폴링(실시간 연결 없음)
   * 감정을 2개 골랐으면 두 인원 중 큰 값을 보여 준다 (같은 사람이 두 번 세어지지 않도록 합치지 않음)
   */
  async get(emotions: EmotionCode[]): Promise<WarmthMapResponse> {
    const r = await unwrap(api.get<ApiResponse<ServerMapResponse>>('/api/v1/interactions/map'));
    const list = r.emotions ?? [];
    const mine = list.filter((e) => emotions.includes(e.emotion));
    const count = Math.max(0, ...(mine.length ? mine : list).map((e) => e.count));
    return { mode: MAP_MODE[r.status] ?? 'FIRST_LIGHT', count, noBlanketNotice: !!r.blanketNotStackedNotice };
  },
};

export const blanketApi = {
  /** BLK-VIEW-001 (실제 API) — 칸 목록에는 채워졌는지만 온다 */
  async get(blanketId?: number): Promise<BlanketResponse> {
    const r = await unwrap(
      api.get<ApiResponse<ServerBlanketResponse>>('/api/v1/blankets', { params: blanketId ? { blanketId } : undefined }),
    );
    return {
      blanketId: r.blanketId,
      slots: (r.slots ?? []).map((x) => ({ index: x.slotIndex, emotion: null, filled: x.filled })),
      hasPrev: r.hasPrevious,
      hasNext: r.hasNext,
    };
  },
  /** BLK-VIEW-002 (실제 API) — 칸을 누르면 그 칸의 패치 */
  async slot(blanketId: number, slotIndex: number): Promise<BlanketSlotDetail> {
    const r = await unwrap(
      api.get<ApiResponse<ServerBlanketSlotResponse>>(`/api/v1/blankets/${blanketId}/slots/${slotIndex}`),
    );
    return {
      index: r.slotIndex ?? slotIndex,
      emotion: r.emotion ?? null,
      message: r.message,
      isDefault: r.isDefault,
      receivedAt: r.receivedAt,
      hasRecordOnDate: r.hasMoodRecordOnDate,
    };
  },
};
