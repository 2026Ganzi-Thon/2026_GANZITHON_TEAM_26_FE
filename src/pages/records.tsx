/** 4xx 기록·담요 — 401 캘린더 + 그날 기록 시트, 407 상세, 408 지우기, 409~412 담요 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import { blanketApi, recordApi, toTime } from '../api/patch';
import BackIcon from '../assets/icons/back.svg?react';
import ChevronRight from '../assets/icons/chevron-right.svg?react';
import { ConfirmModal, ErrorText, Header, Loading, Spacer } from '../components/Layout';
import { BLANKET_SLOTS, emotionColor, emotionLabel } from '../constants/emotions';
import type { BlanketSlot } from '../types/api';
import { Thread } from './home';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayTitle = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
};

/* ───────── 401 기록 캘린더 + 그날 기록(바텀시트) ───────── */
export function RecordsPage() {
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<string>(todayKey);
  const yearMonth = `${year}-${pad(month)}`;

  const calendar = useQuery({ queryKey: ['calendar', yearMonth], queryFn: () => recordApi.calendar(yearMonth) });
  const day = useQuery({ queryKey: ['records', selected], queryFn: () => recordApi.byDate(selected) });

  const move = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map((calendar.data ?? []).map((d) => [d.date, d]));

  return (
    <>
      <Header title="기록" />
      <div className="month-nav">
        <button className="icon-btn" aria-label="이전 달" onClick={() => move(-1)}><BackIcon /></button>
        <b>{year}년 {month}월</b>
        <button className="icon-btn flip" aria-label="다음 달" disabled={isCurrentMonth} onClick={() => move(1)}><BackIcon /></button>
      </div>
      {calendar.isError && <ErrorText text={parseApiError(calendar.error).message} />}
      <div className="calendar">
        {WEEK.map((w, i) => <span key={w} className={`weekday ${i === 0 ? 'sun' : ''}`}>{w}</span>)}
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${yearMonth}-${pad(i + 1)}`;
          const info = byDate.get(date);
          const future = date > todayKey;
          return (
            <button
              key={date}
              className={`day ${date === todayKey ? 'today' : ''} ${date === selected ? 'selected' : ''} ${future ? 'future' : ''}`}
              disabled={future}
              onClick={() => setSelected(date)}
            >
              <span className="num">{i + 1}</span>
              <span className="marks">
                {info?.hasRecord && <i />}
                {!info?.hasRecord && info?.hasSent && <i className="hollow" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="legend"><span><i />마음 기록</span><span><i className="hollow" />패치만 보낸 날</span></p>

      <section className="day-sheet" aria-label="그날 기록">
        <div className="handle" />
        <h3>{dayTitle(selected)}</h3>
        {day.isPending && <Loading />}
        {day.isError && <ErrorText text={parseApiError(day.error).message} />}
        {day.data && (
          <>
            {day.data.sentCount > 0 && <div className="gift-banner">이날 누군가에게 패치 {day.data.sentCount}개를 선물했어요</div>}
            {day.data.records.length > 0 ? (
              <>
                <p className="label-sm" style={{ marginTop: 16 }}>고른 마음 {day.data.records.length}번</p>
                {day.data.records.map((r) => (
                  <button
                    key={r.recordId}
                    className="record-row"
                    onClick={() => navigate(`/records/${r.recordId}`, { state: { recordedAt: r.recordedAt, date: selected } })}
                  >
                    <b>{r.time}</b>
                    <span className="emo">{r.emotions.map(emotionLabel).join(' · ')}</span>
                    {r.hasStory && <span className="tag">사연</span>}
                    <ChevronRight />
                  </button>
                ))}
              </>
            ) : (
              <div className="sheet-empty">
                <b>{day.data.sentCount > 0 ? '이날은 패치만 건넸어요' : '이날은 기록이 없어요'}</b>
                {day.data.sentCount > 0 && <span className="caption">고른 마음 기록은 없어요</span>}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

/* ───────── 407 기록 상세 · 408 지우기 확인 ───────── */
export function RecordDetailPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const nav = useLocation().state as { recordedAt?: string; date?: string } | null;
  const [confirm, setConfirm] = useState(false);
  const detail = useQuery({ queryKey: ['record', recordId], queryFn: () => recordApi.detail(Number(recordId)) });
  const remove = useMutation({
    mutationFn: () => recordApi.remove(Number(recordId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      qc.invalidateQueries({ queryKey: ['records'] });
      navigate(-1); // 406: 그날 기록으로
    },
  });

  if (detail.isPending) return (<><Header title="기록 상세" back /><Loading /></>);
  if (detail.isError) return (<><Header title="기록 상세" back /><ErrorText text={parseApiError(detail.error).message} /></>);
  const r = detail.data;
  const title = nav?.date && nav.recordedAt ? `${dayTitle(nav.date)} ${toTime(nav.recordedAt)}` : '그때의 마음';

  return (
    <>
      <Header title="기록 상세" back />
      <h2 className="page-title">{title}</h2>

      <p className="section-title">고른 마음</p>
      <div className="chips">{r.emotions.map((e) => <span key={e} className="chip">{emotionLabel(e)}</span>)}</div>

      <p className="section-title">받은 패치</p>
      {r.patches.map((p) => (
        <div key={p.emotion} className={`box ${p.status.kind === 'NOT_RECEIVED' ? 'gray' : ''}`}>
          <p className="caption">{emotionLabel(p.emotion)}{p.status.kind === 'DEFAULT_COMFORT' ? ' · 기본 위로' : ''}</p>
          <p>{p.status.kind === 'NOT_RECEIVED' ? '받지 않았어요' : p.status.message}</p>
        </div>
      ))}

      {r.story && (
        <>
          <p className="section-title">사연</p>
          <div className="box gray"><p>{r.story}</p></div>
        </>
      )}

      <Spacer />
      <button className="btn danger" onClick={() => setConfirm(true)}>이 기록 지우기</button>
      <p className="caption center" style={{ marginTop: 8 }}>지워도 담요의 패치와 하루 횟수는 그대로예요</p>

      {confirm && (
        <ConfirmModal
          title="이 기록을 지울까요?"
          desc="고른 마음, 받은 패치 기록, 사연이 지워지고 되돌릴 수 없어요."
          confirmLabel="지우기"
          danger
          pending={remove.isPending}
          error={remove.isError ? parseApiError(remove.error).message : undefined}
          onCancel={() => setConfirm(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  );
}

/* ───────── 409~412 담요 ───────── */
export function BlanketPage() {
  const navigate = useNavigate();
  const [blanketId, setBlanketId] = useState<number | undefined>();
  const [openSlot, setOpenSlot] = useState<BlanketSlot | null>(null);
  const blanket = useQuery({ queryKey: ['blanket', blanketId ?? 'current'], queryFn: () => blanketApi.get(blanketId) });

  if (blanket.isPending) return (<><Header title="담요" /><Loading /></>);
  if (blanket.isError) return (<><Header title="담요" /><ErrorText text={parseApiError(blanket.error).message} /></>);
  const b = blanket.data;
  const filled = b.slots.filter((s) => s.filled).length;
  const isPast = b.hasNext;
  const complete = filled === BLANKET_SLOTS;

  return (
    <>
      <Header title={isPast ? '지난 담요' : '담요'} back={isPast ? () => setBlanketId(undefined) : undefined} />
      <div className="month-nav">
        <button className="icon-btn" aria-label="지난 담요" disabled={!b.hasPrev} onClick={() => setBlanketId(b.blanketId - 1)}><BackIcon /></button>
        <b>{isPast ? `${b.blanketId}번째 담요` : '지금 짜는 담요'}</b>
        <button className="icon-btn flip" aria-label="다음 담요" disabled={!b.hasNext} onClick={() => setBlanketId(b.blanketId + 1)}><BackIcon /></button>
      </div>

      <div className="blanket" aria-label={`담요 ${filled}칸 채워짐`}>
        {b.slots.map((s) =>
          s.filled ? (
            // BLK-VIEW-002 채워진 칸을 누르면 그 칸의 패치 카드(413)
            <button
              key={s.index}
              className="tile filled"
              style={{ '--knit': emotionColor(s.emotion) } as CSSProperties}
              aria-label={`${s.index + 1}번째 칸 패치 보기`}
              onClick={() => setOpenSlot(s)}
            />
          ) : (
            <div key={s.index} className="tile" />
          ),
        )}
      </div>

      <div className="progress-row">
        <span>담요 완성도</span>
        <b>{filled} / {BLANKET_SLOTS}</b>
      </div>
      <div className="progress"><div style={{ width: `${(filled / BLANKET_SLOTS) * 100}%` }} /></div>

      {filled === 0 ? (
        <>
          <p className="empty-title">아직 도착한 패치가 없어요</p>
          <span className="caption">마음을 고르면 첫 패치가 와요</span>
          <Spacer />
          <button className="btn" onClick={() => navigate('/')}>마음 고르러 가기</button>
        </>
      ) : complete && !isPast ? (
        <>
          <p className="empty-title">담요 한 장이 완성됐어요</p>
          <span className="caption">누군가 건넨 패치 30개가 모였어요</span>
        </>
      ) : !isPast ? (
        <>
          <div className="need-chip"><i />앞으로 패치 {BLANKET_SLOTS - filled}개가 더 필요해요</div>
          <Spacer />
          {b.hasPrev && <button className="btn secondary" onClick={() => setBlanketId(b.blanketId - 1)}>지난 담요 보기</button>}
        </>
      ) : null}

      {openSlot && <BlanketPatchModal slot={openSlot} onClose={() => setOpenSlot(null)} />}
    </>
  );
}

const receivedLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${toTime(iso)}에 받았어요`;
};

/** 413/414 담요 칸 패치 카드 — 받은 패치 글과 그날 기록으로 가는 길 */
function BlanketPatchModal({ slot, onClose }: { slot: BlanketSlot; onClose: () => void }) {
  const navigate = useNavigate();
  const recordId = slot.recordId ?? null;
  // 기록이 지워졌는지(414) 확인. 지운 직후에도 맞도록 열 때마다 다시 확인한다
  const record = useQuery({
    queryKey: ['record', String(recordId)],
    queryFn: () => recordApi.detail(recordId!),
    enabled: recordId !== null,
    retry: false,
    refetchOnMount: 'always',
  });
  const deleted = record.isError && isAxiosError(record.error) && record.error.response?.status === 404;

  return (
    <div className="dim" role="dialog" aria-modal="true" aria-label={`${slot.index + 1}번째 칸 패치`} onClick={onClose}>
      <div className="slot-card" onClick={(e) => e.stopPropagation()}>
        <div className="slot-card-top">
          <span className="slot-no">{slot.index + 1}번째 칸</span>
          <Thread className="wide" />
          <p className="message">{slot.message ?? '따뜻한 패치가 담겨 있어요'}</p>
          <p className="from">같은 마음을 지나온 누군가</p>
        </div>
        <div className="slot-card-bottom">
          {slot.receivedAt && <p className="received">{receivedLabel(slot.receivedAt)}</p>}
          {recordId !== null &&
            (deleted ? (
              <button className="btn" disabled>이날의 기록은 지워졌어요</button>
            ) : (
              <button className="btn secondary" onClick={() => navigate(`/records/${recordId}`)}>이날의 기록 보기</button>
            ))}
          <button className="btn soft" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
