/** 2xx 홈 — 마음 고르기(201), 사연(205/206), 온기 지도(208~214), 패치 받기(215~223) */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import { mapApi, patchApi, recordApi } from '../api/patch';
import ChevronRight from '../assets/icons/chevron-right.svg?react';
import { ErrorText, Header, Loading, Spacer, Toast } from '../components/Layout';
import { BLANKET_SLOTS, EMOTIONS, MAX_EMOTIONS, STORY_MAX_LENGTH, countLabel, emotionLabel } from '../constants/emotions';
import { useDraft } from '../providers/DraftProvider';
import type { EmotionCode, ReceivedPatch } from '../types/api';
import yarnBall from '../assets/brand/yarn-ball.webp';

/** 기록 → 지도 → 받기로 넘겨주는 값 */
interface RecordState {
  recordId: number;
  emotions: EmotionCode[];
  todayCount: number;
}

/* ───────── 201 마음 고르기 ───────── */
export function EmotionPickPage() {
  const navigate = useNavigate();
  const { emotions, setEmotions, story, reset } = useDraft();
  const [tooMany, setTooMany] = useState(false);

  const save = useMutation({
    mutationFn: () => recordApi.create({ emotions, story: story || undefined }),
    onSuccess: (res) => {
      const state: RecordState = { recordId: res.recordId, emotions, todayCount: res.todayCount };
      reset();
      navigate('/map', { state });
    },
  });

  const toggle = (code: EmotionCode) => {
    if (emotions.includes(code)) {
      setEmotions(emotions.filter((e) => e !== code));
      setTooMany(false);
    } else if (emotions.length >= MAX_EMOTIONS) {
      setTooMany(true); // 201_3개째선택_안내
    } else {
      setEmotions([...emotions, code]);
    }
  };

  return (
    <>
      <Header title="마음 고르기" />
      <h2 className="page-title">지금 마음은 어때요?</h2>
      <p className="page-sub sm">최대 2개까지 골라도 돼요 · 하루 몇 번이든 괜찮아요</p>
      <div className="emotion-grid">
        {EMOTIONS.map((e, i) => (
          <button
            key={e.code}
            className={`emotion-card ${emotions.includes(e.code) ? 'selected' : ''} ${i === EMOTIONS.length - 1 ? 'full' : ''}`}
            aria-pressed={emotions.includes(e.code)}
            onClick={() => toggle(e.code)}
          >
            {e.label}
          </button>
        ))}
      </div>
      <button className={`story-row ${story ? 'filled' : ''}`} onClick={() => navigate('/story')}>
        <span>{story ? `사연: ${story.slice(0, 20)}${story.length > 20 ? '…' : ''}` : '사연 남기기 (나만 보기)'}</span>
        <ChevronRight />
      </button>
      {tooMany && <div className="notice">최대 2개까지 고를 수 있어요</div>}
      {save.isError && <ErrorText text={parseApiError(save.error).message} />}
      <Spacer />
      {emotions.length > 0 && <p className="pick-count">{emotions.length}개 골랐어요</p>}
      <button className="btn" disabled={!emotions.length || save.isPending} onClick={() => save.mutate()}>
        이 마음으로 들어가기
      </button>
    </>
  );
}

