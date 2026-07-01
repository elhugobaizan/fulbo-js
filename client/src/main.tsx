import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import './index.css'

import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 2,
      retryDelay: 1000
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const lockOrientation = async () => {
  const isPhone = /iPhone|Android.*Mobile|Windows Phone/i.test(navigator.userAgent)
  if (isPhone && (screen.orientation as any)?.lock) {
    try {
      await (screen.orientation as any).lock('portrait')
    } catch {
      // orientation lock unsupported/denied — not critical, ignore
    }
  }
}

window.addEventListener('resize', lockOrientation)
lockOrientation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
