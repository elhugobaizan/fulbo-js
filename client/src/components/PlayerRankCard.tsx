import type { Player } from '../types/football'

interface PlayerRankCardProps {
  player: Player
  rank: number
  statValue: number | null
  statLabel: string
  onClick: (player: Player) => void
}

export function PlayerRankCard({ player, rank, statValue, statLabel, onClick }: PlayerRankCardProps) {
  const { player: info, statistics } = player
  const stats = statistics[0]

  return (
    <button
      onClick={() => onClick(player)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors text-left"
    >
      {/* Rank */}
      <span className={`
        text-sm font-bold w-6 text-center flex-shrink-0
        ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-gray-500'}
      `}>
        {rank}
      </span>

      {/* Foto */}
      <img
        src={info.photo}
        alt={info.name}
        className="w-10 h-10 rounded-full object-cover bg-gray-800 flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${info.name}&background=1f2937&color=fff` }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{info.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {stats?.team?.logo && (
            <img src={stats.team.logo} alt={stats.team.name} className="w-4 h-4 object-contain" />
          )}
          <p className="text-xs text-gray-400 truncate">{stats?.team?.name}</p>
        </div>
      </div>

      {/* Stat */}
      <div className="text-right flex-shrink-0">
        <p className="text-xl font-bold text-white">{statValue ?? 0}</p>
        <p className="text-[10px] text-gray-500 uppercase">{statLabel}</p>
      </div>
    </button>
  )
}