/* ───────── 206 사연 남기기 ───────── */
export function StoryPage() {
  const navigate = useNavigate();
  const { story, setStory } = useDraft();
  const [text, setText] = useState(story);

  // ALRT-DETECT-001: '저장' 시 서버에서 위기 표현 검사 → 감지되면 본인에게만 위기 안내(503), 사연은 그대로 보관
  const check = useMutation({
    mutationFn: (content: string) => recordApi.checkStory(content),
    onSuccess: (res, content) => {
      setStory(content);
      if (res.crisisDetected) navigate('/help', { replace: true, state: { next: '/', from: 'story' } });
      else navigate('/', { replace: true });
    },
  });

  const save = () => {
    const content = text.trim();
    if (!content) {
      setStory('');
      navigate('/');
      return;
    }
    check.mutate(content);
  };

  return (
    <>
      <Header title="사연 남기기" back />
      <h2 className="page-title" style={{ fontSize: 15, marginTop: 24 }}>나만 볼 수 있어요</h2>
      <p className="page-sub sm" style={{ marginBottom: 14 }}>다른 사람에게는 공개되지 않아요 · {STORY_MAX_LENGTH}자까지</p>
      <div className="textarea-wrap">
        <textarea
          className="textarea"
          style={{ height: 300, borderColor: 'var(--color-bk)' }}
          maxLength={STORY_MAX_LENGTH}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder="지금 마음을 적어 보세요"
        />
        <span className="counter">{text.length}/{STORY_MAX_LENGTH}</span>
      </div>
      {check.isError && <ErrorText text={parseApiError(check.error).message} />}
      <div className="btn-row">
        <button className="btn secondary" onClick={() => navigate(-1)}>취소</button>
        <button className="btn" disabled={check.isPending} onClick={save}>{check.isPending ? '저장 중…' : '저장'}</button>
      </div>
    </>
  );
}

/* ───────── 208 온기 지도 ───────── */

/** Figma 208: 인원 구간마다 동그라미 크기가 커짐 (20~29명 = 96px) */
function circleSize(count: number) {
  if (count < 5) return 68; // 5명 미만도 가장 작은 동그라미 (5~9명과 같은 크기)
  if (count < 10) return 68;
  if (count < 20) return 82;
  if (count < 30) return 96;
  if (count < 40) return 110;
  if (count < 50) return 124;
  return 140;
}

export function WarmthMapPage() {
  const navigate = useNavigate();
  const rec = useLocation().state as RecordState | null;
  // TODO(백엔드): 실시간 방식 확정 전까지 30초 폴링 (Figma: 30초 갱신). 끊기면 마지막 값 유지 + 배너(214)
  const map = useQuery({
    queryKey: ['map', rec?.recordId],
    queryFn: () => mapApi.get(rec?.emotions ?? [], rec?.todayCount),
    enabled: !!rec,
    refetchInterval: 30_000,
  });

  if (!rec) return (<><Header title="온기 지도" back /><p className="state-text">먼저 마음을 골라 주세요</p><button className="btn" onClick={() => navigate('/')}>마음 고르러 가기</button></>);
  if (map.isPending) return (<><Header title="온기 지도" back /><Loading text="같은 마음을 찾고 있어요" /></>);
  if (map.isError && !map.data) return (<><Header title="온기 지도" back /><ErrorText text={parseApiError(map.error).message} /></>);

  const { mode, count, noBlanketNotice } = map.data;
  const size = mode === 'NOW' ? circleSize(count) : 76;
  const headline =
    mode === 'NOW' ? (count < 5 ? '누군가도 지금 이 마음이에요' : `지금 ${countLabel(count)}이 같은 마음이에요`)
    : mode === 'QUIET_7D' ? '지금은 조용한 시간이에요'
    : '당신이 첫 빛이에요';

  return (
    <>
      <Header title="온기 지도" back />
      {map.isError && <p className="offline-banner">연결이 잠시 끊겼어요. 마지막 인원을 보여 드려요.</p>}
      <h2 className="page-title">{headline}</h2>
      <p className="page-sub">{rec.emotions.map(emotionLabel).join(' · ')}</p>
      {noBlanketNotice && <p className="caption muted">오늘 4번째 이후 기록은 담요에 쌓이지 않아요</p>}

      <div className="warmth-card" aria-label={headline}>
        <div className="warmth-halo" style={{ width: size + 38, height: size + 38 }}>
          <div className="warmth-circle" style={{ width: size, height: size }}>
            {mode === 'NOW' ? countLabel(count) : '✦'}
          </div>
        </div>
      </div>

      <p className="label-sm">고른 마음</p>
      <div className="chips">
        {rec.emotions.map((e) => <span key={e} className="chip">{emotionLabel(e)}</span>)}
      </div>

      <Spacer />
      <button className="btn" onClick={() => navigate('/receive', { state: rec })}>패치 받기</button>
      <div className="btn-row">
        {/* ITR-REST-001 함께 쉬는 방은 P1 */}
        <button className="btn secondary" disabled>함께 쉬기</button>
        <button className="btn secondary" onClick={() => navigate('/')}>다른 마음 고르기</button>
      </div>
    </>
  );
}

