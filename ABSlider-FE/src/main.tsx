import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

import { BrowserRouter } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import './index.css'
import { App } from './app/App'
import { ToastProvider } from '@/components/ui/Toast'

window.addEventListener('error', (event) => {
  console.error(
    '❌ Lỗi ngoại lệ giao diện chưa được xử lý:',
    event.error || event.message
  )
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Lỗi Promise chưa được xử lý:', event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
)
