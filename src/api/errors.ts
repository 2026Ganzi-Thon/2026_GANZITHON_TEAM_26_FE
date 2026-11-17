import { isAxiosError } from 'axios';
import type { ApiResponse } from '../types/api';

export interface ApiErrorInfo {
  status: number | null;
  /** 백엔드 ApiResponse.code — 예: '401_LOGIN_FAILED' (상태 코드가 앞에 붙어 옴) */
  code: string | null;
  message: string;
}

/**
 * code별 화면 문구 (백엔드 에러 코드 목록 기준, main)
 * 서버 message는 '~습니다'체라 화면 말투('~요')에 맞춰 여기서 관리한다.
 * TODO(팀): 문구 최종 확정
 */
const MESSAGES: Record<string, string> = {
  '400_INVALID_INPUT': '입력한 내용을 다시 확인해 주세요',
  '400_BAD_REQUEST': '요청을 처리하지 못했어요. 다시 시도해 주세요',
  '401_UNAUTHORIZED': '다시 로그인해 주세요',
  '401_TOKEN_EXPIRED': '로그인이 만료됐어요. 다시 로그인해 주세요',
  '403_FORBIDDEN': '접근할 수 없는 내용이에요',
  '404_NOT_FOUND': '찾을 수 없어요',
  '405_METHOD_NOT_ALLOWED': '요청을 처리하지 못했어요. 다시 시도해 주세요',
  '500_INTERNAL_SERVER_ERROR': '잠시 후 다시 시도해 주세요',

  // 회원가입·로그인
  '409_EMAIL_DUPLICATED': '이미 가입된 이메일이에요',
  '400_EMAIL_NOT_VERIFIED': '이메일 인증을 먼저 해 주세요',
  '400_TERMS_NOT_AGREED': '필수 약관에 모두 동의해 주세요',
  '429_EMAIL_REQUEST_LIMITED': '인증 요청이 너무 많아요. 5분 뒤에 다시 시도해 주세요',
  '404_EMAIL_CODE_NOT_FOUND': '인증번호가 만료됐어요. 다시 요청해 주세요',
  '400_EMAIL_CODE_MISMATCH': '인증번호가 맞지 않아요',
  '401_LOGIN_FAILED': '이메일 또는 비밀번호가 맞지 않아요',
  // TODO(백엔드): 잠금 해제 시간 등 추가 설명 받으면 문구 보강 (Figma 104)
  '423_ACCOUNT_LOCKED': '로그인을 5번 실패해서 잠시 잠겼어요. 잠시 후 다시 시도해 주세요',

  // 마음 기록 — 화면에서는 위기 안내로 보내므로 문구가 보일 일은 거의 없음
  '400_CRISIS_DETECTED': '지금 많이 힘드신 것 같아요',
};

/**
 * 패치 보내기 AI 검수 거절 사유 (POST /api/v1/cheers → 400_CHEER_*)
 * 여러 사유가 걸리면 서버가 더 심각한 사유를 먼저 돌려준다.
 * TODO(팀): 사유별 문구 최종 확정 (Figma 305_수정요청)
 */
const CHEER_REJECT_MESSAGES: Record<string, string> = {
  '400_CHEER_HARSH_LANGUAGE': '거친 표현이 있어요. 조금 부드럽게 바꿔 줄 수 있을까요?',
  '400_CHEER_DEMEANING': '상대를 낮추는 표현이 있어요. 다르게 표현해 줄 수 있을까요?',
  '400_CHEER_HURTFUL': '받는 사람이 상처받을 수 있는 표현이 있어요',
  '400_CHEER_DISMISSIVE': '마음을 가볍게 넘기는 표현이 있어요. 조금 더 다정하게 써 줄 수 있을까요?',
  '400_CHEER_CONTACT_OR_LINK': '연락처나 링크는 보낼 수 없어요',
  '400_CHEER_OFF_TOPIC': '받을 마음과 관련된 이야기로 써 주세요',
};
const CHEER_REJECT_FALLBACK = '조금만 다르게 표현해 줄 수 있을까요?';

/** 패치 검수 거절(400_CHEER_*)이면 화면 문구를, 아니면 null */
export function cheerRejectReason(error: unknown): string | null {
  const { status, code } = parseApiError(error);
  if (status !== 400 || !code?.startsWith('400_CHEER_')) return null;
  return CHEER_REJECT_MESSAGES[code] ?? CHEER_REJECT_FALLBACK;
}

const STATUS_FALLBACK: Record<number, string> = {
  400: '입력한 내용을 다시 확인해 주세요',
  401: '다시 로그인해 주세요',
  403: '접근할 수 없는 내용이에요',
  404: '찾을 수 없어요',
  409: '이미 처리된 요청이에요',
  423: '잠시 이용할 수 없어요. 잠시 후 다시 시도해 주세요',
  429: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요',
  500: '잠시 후 다시 시도해 주세요',
};

export function parseApiError(error: unknown): ApiErrorInfo {
  if (isAxiosError<ApiResponse<unknown>>(error)) {
    const status = error.response?.status ?? null;
    const code = error.response?.data?.code ?? null;
    const message =
      (code && MESSAGES[code]) ||
      (code && CHEER_REJECT_MESSAGES[code]) ||
      error.response?.data?.message ||
      (status && STATUS_FALLBACK[status]) ||
      '네트워크 연결을 확인해 주세요';
    return { status, code, message };
  }
  return { status: null, code: null, message: '알 수 없는 오류가 발생했어요' };
}

/** 마음 기록 저장 시 서버가 위기 표현을 감지했는지 (400_CRISIS_DETECTED) */
export function isCrisisDetected(error: unknown): boolean {
  return parseApiError(error).code === '400_CRISIS_DETECTED';
}
