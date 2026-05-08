import { usePlayerStats } from '../hooks/useLocalPlayers'

export function PlayerRow({ player, tournamentId, setSelectedLocalPlayer }: {
  player: any
  tournamentId: number
  setSelectedLocalPlayer: (player: any) => void
}) {
  const { data: stats } = usePlayerStats(player.id, tournamentId)

  if (!stats) return null

  return player && (
    <button
      key={player.id}
      onClick={() => setSelectedLocalPlayer(player)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-4 py-2.5 text-left transition-all duration-150 hover:border-white/[0.08] hover:bg-white/[0.045]"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.045] transition-colors group-hover:bg-white/[0.07]">
        <span className="text-xs font-bold text-slate-400 group-hover:text-slate-300">
          {player.firstName[0]}
          {player.lastName[0]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">
          {player.firstName} {player.lastName}
        </p>

        {(stats.goals > 0 ||
          stats.assists > 0 ||
          stats.yellowCards > 0 ||
          stats.redCards > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {stats.goals > 0 && (
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                  ⚽ {stats.goals}
                </span>
              )}

              {stats.assists > 0 && (
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                  🅰 {stats.assists}
                </span>
              )}

              {stats.yellowCards > 0 && (
                <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[11px] font-medium text-yellow-300">
                  🟨 {stats.yellowCards}
                </span>
              )}
            </div>
          )}
      </div>
    </button>
  )
}