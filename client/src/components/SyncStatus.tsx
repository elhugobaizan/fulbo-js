import { useEffect, useState } from 'react'
import { useMutationState } from '@tanstack/react-query'
import { onlineManager } from '@tanstack/react-query'
import { CloudOff, RefreshCw } from 'lucide-react'

// Muestra un aviso cuando hay resultados cargados sin conexion esperando sincronizar.
// Las mutaciones ['set-result'] hechas offline quedan pausadas/persistidas y se
// resumen solas al volver internet.
export function SyncStatus() {
  const [online, setOnline] = useState(onlineManager.isOnline())

  useEffect(() => onlineManager.subscribe(setOnline), [])

  const pendingCount = useMutationState({
    filters: { mutationKey: ['set-result'] },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length

  if (pendingCount === 0) return null

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-4 z-[60] flex items-center gap-2 rounded-full border border-yellow-700/50 bg-yellow-950/80 backdrop-blur px-4 py-2 shadow-lg">
      {online
        ? <RefreshCw size={13} className="text-yellow-400 animate-spin" />
        : <CloudOff size={13} className="text-yellow-400" />}
      <span className="text-xs font-medium text-yellow-200">
        {pendingCount} resultado{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar
      </span>
    </div>
  )
}
