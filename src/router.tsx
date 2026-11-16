import { Navigate, createBrowserRouter } from 'react-router-dom';
import { GuestOnly, RequireAuth } from './components/guards';
import { PlainLayout, TabLayout } from './components/Layout';
import { LoginPage, SignupPage } from './pages/auth';
import { HelpPage, MyPage } from './pages/etc';
import { EmotionPickPage, ReceivePage, StoryPage, WarmthMapPage } from './pages/home';
import { BlanketPage, RecordDetailPage, RecordsPage } from './pages/records';
import { SendPage } from './pages/send';

export const router = createBrowserRouter([
  {
    element: <PlainLayout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
        ],
      },
      // 위기 안내는 로그인 여부와 무관하게 접근 가능 (ALRT-HELP-001)
      { path: '/help', element: <HelpPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/story', element: <StoryPage /> }],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <TabLayout />,
        children: [
          { path: '/', element: <EmotionPickPage /> },
                    { path: '/map', element: <WarmthMapPage /> },
          { path: '/receive', element: <ReceivePage /> },
          { path: '/send', element: <SendPage /> },
          { path: '/records', element: <RecordsPage /> },
          { path: '/records/:recordId', element: <RecordDetailPage /> },
          { path: '/blanket', element: <BlanketPage /> },
          { path: '/my', element: <MyPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
