import { X, Award, Target, Footprints, CreditCard } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { Player, PlayerStatistics } from '../types/football'

interface PlayerModalProps {
  player: Player | null
  onClose: () => void
}

function StatBox({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-white">{value ?? '—'}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-[#74ACDF]" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  )
}

interface ModalContentProps {
  player: Player
  stats: PlayerStatistics | undefined
  ratingNum: number | null
  ratingColor: string
  onClose: () => void
  showHandle?: boolean
}

function ModalContent({ player, stats, ratingNum, ratingColor, onClose, showHandle }: ModalContentProps) {
  const { player: info } = player
  return (
    <>
      {showHandle && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>
      )}
      <div className="relative flex items-center gap-4 p-5 pb-4">
        <img
          src={info.photo}
          alt={info.name}
          className="w-16 h-16 rounded-full object-cover bg-gray-800 ring-2 ring-gray-700"
          onError={(e) => {
            ; (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${info.name}&background=1f2937&color=fff&size=128`
          }}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white">{info.firstname} {info.lastname}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
              {stats?.games?.position ?? 'N/D'}
            </span>
            <span className="text-xs text-gray-400">{info.nationality}</span>
            <span className="text-xs text-gray-500">{info.age} años</span>
          </div>
          {stats?.team && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <img src={stats.team.logo} alt={stats.team.name} className="w-4 h-4 object-contain" />
              <span className="text-xs text-gray-300">{stats.team.name}</span>
            </div>
          )}
        </div>
        {ratingNum && (
          <div className="text-center">
            <p className={`text-2xl font-bold ${ratingColor}`}>{ratingNum.toFixed(1)}</p>
            <p className="text-[10px] text-gray-500">Rating</p>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      {stats ? (
        <div className="px-5 pb-6 space-y-5">
          <Section icon={Award} title="Participación">
            <StatBox label="Partidos" value={stats.games.appearences} />
            <StatBox label="Titular" value={stats.games.lineups} />
            <StatBox label="Minutos" value={stats.games.minutes} />
          </Section>
          <Section icon={Target} title="Ataque">
            <StatBox label="Goles" value={stats.goals.total} />
            <StatBox label="Asistencias" value={stats.goals.assists} />
            <StatBox label="Tiros al arco" value={stats.shots?.on} />
          </Section>
          <Section icon={Footprints} title="Juego">
            <StatBox label="Pases clave" value={stats.passes?.key} />
            <StatBox label="Precisión %" value={stats.passes?.accuracy} />
            <StatBox label="Regates" value={stats.dribbles?.success} />
          </Section>
          <Section icon={CreditCard} title="Disciplina">
            <StatBox label="Amarillas" value={stats.cards.yellow} />
            <StatBox label="Doble amarilla" value={stats.cards.yellowred} />
            <StatBox label="Rojas" value={stats.cards.red} />
          </Section>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-800">
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{info.height ?? '—'}</p>
              <p className="text-[11px] text-gray-500">Altura</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{info.weight ?? '—'}</p>
              <p className="text-[11px] text-gray-500">Peso</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{info.birth?.place ?? '—'}</p>
              <p className="text-[11px] text-gray-500">Nacimiento</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">Sin estadísticas disponibles</p>
      )}
    </>
  )
}

export function PlayerModal({ player, onClose }: PlayerModalProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!player) return null

  const { statistics } = player
  const stats = statistics[0]
  const ratingNum = stats?.games?.rating ? parseFloat(stats.games.rating) : null
  const ratingColor = ratingNum
    ? ratingNum >= 7.5 ? 'text-emerald-400' : ratingNum >= 6.5 ? 'text-yellow-400' : 'text-red-400'
    : 'text-gray-400'

  const contentProps = { player, stats, ratingNum, ratingColor, onClose }

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9998 }}
        onClick={onClose}
      />
      {isMobile ? (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: '#111827', borderRadius: '16px 16px 0 0', borderTop: '1px solid #1f2937', maxHeight: '90vh', overflowY: 'auto' }}>
          <ModalContent {...contentProps} showHandle />
        </div>
      ) : (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', width: '480px', paddingBottom: '1rem' }}>
          <ModalContent {...contentProps} />
        </div>
      )}
    </>,
    document.body
  )
}