/**
 * 3xx 보내기 — BLK-SEND-001(실제 API) 보낼 수 있는지·감정별 질문, BLK-SEND-002(실제 API) 검수·발송. Figma 301~310
 * 패치는 5분에 한 번(쿨타임). 쿨타임 중이거나 신고 누적으로 제한되면 310_보내기제한 화면
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import { patchApi, toTime } from '../api/patch';
import { ErrorText, Header, Loading, Spacer } from '../components/Layout';
import moonUrl from '../assets/illust/patch-moon.svg';
import { PATCH_MAX_LENGTH, emotionLabel } from '../constants/emotions';
import type { EmotionCode } from '../types/api';

/** ISO 시각 → 오늘이면 'HH:mm', 다른 날이면 'M월 D일 HH:mm' */
const untilLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return toTime(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? toTime(iso) : `${d.getMonth() + 1}월 ${d.getDate()}일 ${toTime(iso)}`;
};

export function SendPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['send-status'],
    queryFn: patchApi.sendStatus,
    staleTime: 60_000,
    // 제한 중이면 풀렸는지 주기적으로 다시 확인
    refetchInterval: (query) => (query.state.data && !query.state.data.canSend ? 15_000 : false),
  });
  const [target, setTarget] = useState<EmotionCode | null>(null);
  const [content, setContent] = useState('');
  const [revision, setRevision] = useState('');
  const [done, setDone] = useState(false);

  const send = useMutation({
    mutationFn: () => patchApi.send({ targetEmotion: target!, content }),
    onSuccess: (res) => {
      if (res.result === 'CRISIS') {
        setContent(''); // 위기 판정 시 작성 글 삭제 → 돌아오면 빈 작성 화면(307)
        navigate('/help', { state: { next: '/send', from: 'send' } });
      } else if (res.result === 'NEEDS_REVISION') {
        setRevision(res.reason); // 305_수정요청 — 작성 내용 유지
      } else {
        setDone(true);
        setContent('');
        qc.invalidateQueries({ queryKey: ['send-status'] });
        qc.invalidateQueries({ queryKey: ['calendar'] });
      }
    },
    onError: (err) => {
      // 쿨타임·신고 누적 제한이면 보낼 수 있는지 다시 받아서 310_보내기제한 화면으로
      const { code } = parseApiError(err);
      if (code === '429_CHEER_COOLDOWN' || code === '403_CHEER_SEND_RESTRICTED') {
        qc.invalidateQueries({ queryKey: ['send-status'] });
      }
    },
  });

  if (status.isPending) return (<><Header title="패치 선물하기" /><Loading /></>);
  if (status.isError) return (<><Header title="패치 선물하기" /><ErrorText text={parseApiError(status.error).message} /></>);

  const { canSend, cooldownUntil, restrictedUntil, questions } = status.data;

  if (done) {
    // 308_발송완료
    return (
      <>
        <Header title="패치 선물하기" />
        <div className="sent-done">
          <img className="sent-moon" src={moonUrl} alt="" width={200} height={180} />
          <h2 className="page-title">패치를 건넸어요</h2>
          <p className="page-sub">같은 마음인 누군가에게 닿을 거예요</p>
        </div>
        <Spacer />
        <button className="btn" onClick={() => navigate('/blanket')}>내 담요 보기</button>
        <div className="btn-row">
          <button className="btn secondary" onClick={() => setDone(false)}>패치 더 선물하기</button>
        </div>
      </>
    );
  }

  if (!canSend) {
    // 310_보내기제한 — 5분 쿨타임 또는 신고 누적 제한
    const title = cooldownUntil ? '패치는 5분에 한 번 보낼 수 있어요' : '지금은 패치를 보낼 수 없어요';
    const sub = cooldownUntil
      ? `${untilLabel(cooldownUntil)}부터 다시 보낼 수 있어요`
      : restrictedUntil
        ? `신고가 쌓여서 ${untilLabel(restrictedUntil)}까지 보낼 수 없어요`
        : '잠시 후 다시 시도해 주세요';
    return (
      <>
        <Header title="패치 선물하기" />
        <h2 className="page-title">{title}</h2>
        <p className="page-sub">{sub}</p>
        <Spacer />
        <button className="btn" onClick={() => navigate('/')}>마음 고르러 가기</button>
      </>
    );
  }

  const question = questions.find((q) => q.emotion === target);
  const sending = send.isPending;

  return (
    <>
      <Header title="패치 선물하기" />
      <h2 className="page-title">누구에게 보낼까요?</h2>
      <p className="page-sub sm">패치가 부족한 마음부터 보여요</p>

      <div className="chip-scroll" role="listbox" aria-label="받을 마음">
        {questions.map((q) => (
          <button
            key={q.emotion}
            role="option"
            aria-selected={target === q.emotion}
            className={`chip-select ${target === q.emotion ? 'selected' : ''}`}
            onClick={() => { setTarget(q.emotion); setRevision(''); }}
          >
            {emotionLabel(q.emotion)}
          </button>
        ))}
      </div>
      <p className="send-hint">← 옆으로 밀어서 다른 마음 보기</p>

      {question ? (
        <>
          <div className="question-box">
            <p className="to">'{emotionLabel(question.emotion)}'인 사람에게</p>
            <p className="q">{question.question}</p>
          </div>
          <div className="textarea-wrap" style={{ marginTop: 12 }}>
            <textarea
              className={`textarea ${revision ? 'error' : ''}`}
              style={{ height: 96 }}
              maxLength={PATCH_MAX_LENGTH}
              value={content}
              disabled={sending}
              onChange={(e) => { setContent(e.target.value); }}
              placeholder="같은 마음을 지나온 경험을 짧게 나눠 주세요"
            />
            <span className="counter">{content.length}/{PATCH_MAX_LENGTH}</span>
            {sending && (
              <div className="checking" role="status">
                <span className="spinner" />
                패치를 엮는 중이에요
                <small>잠시만 기다려 주세요</small>
              </div>
            )}
          </div>
          {revision ? (
            <div className="alert-box">
              <b>수정이 필요해요</b>
              <span>{revision}</span>
            </div>
          ) : (
            <p className="caption" style={{ marginTop: 8 }}>익명으로 전해져요 · 연락처나 링크는 보낼 수 없어요</p>
          )}
        </>
      ) : (
        <div className="question-empty">받을 마음을 고르면<br />그 마음에 맞는 질문이 나와요</div>
      )}

      {send.isError && <ErrorText text={parseApiError(send.error).message} />}
      <Spacer />
      <button className="btn" disabled={!target || !content.trim() || sending} onClick={() => send.mutate()}>
        {revision ? '고쳐서 다시 보내기' : '패치 선물하기'}
      </button>
    </>
  );
}
