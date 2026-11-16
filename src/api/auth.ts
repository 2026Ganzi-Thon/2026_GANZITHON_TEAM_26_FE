/** 인증 API — Swagger(PATCH API) 기준, 실제 서버와 일치 */
import type {
  ApiResponse,
  EmailCodeSendRequest,
  EmailCodeVerifyRequest,
  LoginRequest,
  LoginResponse,
  SignupRequest,
} from '../types/api';
import { api, unwrap } from './client';

export const authApi = {
  sendEmailCode: (body: EmailCodeSendRequest) =>
    unwrap(api.post<ApiResponse<null>>('/api/v1/auth/email-verifications', body)),

  verifyEmailCode: (body: EmailCodeVerifyRequest) =>
    unwrap(api.post<ApiResponse<null>>('/api/v1/auth/email-verifications/confirm', body)),

  signup: (body: SignupRequest) => unwrap(api.post<ApiResponse<null>>('/api/v1/auth/signup', body)),

  login: (body: LoginRequest) =>
    unwrap(api.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', body)),

  logout: () => unwrap(api.post<ApiResponse<null>>('/api/v1/auth/logout')),
};
