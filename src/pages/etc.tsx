/** 5xx — 위기 안내(501~504, ALRT-HELP-001/002), 마이(505~511, 로그아웃만 P0) */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChevronRight from '../assets/icons/chevron-right.svg?react';
import { ConfirmModal, Header, Spacer } from '../components/Layout';
import { CRISIS_LINES } from '../constants/emotions';
import { useAuth } from '../providers/AuthProvider';

/**
 * ALRT-HELP-002 위기 안내 — 프론트 전용. Figma 501~503
 * 진입: 도움 요청 버튼(모든 화면) / 사연 위기 감지(503) / 패치 위기 감지(502)
 * 뒤로: state.next가 있으면 그쪽으로(사연 → 마음 고르기, 패치 → 빈 작성 화면), 없으면 이전 화면
 */
export function HelpPage() {
  const navigate = useNavigate();
  const state = useLocation().state as { next?: string; from?: 'story' | 'send' | 'record' } | null;
  const goBack = () => (state?.next ? navigate(state.next, { replace: true }) : navigate(-1));
  const lines = CRISIS_LINES.filter((l) => l.number !== '119');

  return (
    <>
      <Header title="도움 요청" hideHelp back={goBack} />
      {state?.from === 'send' && <div className="info-banner">ⓘ 보내려던 글은 보내지 않았어요</div>}
      {state?.from === 'story' && <div className="info-banner">ⓘ 사연은 나만 보기로 저장했어요</div>}
      {/* 기록 저장 중 서버가 위기 표현 감지(400_CRISIS_DETECTED) — 이때 서버는 기록을 저장하지 않음(BE 확인) */}
      {state?.from === 'record' && <div className="info-banner">ⓘ 이번 기록은 저장하지 않았어요</div>}
      <h2 className="page-title">지금 많이 힘드신가요?</h2>
      <p className="page-sub">혼자 견디지 않아도 괜찮아요</p>

      {lines.map((line, i) => (
        <a key={line.number} className={`line-card ${i === 0 ? 'primary' : ''}`} href={`tel:${line.number}`}>
          <span className="num">{line.number}</span>
          <span className="desc">{line.name} · {line.note}</span>
        </a>
      ))}
      <a className="emergency" href="tel:112">긴급 상황은 112 · 119</a>
      <p className="footnote">
        이 화면을 연 기록은 남기지 않아요.<br />
        외부 기관에 자동으로 알리지 않아요.
      </p>

      {state?.from && (
        <>
          <Spacer />
          <button className="btn secondary" onClick={goBack}>{state.from === 'send' ? '패치로 돌아가기' : '돌아가기'}</button>
        </>
      )}
    </>
  );
}

export function MyPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Header title="마이" />
      <div style={{ marginTop: 8 }}>
        {/* 공지사항·FAQ·고객센터·정보 변경(Figma 507~511)은 MVP 범위 밖 */}
        {['공지사항', 'FAQ', '고객센터', '정보 변경'].map((m) => (
          <button key={m} className="menu-row" disabled>
            <span>{m}</span>
            <span className="caption muted">준비 중</span>
          </button>
        ))}
        <button className="menu-row" onClick={() => setConfirm(true)}>
          <span>로그아웃</span>
          <ChevronRight />
        </button>
      </div>
      {confirm && (
        <ConfirmModal
          title="로그아웃할까요?"
          confirmLabel="로그아웃"
          onCancel={() => setConfirm(false)}
          onConfirm={async () => { await logout(); navigate('/login', { replace: true }); }}
        />
      )}
    </>
  );
}
