import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import './index.css'
import { App } from './app/App'
import { RouteError } from './app/RouteError'
import { ToastProvider } from '@/components/ui/Toast'

const router = createBrowserRouter([
  { path: '*', element: <App />, errorElement: <RouteError /> }
])

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
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
)
