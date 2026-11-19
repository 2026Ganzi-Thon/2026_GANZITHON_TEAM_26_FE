/** 224 함께 쉬는 방 (ITR-REST-001) — 입장 → 하트비트 → 퇴장 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import { restRoomApi } from '../api/patch';
import { ErrorText, Header, Loading, Spacer } from '../components/Layout';
import { countLabel } from '../constants/emotions';

/**
 * 하트비트 주기 — 서버는 1분 단위로 머무는지 확인한다(백엔드 확인).
 * 크롬은 백그라운드 탭의 타이머를 1분 간격으로 늦추므로, 화면에 있을 땐 30초마다 보내 여유를 둔다.
 */
const HEARTBEAT_MS = 30_000;
/** 들이쉬고 4초 · 내쉬고 4초 — App.css .rest-breath 애니메이션(8초)과 맞춘다 */
const BREATH_MS = 4_000;
const NOT_ENTERED = '400_REST_ROOM_NOT_ENTERED';

/**
 * 입장·하트비트·퇴장 요청을 보낸 순서대로 하나씩 처리한다.
 * → 진행 중이던 하트비트가 퇴장(DELETE)보다 늦게 서버에 도착하는 일이 없다.
 * (개발 모드 StrictMode의 입장 → 퇴장 → 입장도 순서가 꼬이지 않음)
 */
let chain: Promise<unknown> = Promise.resolve();
function inOrder<T>(request: () => Promise<T>): Promise<T> {
  const next = chain.then(request);
  chain = next.catch(() => {});
  return next;
}

function useRestRoom() {
  const [count, setCount] = useState<number | null>(null);
  const [enteredAt, setEnteredAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let inRoom = true; // 이 화면에 머무는 동안만 true — 퇴장 뒤에 도착한 응답은 무시
    let timer: number | undefined;
    const stopHeartbeat = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };

    const heartbeat = async () => {
      try {
        const r = await inOrder(restRoomApi.heartbeat);
        if (inRoom) setCount(r.currentCount);
      } catch (err) {
        if (!inRoom) return; // 퇴장 뒤 하트비트 에러(400_REST_ROOM_NOT_ENTERED 등)는 무시
        // 화면에 있는데 서버에서 퇴장 처리됐으면(오래 백그라운드에 있었을 때 등) 다시 입장
        if (parseApiError(err).code === NOT_ENTERED) void enter();
        // 그 밖의 일시 오류는 다음 하트비트에서 다시 시도
      }
    };

    const enter = async () => {
      stopHeartbeat();
      try {
        const r = await inOrder(restRoomApi.enter);
        if (!inRoom) return;
        setCount(r.currentCount);
        const at = Date.parse(r.enteredAt);
        setEnteredAt(Number.isNaN(at) ? Date.now() : Math.min(at, Date.now()));
        setError(null);
        timer = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
      } catch (err) {
        if (inRoom) setError(parseApiError(err).message);
      }
    };

    void enter();
    // 백그라운드에서 돌아오면 바로 한 번 알려서 1분 사이 공백을 메운다
    const onVisible = () => {
      if (document.visibilityState === 'visible' && timer !== undefined) void heartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    // 탭을 닫거나 새로고침하면 화면이 정리되지 않으므로 따로 퇴장
    const onPageHide = () => restRoomApi.leaveOnUnload();
    window.addEventListener('pagehide', onPageHide);

    return () => {
      inRoom = false;
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisible);
      stopHeartbeat(); // 1) 하트비트 타이머를 먼저 멈추고
      void inOrder(restRoomApi.leave).catch(() => {}); // 2) 그다음 퇴장
    };
  }, []);

  return { count, enteredAt, error };
}

/** 함께 쉰 시간 — 1초마다 갱신 */
function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [since]);
  if (since === null) return '00:00';
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function useBreathPhase() {
  const [inhale, setInhale] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => setInhale((v) => !v), BREATH_MS);
    return () => window.clearInterval(id);
  }, []);
  return inhale ? '들이쉬고' : '내쉬고';
}

/**
 * 소리 켜기 — 음원 파일 없이 브라우저에서 잔잔한 바람 소리(브라운 노이즈)를 만든다.
 * TODO(디자인): 따로 쓸 음원이 정해지면 <audio>로 바꾸기
 */
function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => () => void ctxRef.current?.close().catch(() => {}), []);

  const toggle = async () => {
    try {
      if (on) {
        await ctxRef.current?.suspend();
        setOn(false);
        return;
      }
      if (!ctxRef.current) {
        const ctx = new AudioContext();
        const length = ctx.sampleRate * 8;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          data[i] = last * 3.5;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start();
        ctxRef.current = ctx;
      } else {
        await ctxRef.current.resume();
      }
      setOn(true);
    } catch {
      setOn(false); // 소리를 못 내는 환경이면 조용히 둔다
    }
  };

  return { on, toggle };
}

export function RestRoomPage() {
  const navigate = useNavigate();
  const { count, enteredAt, error } = useRestRoom();
  const elapsed = useElapsed(enteredAt);
  const phase = useBreathPhase();
  const sound = useAmbientSound();

  // 나가기 = 화면을 떠나면 useRestRoom 정리 단계에서 타이머 정지 → 퇴장 순서로 처리된다
  const leave = () => {
    const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate('/', { replace: true });
  };

  if (error) {
    return (
      <>
        <Header title="함께 쉬는 방" back={leave} />
        <ErrorText text={error} />
        <Spacer />
        <button className="btn" onClick={() => navigate('/')}>홈으로 가기</button>
      </>
    );
  }
  if (count === null) return (<><Header title="함께 쉬는 방" back={leave} /><Loading text="쉬는 방에 들어가고 있어요" /></>);

  // currentCount는 나를 포함한 인원(백엔드 확인) → 'N명과 함께'에는 나를 뺀 인원을 쓴다
  // 온기 지도와 같은 기준으로 5명 미만은 인원을 드러내지 않는다
  const others = Math.max(0, count - 1);
  const people = countLabel(others);
  const headline =
    others === 0 ? '편하게 머물다 가요'
    : people ? `${people}과 함께 편하게 머물다 가요`
    : '누군가와 함께 편하게 머물다 가요';

  return (
    <>
      <Header title="함께 쉬는 방" back={leave} />
      <h2 className="page-title rest-title">{headline}</h2>

      <div className="rest-stage">
        <div className="rest-halo">
          <div className="rest-breath" aria-live="polite">{phase}</div>
        </div>
        <p className="rest-timer" aria-label={`함께 쉰 시간 ${elapsed}`}>{elapsed}</p>
        <p className="caption center">함께 쉰 시간</p>
      </div>

      <Spacer />
      <div className="btn-row">
        <button className="btn secondary" aria-pressed={sound.on} onClick={() => void sound.toggle()}>
          {sound.on ? '소리 끄기' : '소리 켜기'}
        </button>
        <button className="btn" onClick={leave}>나가기</button>
      </div>
    </>
  );
}
