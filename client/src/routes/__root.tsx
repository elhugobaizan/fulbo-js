import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { BottomNav } from '../components/BottomNav'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className="min-h-screen flex flex-col">
      {/* Desktop navbar - oculto en mobile */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-screen-2xl pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom nav - solo en mobile */}
      <div className="md:hidden">
        <BottomNav />
      </div>

      <div className="flex justify-between items-center px-4 py-4 md:pb-4 pb-24">
        <span className="text-xs text-gray-600">
          v{__APP_VERSION__} · {__BUILD_DATE__}
        </span>
        <a href="/admin" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
          Admin
        </a>
      </div>
    </div>
  ),
})
