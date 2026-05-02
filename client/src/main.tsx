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
      retry: 1,
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

// En main.tsx o App.tsx
const lockOrientation = async () => {
  const isPhone = /iPhone|Android.*Mobile|Windows Phone/i.test(navigator.userAgent)
  console.log('userAgent:', navigator.userAgent)
  console.log('isPhone:', isPhone)
  if (isPhone && (screen.orientation as any)?.lock) {
    try {
      await (screen.orientation as any).lock('portrait')
      console.log('lock applied')
    } catch (e) {
      console.log('lock failed:', e)
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
