import { useActiveTournament } from '../hooks/useActiveTournament'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RefreshCw, Star } from 'lucide-react'
import { useLocalStandings } from '../hooks/useLocalStandings'
import { useFavorites } from '../hooks/useFavorites'
import { TeamBadge } from '../components/TeamBadge'

export const Route = createFileRoute('/standings')({
  component: StandingsPage,
})

function StandingsPage() {
  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1
  const localQuery = useLocalStandings(tournamentId)
  const qualifiersPerGroup = localQuery.data?.tournament?.qualifiersPerGroup ?? activeTournament?.qualifiersPerGroup ?? 8
  const wildcardQualifiers = (localQuery.data?.tournament as any)?.wildcardQualifiers ?? 0
  const tournamentTeamType = (localQuery.data?.tournament as any)?.teamType ?? 'club'
  const tournamentName = localQuery.data?.tournament?.name ?? activeTournament?.name ?? ''
  console.log('tournamentTeamType:', tournamentTeamType, 'raw:', localQuery.data?.tournament)

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Posiciones
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-400">
            {localQuery.data?.tournament?.name ?? activeTournament?.name ?? 'Cargando torneo...'}
          </p>
        </div>

        <button
          onClick={() => localQuery.refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-400 transition-all duration-150 hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white"
        >
          <RefreshCw size={17} strokeWidth={1.8} />
        </button>
      </div>

      {localQuery.isLoading && <StandingsSkeleton />}

      {localQuery.isError && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6 text-center">
          <p className="text-red-400 font-medium">No se pudo cargar la tabla</p>
          <button onClick={() => localQuery.refetch()}
            className="mt-3 px-4 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-800 text-red-200 text-sm transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {!localQuery.isLoading && !localQuery.isError && localQuery.data && (
        <div className="space-y-6">
          {localQuery.data.groups.map((groupData) => (
            <div key={groupData.group.id}>
              <h2 className="text-base font-bold tracking-tight text-white">{groupData.group.name}</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {groupData.standings.length} equipos
              </p>
              <LocalStandingsTable
                standings={groupData.standings}
                qualifiersPerGroup={qualifiersPerGroup}
                wildcardQualifiers={wildcardQualifiers}
                tournamentName={tournamentName}
                tournamentId={tournamentId}
                allGroupsStandings={localQuery.data.groups.map(g => g.standings)}
                teamType={tournamentTeamType}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs text-gray-400">Clasifican directo ({qualifiersPerGroup} por grupo)</span>
            </div>
            {wildcardQualifiers > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">Mejores terceros ({wildcardQualifiers} en total)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Local standings table ────────────────────────────────────────────────────

function LocalStandingsTable({ standings, qualifiersPerGroup, wildcardQualifiers = 0, tournamentName, tournamentId, allGroupsStandings = [], teamType = 'club' }: {
  standings: any[]
  qualifiersPerGroup: number
  wildcardQualifiers?: number
  tournamentName: string
  tournamentId: number
  allGroupsStandings?: any[][]
  teamType?: string
}) {
  // Compute wildcard threshold: rank of best N thirds across all groups
  const wildcardPos = qualifiersPerGroup + 1
  const allThirds = allGroupsStandings
    .map(g => g.find((r: any) => Number(r.rank) === wildcardPos))
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points
      const da = a.goalsDiff ?? (a.all.goals.for - a.all.goals.against)
      const db2 = b.goalsDiff ?? (b.all.goals.for - b.all.goals.against)
      if (db2 !== da) return db2 - da
      return b.all.goals.for - a.all.goals.for
    })
  const wildcardTeamIds = new Set(allThirds.slice(0, wildcardQualifiers).map((r: any) => r.team.id))
  const navigate = useNavigate()
  const { toggle, isFavorite } = useFavorites()

  if (standings.length === 0) return (
    <div className="rounded-xl border border-gray-800 p-6 text-center">
      <p className="text-gray-400 text-sm">Sin partidos cargados todavía</p>
    </div>
  )

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
            <th className="text-left pl-4 pr-2 py-3 w-8">#</th>
            <th className="text-left px-2 py-3">Equipo</th>
            <th className="text-center px-2 py-3 w-10">PJ</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">G</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">E</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">P</th>
            <th className="text-center px-2 py-3 w-10 hidden md:table-cell">GF</th>
            <th className="text-center px-2 py-3 w-10 hidden md:table-cell">GC</th>
            <th className="text-center px-2 py-3 w-10">DG</th>
            <th className="text-center px-2 py-3 w-12 font-bold text-white">PTS</th>
            <th className="w-10 pr-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {standings.map((s: any) => {
            const qualifies = Number(s.rank) <= Number(qualifiersPerGroup)
            const isWildcard = !qualifies && wildcardQualifiers > 0 && wildcardTeamIds.has(s.team.id)
            const fav = isFavorite(s.team.id)
            return (
              <tr key={s.team.id}
                onClick={() => navigate({ to: '/team/$teamId', params: { teamId: String(s.team.id) }, search: { leagueId: tournamentId, leagueName: tournamentName, ...(teamType === 'national' ? { teamType: 'national' } : {}) } })}
                style={{ borderLeft: qualifies ? '2px solid rgb(16 185 129)' : isWildcard ? '2px solid rgb(234 179 8)' : '2px solid transparent' }}
                className={[
                  'group border-b border-white/[0.04] transition-colors hover:bg-white/[0.025]',
                  qualifies ? 'bg-emerald-400/[0.018]' : isWildcard ? 'bg-yellow-400/[0.018]' : '',
                ].join(' ')}>
                <td className="pl-4 pr-2 py-3">
                  <span className={`text-sm font-bold ${qualifies ? 'text-emerald-400' : isWildcard ? 'text-yellow-400' : 'text-gray-400'}`}>{s.rank}</span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <TeamBadge name={s.team.name} logo={s.team.logo} size={22} />
                    <span className="font-medium text-white truncate">{s.team.name}</span>
                  </div>
                </td>
                <td className="text-center px-2 py-3 text-gray-300">{s.all.played}</td>
                <td className="text-center px-2 py-3 text-emerald-400 hidden sm:table-cell">{s.all.win}</td>
                <td className="text-center px-2 py-3 text-yellow-400 hidden sm:table-cell">{s.all.draw}</td>
                <td className="text-center px-2 py-3 text-red-400 hidden sm:table-cell">{s.all.lose}</td>
                <td className="text-center px-2 py-3 text-gray-300 hidden md:table-cell">{s.all.goals.for}</td>
                <td className="text-center px-2 py-3 text-gray-300 hidden md:table-cell">{s.all.goals.against}</td>
                <td className="text-center px-2 py-3 text-gray-300">
                  {s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff}
                </td>
                <td className="text-center px-2 py-3">
                  <span className="font-bold text-white text-base">{s.points}</span>
                </td>
                <td className="pr-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggle({ teamId: s.team.id, teamName: s.team.name, teamLogo: s.team.logo ?? '', leagueId: tournamentId, leagueName: tournamentName })}
                    className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-white/[0.04] hover:text-yellow-300"
                  >
                    <Star
                      size={17}
                      className={
                        fav
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-600'
                      }
                    />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StandingsSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden animate-pulse">
      <div className="bg-gray-900 h-10" />
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-gray-800/60">
          <div className="w-6 h-4 bg-gray-800 rounded" />
          <div className="flex-1 h-4 bg-gray-800 rounded" />
          <div className="w-8 h-4 bg-gray-800 rounded" />
          <div className="w-10 h-5 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  )
}