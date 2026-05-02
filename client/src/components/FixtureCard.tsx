import type { Fixture } from '../types/football'

interface FixtureCardProps {
  fixture: Fixture
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  NS: { label: 'Por jugar', color: 'text-gray-400' },
  '1H': { label: 'En juego', color: 'text-emerald-400' },
  HT: { label: 'Entretiempo', color: 'text-yellow-400' },
  '2H': { label: 'En juego', color: 'text-emerald-400' },
  ET: { label: 'Prórroga', color: 'text-emerald-400' },
  P: { label: 'Penales', color: 'text-emerald-400' },
  FT: { label: 'Finalizado', color: 'text-gray-500' },
  AET: { label: 'Finalizado', color: 'text-gray-500' },
  PEN: { label: 'Finalizado', color: 'text-gray-500' },
  PST: { label: 'Postergado', color: 'text-orange-400' },
  CANC: { label: 'Cancelado', color: 'text-red-400' },
  SUSP: { label: 'Suspendido', color: 'text-red-400' },
}

const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'P']

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FixtureCard({ fixture }: FixtureCardProps) {
  const { fixture: info, teams, goals, league } = fixture
  const status = STATUS_MAP[info.status.short] ?? { label: info.status.short, color: 'text-gray-400' }
  const isLive = LIVE_STATUSES.includes(info.status.short)
  const isFinished = ['FT', 'AET', 'PEN'].includes(info.status.short)
  const isScheduled = info.status.short === 'NS'

  return (
    <div className={`
      relative rounded-xl border transition-colors
      ${isLive
        ? 'border-emerald-800/60 bg-emerald-950/20'
        : 'border-gray-800 bg-gray-900/40 hover:bg-gray-900/70'
      }
    `}>
      {/* Live badge */}
      {isLive && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            {info.status.short === 'HT' ? 'ET' : `${info.status.elapsed}'`}
          </span>
        </div>
      )}

      <div className="px-4 py-3">
        {/* Jornada / estado */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-gray-500">{league.round}</span>
          <span className={`text-[11px] font-medium ${status.color}`}>
            {isScheduled ? formatTime(info.date) : status.label}
          </span>
        </div>

        {/* Equipos y marcador */}
        <div className="flex items-center gap-3">
          {/* Local */}
          <div className="flex-1 flex items-center gap-2 justify-end">
            <span className={`text-sm font-semibold text-right leading-tight ${
              isFinished && (goals.home ?? 0) > (goals.away ?? 0) ? 'text-white' : 'text-gray-300'
            }`}>
              {teams.home.name}
            </span>
            <img src={teams.home.logo} alt={teams.home.name} className="w-8 h-8 object-contain flex-shrink-0" />
          </div>

          {/* Marcador */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isScheduled ? (
              <span className="text-gray-500 font-medium text-sm px-2">vs</span>
            ) : (
              <>
                <span className={`text-xl font-bold w-7 text-center ${
                  isFinished && (goals.home ?? 0) > (goals.away ?? 0) ? 'text-white' : 'text-gray-300'
                }`}>
                  {goals.home ?? 0}
                </span>
                <span className="text-gray-600 font-bold">-</span>
                <span className={`text-xl font-bold w-7 text-center ${
                  isFinished && (goals.away ?? 0) > (goals.home ?? 0) ? 'text-white' : 'text-gray-300'
                }`}>
                  {goals.away ?? 0}
                </span>
              </>
            )}
          </div>

          {/* Visitante */}
          <div className="flex-1 flex items-center gap-2">
            <img src={teams.away.logo} alt={teams.away.name} className="w-8 h-8 object-contain flex-shrink-0" />
            <span className={`text-sm font-semibold leading-tight ${
              isFinished && (goals.away ?? 0) > (goals.home ?? 0) ? 'text-white' : 'text-gray-300'
            }`}>
              {teams.away.name}
            </span>
          </div>
        </div>

        {/* Estadio */}
        {info.venue?.name && (
          <p className="text-[11px] text-gray-600 text-center mt-2">{info.venue.name}</p>
        )}
      </div>
    </div>
  )
}
