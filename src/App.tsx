import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './providers/AuthProvider';
import { DraftProvider } from './providers/DraftProvider';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DraftProvider>
          <RouterProvider router={router} />
        </DraftProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
