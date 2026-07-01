import { X } from 'lucide-react'
import { usePlayerStats, usePlayerMemberships } from '../hooks/useLocalPlayers'
import { TeamBadge } from './TeamBadge'

interface LocalPlayer {
  id: number
  firstName: string
  lastName: string
  position: string | null
  teamId: number
}

interface LocalPlayerModalProps {
  player: LocalPlayer
  tournamentId: number
  isNational?: boolean
  onClose: () => void
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-gray-800/60 rounded-xl p-3">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 text-center">{label}</span>
      {sub && <span className="text-[10px] text-gray-600">{sub}</span>}
    </div>
  )
}

export function LocalPlayerModal({ player, tournamentId, isNational = false, onClose }: LocalPlayerModalProps) {
  const { data: stats, isLoading } = usePlayerStats(player.id, tournamentId)
  const { data: memberships } = usePlayerMemberships(player.id)

  // En vista de seleccion mostramos en que club juega; en vista de club, su seleccion. Solo si existe.
  const crossInfo = isNational ? memberships?.clubs : memberships?.nations
  const crossLabel = isNational ? 'Juega en:' : ''

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm pointer-events-auto"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {player.firstName} {player.lastName}
                </h2>
              </div>
              {player.position && (
                <span className="text-xs text-[#74ACDF] mt-0.5 block">{player.position}</span>
              )}
              {crossInfo && crossInfo.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-xs text-gray-500">{crossLabel}</span>
                  {crossInfo.map((m) => (
                    <span key={m.name} className="flex items-center gap-1 text-xs text-gray-300">
                      <TeamBadge name={m.name} logo={m.logoUrl} size={16} />
                      {m.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors mt-0.5">
              <X size={18} />
            </button>
          </div>

          {/* Stats */}
          <div className="px-5 pb-5">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-800 rounded-xl" />
                ))}
              </div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Partidos" value={stats.played} />
                  <StatBox label="Titular" value={stats.started} />
                  <StatBox label="Suplente" value={stats.subIn} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Goles" value={stats.goals} />
                  <StatBox label="Asistencias" value={stats.assists} />
                  <StatBox label="Minutos" value={stats.minutesPlayed} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Amarillas" value={stats.yellowCards} />
                  <StatBox label="Rojas" value={stats.redCards} />
                </div>
                {player.position === 'Arquero' && stats.penaltySaves > 0 && (
                  <div className="grid grid-cols-1 gap-2">
                    <StatBox label="Penales atajados" value={stats.penaltySaves} />
                  </div>
                )}
                {stats.played === 0 && (
                  <p className="text-xs text-gray-600 text-center pt-1">
                    Sin incidencias registradas en este torneo
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">No se pudieron cargar las estadísticas</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
