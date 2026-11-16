/**
 * MSW 목업 핸들러
 * - featureHandlers: 서버에 아직 없는 API (VITE_USE_MOCK=true면 항상 켜짐)
 *     온기 지도, 패치 받기·신고·보내기, 담요
 * - serverHandlers: 서버에 이미 있는 API의 목업 (VITE_MOCK_AUTH=true일 때만 — 백엔드 없이 시연용)
 *     인증, 마음 기록(moods), 사연 검사, 캘린더, 보내기 가능 확인(cheers)
 * 실제 API가 나오면 featureHandlers에서 해당 핸들러를 지우면 그 요청은 진짜 서버로 간다.
 */
import { http, HttpResponse, delay } from 'msw';
import { EMOTIONS, MAX_EMOTIONS, PATCH_MAX_LENGTH, STORY_MAX_LENGTH } from '../constants/emotions';
import type { CreateRecordRequest, EmotionCode, ReceivePatchesRequest, SendPatchRequest, SendPatchResult } from '../types/api';
import {
  dateStr,
  db,
  enqueue,
  mockDetectCrisis,
  mockIsInappropriate,
  takeFromQueue,
  todayRecordCount,
  todayStr,
  toReceived,
} from './db';

const ok = <T>(data: T, status = 200) => HttpResponse.json({ code: 'SUCCESS', message: 'OK', data }, { status });
const fail = (status: number, code: string, message: string) => HttpResponse.json({ code, message, data: null }, { status });
const isAuthed = (req: Request) => req.headers.get('Authorization')?.startsWith('Bearer ');

const QUESTIONS = [
  '이 마음일 때 나를 조금 버티게 한 건 뭐였어요?',
  '그럴 때 무엇이 버티게 해 주었나요?',
];

/* ───────────── 서버에 아직 없는 API ───────────── */
export const featureHandlers = [
  /* ITR-MAP-001 온기 지도 */
  http.get('/api/v1/map', async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const emotions = (params.get('emotions') ?? '').split(',').filter(Boolean) as EmotionCode[];
    if (!emotions.length) return fail(400, 'NO_RECORD_TODAY', '오늘 기록이 없어요');
    await delay(400);
    const count = Math.floor(Math.random() * 60);
    return ok({
      mode: count > 0 ? 'NOW' : 'FIRST_LIGHT',
      count,
      emotions,
      noBlanketNotice: Number(params.get('todayCount') ?? 1) >= 4,
    });
  }),

  /* BLK-RCV-001/002 패치 받기 */
  http.post('/api/v1/patches/receive', async ({ request }) => {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as ReceivePatchesRequest;
    const emotions = body.emotions ?? [];
    if (!emotions.length) return fail(400, 'NO_RECORD_TODAY', '먼저 마음을 골라 주세요');
    if (body.recordId && db.receivedRecordIds.has(body.recordId)) return fail(409, 'ALREADY_RECEIVED', '이미 패치를 받았어요');
    const fourthOrLater = (body.todayCount ?? 1) >= 4;
    const patches = emotions.map((emotion) => {
      const queued = fourthOrLater ? null : takeFromQueue(emotion);
      if (queued) db.delivered.set(queued.id, { emotion, reported: false });
      return toReceived(emotion, queued, !fourthOrLater);
    });
    if (body.recordId) {
      db.receivedRecordIds.add(body.recordId);
      const rec = db.records.find((r) => r.id === body.recordId);
      if (rec) rec.patches = patches.map((p) => ({ emotion: p.emotion, status: fourthOrLater ? 'DEFAULT_COMFORT' : 'RECEIVED', message: p.message }));
    }
    await delay(900); // Figma 215_도착하는중
    return ok({ patches });
  }),

  /* BLK-RPT-001 신고 → 같은 자리 교체 */
  http.post('/api/v1/patches/:id/report', ({ params }) => {
    const info = db.delivered.get(Number(params.id));
    if (!info) return fail(404, 'PATCH_NOT_FOUND', '존재하지 않는 패치예요');
    if (info.reported) return fail(409, 'ALREADY_REPORTED', '이미 신고했어요');
    info.reported = true;
    const queued = takeFromQueue(info.emotion);
    if (queued) db.delivered.set(queued.id, { emotion: info.emotion, reported: false });
    return ok({ replaced: toReceived(info.emotion, queued, false) });
  }),

  /* BLK-SEND-002 검사·발송 */
  http.post('/api/v1/patches', async ({ request }) => {
    const body = (await request.json()) as SendPatchRequest;
    if (!body.targetEmotion) return fail(400, 'TARGET_REQUIRED', '받을 마음을 골라 주세요');
    if (!body.content || body.content.length > PATCH_MAX_LENGTH) return fail(400, 'CONTENT_LENGTH', '1~50자로 써 주세요');
    if (db.sendable <= 0) return fail(429, 'SEND_QUOTA_EXHAUSTED', '오늘 보낼 수 있는 패치를 모두 보냈어요');
    await delay(1200); // Figma 304_AI검수중
    let result: SendPatchResult;
    if (mockDetectCrisis(body.content)) result = { result: 'CRISIS' };
    else if (mockIsInappropriate(body.content)) result = { result: 'NEEDS_REVISION', reason: '연락처나 링크는 보낼 수 없어요' };
    else {
      enqueue(body.targetEmotion, body.content);
      db.sendable -= 1;
      db.sentByDate[todayStr()] = (db.sentByDate[todayStr()] ?? 0) + 1;
      result = { result: 'SENT' };
    }
    return ok(result);
  }),

  /* BLK-VIEW-001 담요 */
  http.get('/api/v1/blankets', ({ request }) => {
    const idParam = new URL(request.url).searchParams.get('blanketId');
    const blanket = idParam ? db.blankets.find((b) => b.id === Number(idParam)) : db.blankets[db.blankets.length - 1];
    if (!blanket) return fail(404, 'BLANKET_NOT_FOUND', '존재하지 않는 담요예요');
    const pos = db.blankets.indexOf(blanket);
    return ok({
      blanketId: blanket.id,
      slots: blanket.slots.map((emotion, index) => ({ index, emotion, filled: emotion !== null })),
      hasPrev: pos > 0,
      hasNext: pos < db.blankets.length - 1,
    });
  }),
];