/** 215 도착하는 중 — 털실 공과 순서대로 깜빡이는 점 */
function PatchArriving() {
  return (
    <div className="arriving" role="status">
      <img className="arriving-ball" src={yarnBall} alt="" width={192} height={192} />
      <span className="arriving-dots" aria-hidden><i /><i /><i /></span>
      <p className="arriving-text">같은 마음에서 패치가 오고 있어요</p>
    </div>
  );
}

/** 물결 한 주기(55) — 같은 모양을 이어 붙여 왼쪽으로 한 주기만큼 흘려보낸다 */
const WAVE_PERIOD = 55;
const WAVE_PATH = Array.from({ length: 4 }, (_, i) => {
  const x = i * WAVE_PERIOD;
  return `${i === 0 ? 'M0 6' : ''}C${x + 9} 2 ${x + 18} 2 ${x + 27.5} 6C${x + 37} 10 ${x + 46} 10 ${x + 55} 6`;
}).join('');

/** 패치 카드 위 실 무늬 (Figma 216/217) — 잔잔하게 흐르는 물결 */
export function Thread({ className = '' }: { className?: string }) {
  return (
    <svg className={`thread ${className}`.trim()} viewBox="0 0 112 12" fill="none" aria-hidden>
      <g className="thread-flow">
        <path d={WAVE_PATH} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 좌우 스와이프로 카드 넘기기. 손가락을 따라 움직이고, 놓으면 가까운 카드로 붙는다 */
function useSwipe(count: number, index: number, onChange: (next: number) => void) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; t: number; id: number; axis: 'x' | 'y' | null } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest('.confirm-pop')) return;
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, axis: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.axis === 'y') { start.current = null; return; }
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
    setDragX(atEdge ? dx / 3 : dx);
  };

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== 'x') return;
    const dx = e.clientX - s.x;
    const width = e.currentTarget.clientWidth || 1;
    const fast = Math.abs(dx) / Math.max(e.timeStamp - s.t, 1) > 0.5;
    let next = index;
    if (e.type === 'pointercancel') next = index;
    else if (dx < 0 && (dx < -width * 0.2 || fast)) next = Math.min(index + 1, count - 1);
    else if (dx > 0 && (dx > width * 0.2 || fast)) next = Math.max(index - 1, 0);
    setDragging(false);
    setDragX(0);
    if (next !== index) onChange(next);
  };

  return {
    dragging,
    trackStyle: { transform: `translateX(calc(${-index} * (100% + 12px) + ${dragX}px))` },
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}

