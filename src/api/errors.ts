import { isAxiosError } from 'axios';
import type { ApiResponse } from '../types/api';

export interface ApiErrorInfo {
  status: number | null;
  /** 백엔드 ApiResponse.code — TODO(백엔드): 에러 code 목록 받으면 아래 MESSAGES 채우기 */
  code: string | null;
  message: string;
}

/** code별 화면 문구. 백엔드 message를 그대로 쓰지 않고 여기서 관리하면 문구 수정이 쉬워진다. */
const MESSAGES: Record<string, string> = {
  // 예시 — 실제 code 값으로 교체
  // EMAIL_DUPLICATED: '이미 가입된 이메일이에요',
  // PATCH_INAPPROPRIATE: '조금만 다르게 표현해 줄 수 있을까요?',
  // SEND_QUOTA_EXHAUSTED: '오늘 보낼 수 있는 패치를 모두 보냈어요',
};

const STATUS_FALLBACK: Record<number, string> = {
  400: '입력한 내용을 다시 확인해 주세요',
  401: '다시 로그인해 주세요',
  403: '접근할 수 없는 내용이에요',
  404: '찾을 수 없어요',
  409: '이미 처리된 요청이에요',
  429: '오늘은 더 이상 할 수 없어요',
  500: '잠시 후 다시 시도해 주세요',
};

export function parseApiError(error: unknown): ApiErrorInfo {
  if (isAxiosError<ApiResponse<unknown>>(error)) {
    const status = error.response?.status ?? null;
    const code = error.response?.data?.code ?? null;
    const message =
      (code && MESSAGES[code]) ||
      error.response?.data?.message ||
      (status && STATUS_FALLBACK[status]) ||
      '네트워크 연결을 확인해 주세요';
    return { status, code, message };
  }
  return { status: null, code: null, message: '알 수 없는 오류가 발생했어요' };
}