/* ───────────── 서버에 있는 API의 목업 (백엔드 없이 시연할 때만) ───────────── */
export const serverHandlers = [
  /* Auth */
  http.post('/api/v1/auth/email-verifications', () => ok(null)),
  http.post('/api/v1/auth/email-verifications/confirm', async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    return code === '123456' ? ok(null) : fail(400, 'INVALID_CODE', '인증번호가 맞지 않아요 (목업: 123456)');
  }),
  http.post('/api/v1/auth/signup', () => ok(null)),
  http.post('/api/v1/auth/login', () => ok({ accessToken: 'mock-access', refreshToken: 'mock-refresh', isOnboardingCompleted: true })),
  http.post('/api/v1/auth/token/refresh', () => ok({ accessToken: 'mock-access' })),
  http.post('/api/v1/auth/logout', () => ok(null)),

  /* 사연 위기 검사 */
  http.post('/api/v1/moods/stories', async ({ request }) => {
    const { content } = (await request.json()) as { content: string };
    if ((content?.length ?? 0) > STORY_MAX_LENGTH) return fail(400, 'STORY_TOO_LONG', '사연은 300자까지예요');
    await delay(300);
    return ok({ crisisDetected: mockDetectCrisis(content) });
  }),

  /* 캘린더 */
  http.get('/api/v1/moods/calendar', ({ request }) => {
    const yearMonth = new URL(request.url).searchParams.get('yearMonth') ?? '';
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return fail(400, 'BAD_YEAR_MONTH', 'yearMonth 형식 오류');
    const dates = [...new Set(db.records.map((r) => r.date))].filter((d) => d.startsWith(yearMonth)).sort();
    return ok({ recordedDates: dates });
  }),

  /* 마음 기록 저장 */
  http.post('/api/v1/moods', async ({ request }) => {
    if (!isAuthed(request)) return fail(401, 'UNAUTHORIZED', '로그인이 필요해요');
    const body = (await request.json()) as CreateRecordRequest;
    if (!body.emotions?.length) return fail(400, 'EMOTION_REQUIRED', '감정을 골라 주세요');
    if (body.emotions.length > MAX_EMOTIONS) return fail(400, 'EMOTION_TOO_MANY', '최대 2개까지 고를 수 있어요');
    const now = new Date();
    const todayIndex = todayRecordCount() + 1;
    const record = {
      id: db.nextRecordId++,
      recordedAt: now.toISOString(),
      date: dateStr(now),
      emotions: body.emotions,
      story: body.story || undefined,
      todayIndex,
      patches: body.emotions.map((emotion) => ({ emotion, status: 'NOT_RECEIVED' as const })),
    };
    db.records.push(record);
    if (body.story) db.sendable += 1;
    await delay(300);
    return ok({ recordId: record.id, emotions: record.emotions, recordedAt: record.recordedAt, todayCount: todayIndex });
  }),

  /* 그날 기록 목록 */
  http.get('/api/v1/moods', ({ request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? '';
    const records = db.records
      .filter((r) => r.date === date)
      .map((r) => ({ recordId: r.id, recordedAt: r.recordedAt, emotions: r.emotions, hasStory: !!r.story }));
    return ok({ sentPatchCount: db.sentByDate[date] ?? 0, records });
  }),

  /* 기록 상세 · 삭제 */
  http.get('/api/v1/moods/:recordId', ({ params }) => {
    const r = db.records.find((x) => x.id === Number(params.recordId));
    if (!r) return fail(404, 'RECORD_NOT_FOUND', '기록을 찾을 수 없어요');
    return ok({ emotions: r.emotions, patches: r.patches, story: r.story });
  }),
  http.delete('/api/v1/moods/:recordId', ({ params }) => {
    const idx = db.records.findIndex((x) => x.id === Number(params.recordId));
    if (idx === -1) return fail(404, 'RECORD_NOT_FOUND', '이미 지워진 기록이에요');
    db.records.splice(idx, 1);
    return ok(null);
  }),

  /* 보내기 가능 확인 — 패치가 부족한 마음부터 */
  http.get('/api/v1/cheers/availability', () =>
    ok({
      sendable: db.sendable > 0,
      questions: [...EMOTIONS]
        .sort((a, b) => db.queue.filter((q) => q.emotion === a.code).length - db.queue.filter((q) => q.emotion === b.code).length)
        .map((e) => ({ emotion: e.code, questions: QUESTIONS })),
    }),
  ),
];