/* ───────── 216~220 패치 받기 · 신고 ───────── */
export function ReceivePage() {
  const navigate = useNavigate();
  const rec = useLocation().state as RecordState | null;
  const [replaced, setReplaced] = useState<Record<number, ReceivedPatch>>({});
  const [index, setIndex] = useState(0);
  const [confirmReport, setConfirmReport] = useState(false);
  const [toast, setToast] = useState('');

  const receive = useQuery({
    queryKey: ['receive', rec?.recordId],
    queryFn: () => patchApi.receive({ recordId: rec?.recordId, emotions: rec?.emotions, todayCount: rec?.todayCount }),
    enabled: !!rec,
    retry: false,
    staleTime: Infinity,
  });
  const patches = receive.data?.patches.map((p, i) => replaced[i] ?? p) ?? null;
  const goTo = (next: number) => { setIndex(next); setConfirmReport(false); };
  const swipe = useSwipe(patches?.length ?? 0, index, goTo);

  const report = useMutation({
    mutationFn: (id: number) => patchApi.report(id),
    onSuccess: (res) => {
      setReplaced((prev) => ({ ...prev, [index]: res.replaced }));
      setConfirmReport(false);
      setToast('신고했어요. 새 패치로 바꿔 드렸어요');
      setTimeout(() => setToast(''), 2000);
    },
  });

  if (!rec) return (<><Header title="패치 받기" back /><p className="state-text">먼저 마음을 골라 주세요</p></>);
  if (receive.isPending) return (<><Header title="패치 받기" back /><PatchArriving /></>);
  if (receive.isError) {
    // TODO(백엔드): 409(이미 받음)일 때 오늘 받은 패치 재조회 방법 확정 필요
    return (<><Header title="패치 받기" back /><ErrorText text={parseApiError(receive.error).message} /></>);
  }
  if (!patches) return null;

  const current = patches[index];
  const hasNext = index < patches.length - 1;
  const multi = patches.length > 1;
  return (
    <>
      <Header title="패치 받기" back />
      <div className="title-row">
        <h2 className="page-title">패치가 도착했어요</h2>
        {multi && <span className="count-pill">{index + 1}/{patches.length}</span>}
      </div>
      {!multi && <p className="page-sub sm">같은 마음을 지나온 누군가가 보냈어요</p>}

      <div className={`patch-viewport${multi ? ' swipeable' : ''}`} {...swipe.handlers}>
        <div className={`patch-track${swipe.dragging ? ' dragging' : ''}`} style={swipe.trackStyle}>
          {patches.map((p, i) => (
            <article key={i} className="patch-card" aria-hidden={i !== index}>
              <Thread />
              <p className="message">{p.message}</p>
              <p className="from">'{emotionLabel(p.emotion)}'에 온 패치{p.isDefault ? ' · 기본 위로' : ''}</p>
              {!p.isDefault && p.patchMessageId !== null && (
                <button className="report" tabIndex={i === index ? 0 : -1} onClick={() => setConfirmReport(true)}>신고</button>
              )}
              {i === index && confirmReport && p.patchMessageId !== null && (
                <div className="confirm-pop">
                  <b>이 패치를 신고할까요?</b>
                  <p>신고하면 바로 숨기고<br />같은 마음의 다른 패치로 바꿔 드려요</p>
                  {report.isError && <ErrorText text={parseApiError(report.error).message} />}
                  <div className="btn-row">
                    <button className="btn secondary" onClick={() => setConfirmReport(false)}>취소</button>
                    <button className="btn danger-soft" disabled={report.isPending} onClick={() => report.mutate(p.patchMessageId!)}>신고</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {multi ? (
        <button className="swipe-hint" onClick={() => goTo(hasNext ? index + 1 : index - 1)}>
          {hasNext ? '밀어서 다음 패치 보기' : '‹ 이전 카드 보기'}
          <span className="dots">{patches.map((_, i) => <i key={i} className={i === index ? 'on' : ''} />)}</span>
        </button>
      ) : (
        current.slotIndex !== null && <p className="caption center" style={{ marginTop: 14 }}>담요에 한 칸이 생겼어요 · {current.slotIndex + 1} / {BLANKET_SLOTS}칸</p>
      )}
      {current.blanketCompleted && <div className="notice center">담요 한 장이 완성됐어요!</div>}

      <Spacer />
      <button className="btn" onClick={() => navigate('/send')}>나도 패치 선물하기</button>
      <div className="btn-row">
        <button className="btn secondary" onClick={() => navigate('/')}>다른 마음 고르기</button>
        <button className="btn secondary" disabled>함께 쉬기</button>
      </div>
      {toast && <Toast>{toast}</Toast>}
    </>
  );
}

