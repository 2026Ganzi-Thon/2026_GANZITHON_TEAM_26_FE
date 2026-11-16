/** 1xx 인증 — 로그인(101~104), 회원가입·이메일 인증(106~112). 실제 API 연결. */
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { parseApiError } from '../api/errors';
import logo from '../assets/brand/logo.png';
import { ErrorText, Header } from '../components/Layout';
import { useAuth } from '../providers/AuthProvider';
import type { Agreement } from '../types/api';

/** Figma 100/101: 매듭 로고 + PATCH + 부제 */
export function Logo() {
  return (
    <div className="logo">
      <img src={logo} alt="" width={76} height={78} />
      <h1 className="logo-title">PATCH</h1>
      <p className="logo-sub">지금 같은 마음인 사람들이 있어요</p>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder: string; error?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input className={`input ${error ? 'error' : ''}`} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" className="input-toggle" onClick={() => setShow((s) => !s)}>
          {show ? '숨기기' : '보기'}
        </button>
      )}
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const justSignedUp = (location.state as { signedUp?: boolean } | null)?.signedUp;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      await login({ email, password });
      // TODO(P1): isOnboardingCompleted=false면 /onboarding (온보딩은 P1)
      navigate('/', { replace: true });
    } catch (err) {
      // TODO(백엔드): 5회 잠금(Figma 104) code 받으면 분기
      setError(parseApiError(err).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Logo />
      {justSignedUp && <div className="info-banner" style={{ marginBottom: 16 }}>가입이 완료됐어요. 로그인해 주세요.</div>}
      <label className="field">
        <span>이메일</span>
        <input className={`input ${error ? 'error' : ''}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 입력" />
      </label>
      <div className="field">
        <span>비밀번호</span>
        <PasswordInput value={password} onChange={setPassword} placeholder="비밀번호 입력" error={!!error} />
      </div>
      {error && <ErrorText text={error} />}
      <div className="auth-actions">
        <button className="btn" disabled={!email || !password || pending}>
          {pending ? '로그인 중…' : '로그인'}
        </button>
        <p>
          아직 계정이 없나요? <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </form>
  );
}

const AGREEMENTS: { value: Agreement; label: string }[] = [
  { value: 'TERMS_OF_SERVICE', label: '[필수] 서비스 이용약관' },
  { value: 'PRIVACY_POLICY', label: '[필수] 개인정보 처리방침' },
  { value: 'USAGE_PRINCIPLES', label: '[필수] 이용 원칙' },
];

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState<Agreement[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setPending(false);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8 && password.length <= 20;
  const allAgreed = agreed.length === AGREEMENTS.length;

  return (
    <>
      <Header title="회원가입" back={() => navigate('/login')} hideHelp />
      <h2 className="page-title">반가워요</h2>
      <p className="page-sub" style={{ marginBottom: 24 }}>이메일 인증 후 가입할 수 있어요</p>

      <div className="field">
        <span>이메일</span>
        <div className="inline">
          <input className={`input ${email && !emailValid ? 'error' : ''}`} type="email" placeholder="이메일 입력" value={email} disabled={verified} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn" disabled={!emailValid || verified || pending} onClick={() => run(async () => { await authApi.sendEmailCode({ email }); setCodeSent(true); })}>
            {codeSent ? '재전송' : '인증 요청'}
          </button>
        </div>
        {email && !emailValid && <ErrorText text="이메일 형식을 확인해 주세요" />}
      </div>

      {codeSent && !verified && (
        <div className="field">
          <span>인증번호</span>
          <div className="inline">
            <input className="input" inputMode="numeric" maxLength={6} placeholder="숫자 6자리" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn" disabled={code.length !== 6 || pending} onClick={() => run(async () => { await authApi.verifyEmailCode({ email, code }); setVerified(true); })}>
              확인
            </button>
          </div>
        </div>
      )}
      {verified && <p className="caption" style={{ margin: '0 0 12px', color: 'var(--color-primary)' }}>✓ 이메일 인증이 완료됐어요</p>}

      <div className="field">
        <span>비밀번호</span>
        <PasswordInput value={password} onChange={setPassword} placeholder="8~20자" />
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="checkbox-row all">
          <input type="checkbox" checked={allAgreed} onChange={(e) => setAgreed(e.target.checked ? AGREEMENTS.map((a) => a.value) : [])} />
          전체 동의
        </label>
        {AGREEMENTS.map((a) => (
          <label key={a.value} className="checkbox-row">
            <input type="checkbox" checked={agreed.includes(a.value)} onChange={(e) => setAgreed((prev) => (e.target.checked ? [...prev, a.value] : prev.filter((v) => v !== a.value)))} />
            {a.label}
          </label>
        ))}
      </div>

      {error && <ErrorText text={error} />}
      <div style={{ marginTop: 24 }}>
        <button
          className="btn"
          disabled={!verified || !passwordValid || !allAgreed || pending}
          onClick={() => run(async () => {
            await authApi.signup({ email, password, agreements: agreed });
            navigate('/login', { replace: true, state: { signedUp: true } });
          })}
        >
          가입하기
        </button>
      </div>
    </>
  );
}
