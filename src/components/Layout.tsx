import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BackIcon from '../assets/icons/back.svg?react';
import TabBlanket from '../assets/icons/tab-blanket.svg?react';
import TabHome from '../assets/icons/tab-home.svg?react';
import TabMy from '../assets/icons/tab-my.svg?react';
import TabRecord from '../assets/icons/tab-record.svg?react';
import TabSend from '../assets/icons/tab-send.svg?react';
import WarnIcon from '../assets/icons/warn.svg?react';

interface HeaderProps {
  title: string;
  /** 뒤로 가기. 없으면 숨김(탭 첫 화면), true면 history back, 함수면 그 동작 */
  back?: boolean | (() => void);
  /** 도움 요청 버튼 숨김 (위기 안내·인증 화면) */
  hideHelp?: boolean;
}

/** 공통 헤더 — Figma Header: h53, 뒤로 20px · 제목 18 Bold · 도움 요청(36px 원, 경고 아이콘) */
export function Header({ title, back, hideHelp = false }: HeaderProps) {
  const navigate = useNavigate();
  const onBack = typeof back === 'function' ? back : () => navigate(-1);
  return (
    <header className="header">
      {back && (
        <button className="header-back" aria-label="뒤로" onClick={onBack}>
          <BackIcon />
        </button>
      )}
      <h1 className="header-title">{title}</h1>
      {!hideHelp && <HelpButton />}
    </header>
  );
}

/** ALRT-HELP-001: 확인 없이 바로 위기 안내로 */
export function HelpButton() {
  const navigate = useNavigate();
  return (
    <button className="help-btn" aria-label="도움 요청" onClick={() => navigate('/help')}>
      <WarnIcon />
    </button>
  );
}

const TABS = [
  { to: '/', label: '홈', Icon: TabHome },
  { to: '/send', label: '보내기', Icon: TabSend },
  { to: '/records', label: '기록', Icon: TabRecord },
  { to: '/blanket', label: '담요', Icon: TabBlanket },
  { to: '/my', label: '마이', Icon: TabMy },
];

/** 하단 탭바 화면 — Figma TabBar: h88, 탭 간격 76, 활성 탭은 베이지 아이콘 박스 + Bold */
export function TabLayout() {
  const { pathname } = useLocation();
  // 온기 지도·패치 받기는 홈 흐름이라 홈 탭을 켜 둔다 (Figma 208/217)
  const homeFlow = ['/map', '/receive'].includes(pathname);
  return (
    <div className="app-frame with-tabbar">
      <div className="app-body">
        <Outlet />
      </div>
      <nav className="tabbar">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `tab ${isActive || (to === '/' && homeFlow) ? 'active' : ''}`}>
            <span className="tab-icon">
              <Icon />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** 탭바 없는 화면 (로그인, 사연 입력, 위기 안내) */
export function PlainLayout() {
  return (
    <div className="app-frame">
      <div className="app-body">
        <Outlet />
      </div>
    </div>
  );
}

export function Loading({ text = '불러오는 중이에요' }: { text?: string }) {
  return <p className="state-text">{text}</p>;
}

export function ErrorText({ text }: { text: string }) {
  return <p className="error-text">{text}</p>;
}

export function Spacer() {
  return <div className="spacer" />;
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className="toast">{children}</div>;
}

/** 가운데 확인 모달 (408 지우기 확인, 506 로그아웃 확인) */
export function ConfirmModal({
  title,
  desc,
  confirmLabel,
  danger = false,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  desc?: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dim" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <b>{title}</b>
        {desc && <p>{desc}</p>}
        {error && <ErrorText text={error} />}
        <div className="btn-row">
          <button className="btn secondary" onClick={onCancel}>취소</button>
          <button className={`btn ${danger ? 'danger-soft' : ''}`} disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
