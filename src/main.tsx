import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'
import './index.css'
import './components/theme'

// HashRouter يعمل في المتصفح وفي نسخة سطح المكتب (Electron) دون إعدادات خادم
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
        <Toaster dir="rtl" position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
