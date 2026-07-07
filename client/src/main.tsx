import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { apiClient } from './lib/api'
import './index.css'

import { routeTree } from './routeTree.gen'

// gcTime debe ser >= maxAge de la persistencia para que las entradas sobrevivan en localStorage
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 // 24hs

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: PERSIST_MAX_AGE,
      retry: 2,
      retryDelay: 1000,
      // networkMode 'online' (default): sin conexion no refetchea, pero sirve el cache persistido
    },
    mutations: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      // networkMode 'online' (default): sin conexion la mutacion queda PAUSADA y se persiste;
      // se resume sola al volver internet (incluso tras recargar, via resumePausedMutations)
    },
  },
})

// Mutacion de cargar resultado registrada con default keyed: al persistirse solo se guardan
// las variables (el payload), no la funcion — por eso el mutationFn tiene que vivir aca para
// poder resumirse despues de recargar la pagina.
queryClient.setMutationDefaults(['set-result'], {
  mutationFn: async (payload: any) => {
    const { data } = await apiClient.patch('/admin?action=set-result', payload)
    return data.data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['local-fixtures'] })
    queryClient.invalidateQueries({ queryKey: ['knockout-fixtures'] })
    queryClient.invalidateQueries({ queryKey: ['knockout-matches'] })
    queryClient.invalidateQueries({ queryKey: ['bracket'] })
  },
})

const persister = createSyncStoragePersister({ storage: window.localStorage })

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}
      onSuccess={() => {
        // Al hidratar desde localStorage, reintentar las mutaciones que quedaron pausadas offline
        queryClient.resumePausedMutations()
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
)
