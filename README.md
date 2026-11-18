# PATCH 웹 프론트엔드

같은 마음인 사람들과 익명으로 패치를 주고받는 감정 공유 서비스 **PATCH**의 프론트엔드입니다.

- 스택: Vite · React 19 · TypeScript · React Router · TanStack Query · axios · MSW
- 백엔드: `https://nyam17.site` (Swagger "PATCH API")
  - **실제 서버 연결**: 회원가입·이메일 인증·로그인·로그아웃, 마음 기록 저장, 사연 위기 검사, 캘린더, 그날 기록, 기록 상세·삭제, 보내기 질문, 패치 보내기, 온기 지도, 패치 받기·신고, 담요·담요 칸
  - **목업(MSW)**: 지금은 없음 (`VITE_MOCK_AUTH=true`면 백엔드 없이 전부 목업으로 시연)

## 디자인 기준

- Figma **패치 UI (작업용)** 최종 파일의 변수·컴포넌트(Header, TabBar, Button) 기준, 프레임 412 × 917
- 토큰: `src/styles/tokens.css` / 아이콘: `src/assets/icons` / 로고: `src/assets/brand/logo.png`
- 담요 니트 칸은 Figma 이미지 대신 CSS 무늬로 근사했어요.
- Figma의 상단 상태바(9:41)는 기기 목업이라 웹에서는 넣지 않았어요.

## 시작하기

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:5173
```

- 기본값: 실제 서버(nyam17.site)로 로그인·기록이 저장돼요. 회원가입부터 해 주세요.
- 백엔드 없이 시연하려면 `.env.local`에서 `VITE_MOCK_AUTH=true` — 아무 이메일·비밀번호로 로그인되고, 인증번호는 `123456`이에요.

## 배포 (Vercel)

```bash
npx vercel --prod --build-env VITE_USE_MOCK=true
```
`vercel.json`이 `/api` 요청을 nyam17.site로 넘겨 줘요. 백엔드 없이 시연용으로 배포하려면 `--build-env VITE_MOCK_AUTH=true`를 추가하세요.

## 폴더 구조

```
src/
  api/          axios 클라이언트(토큰 자동 갱신), 인증 API, 기능 API, 에러 파싱
  constants/    감정 목록, 글자 수 제한, 위기 상담 번호
  components/   레이아웃(헤더·도움 요청 버튼·탭바)
  mocks/        MSW 핸들러 + 인메모리 목업 DB
  pages/        auth(1xx) · home(2xx) · send(3xx) · records(4xx) · etc(5xx)
  providers/    로그인 상태, 작성 중인 마음(감정·사연)
  styles/       디자인 토큰 (Figma 00_컬러·타입)
  types/api.ts  API 타입
```

## 라우트

| 경로 | 화면 | 기능 ID | API |
| --- | --- | --- | --- |
| /login | 로그인 | USR-AUTH-003 | 실제 |
| /signup | 회원가입·이메일 인증 | USR-AUTH-001/002 | 실제 |
| / | 마음 고르기 | CRD-WRITE-001/003 | 실제 |
| /story | 사연 입력·위기 검사 | CRD-WRITE-002, ALRT-DETECT-001 | 실제 |
| /map | 온기 지도 | ITR-MAP-001 | 실제 `/interactions/map` (30초 폴링, 명세는 1분) |
| /receive | 패치 받기·신고 | BLK-RCV-001/002, BLK-RPT-001 | 실제 `/cheers/receive`, `/cheers/{cheerId}/report` |
| /send | 패치 선물하기 | BLK-SEND-001/002 | 실제 `/cheers` |
| /records | 캘린더 + 그날 기록(시트) | CRD-VIEW-001/002 | 실제 |
| /records/:recordId | 기록 상세·삭제 | CRD-VIEW-003, CRD-DEL-001 | 실제 |
| /blanket | 담요 · 칸 패치 카드 | BLK-VIEW-001/002 | 실제 `/blankets`, `/blankets/{id}/slots/{slotIndex}` |
| /help | 위기 안내 (로그인 불필요) | ALRT-HELP-001/002 | 없음 |
| /my | 마이·로그아웃 | USR-USER-* | 실제(로그아웃) |

## 실제 API가 나오면

1. `src/api/patch.ts`의 URL을 실제 명세에 맞춥니다.
2. `src/types/api.ts`의 타입을 실제 응답에 맞춥니다.
3. `src/mocks/handlers.ts`에서 해당 핸들러를 지웁니다. 지운 요청은 자동으로 실제 서버로 갑니다.
4. 에러 `code`별 화면 문구는 `src/api/errors.ts`의 `MESSAGES`(패치 검수 거절은 `CHEER_REJECT_MESSAGES`)에서 관리합니다.

## 목업에서 시험해 볼 것

- 사연에 "죽고 싶" 같은 표현 → 위기 안내 화면 → 돌아가기 시 온기 지도로 이동
- 패치에 링크나 전화번호 → "수정 요청" 안내 (작성 내용 유지) — `VITE_MOCK_AUTH=true`일 때. 실제 서버는 AI 검수 결과로 `400_CHEER_*` 6종을 돌려줘요
- 하루 4번째 기록부터 → 기본 위로 + 담요 미적립 안내

## 미확정 사항 (코드에 `TODO(팀)` / `TODO(백엔드)`로 표시)

- 테마: 지금은 Figma 라이트 테마. 다크로 정해지면 `styles/tokens.css`의 `[data-theme='dark']`를 채우면 됩니다.
- 감정 코드와 담요 색 매핑: `constants/emotions.ts`
- 패치 검수 거절 6종·에러 코드별 화면 문구 최종 확정: `api/errors.ts`
- 온기 지도 갱신 간격: Figma 30초 / 명세 1분 (실시간 연결은 없음)
- 오늘 받은 패치 재조회 방법 (새로고침 시 409) — 전용 API 없음

패치는 5분에 한 번 보낼 수 있어요(쿨타임). 하루 발송 한도는 없어요. 쿨타임 중이면 보내기 제한 화면(310)이 나와요.
