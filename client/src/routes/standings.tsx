import { useActiveTournament } from '../hooks/useActiveTournament'
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RefreshCw, Globe, Database, Star } from 'lucide-react'
import { useStandings } from '../hooks/useStandings'
import { useLocalStandings } from '../hooks/useLocalStandings'
import { StandingsTable } from '../components/StandingsTable'
import { CURRENT_SEASON } from '../config/leagues'
import { LeagueSelector } from '../components/LeagueSelector'
import { useFavorites } from '../hooks/useFavorites'
import { TeamBadge } from '../components/TeamBadge'

export const Route = createFileRoute('/standings')({
  component: StandingsPage,
})

type DataSource = 'api' | 'local'

function StandingsPage() {
  const [source, setSource] = useState<DataSource>('local')
  const [leagueId, setLeagueId] = useState(128)
  const [season] = useState(CURRENT_SEASON)

  const apiQuery = useStandings({ leagueId, season })
  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1
  const localQuery = useLocalStandings(tournamentId)

  const isLoading = source === 'api' ? apiQuery.isLoading : localQuery.isLoading
  const isError = source === 'api' ? apiQuery.isError : localQuery.isError
  const isFetching = source === 'api' ? apiQuery.isFetching : localQuery.isFetching
  const refetch = source === 'api' ? apiQuery.refetch : localQuery.refetch

  const qualifiersPerGroup = localQuery.data?.tournament?.qualifiersPerGroup ?? activeTournament?.qualifiersPerGroup ?? 8
  const tournamentName = localQuery.data?.tournament?.name ?? activeTournament?.name ?? ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tabla de Posiciones</h1>
          {source === 'api' && apiQuery.data?.league && (
            <p className="text-sm text-gray-400 mt-0.5">
              {apiQuery.data.league.name} · Temporada {apiQuery.data.league.season}
            </p>
          )}
          {source === 'local' && localQuery.data?.tournament && (
            <p className="text-sm text-gray-400 mt-0.5">{localQuery.data.tournament.name}</p>
          )}
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        <button onClick={() => setSource('local')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'local' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Database size={13} /> API Local
        </button>
        <button onClick={() => setSource('api')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'api' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Globe size={13} /> API Externa
        </button>
      </div>

      {source === 'api' && (
        <LeagueSelector selected={leagueId} onChange={setLeagueId} />
      )}

      {isLoading && <StandingsSkeleton />}

      {isError && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6 text-center">
          <p className="text-red-400 font-medium">No se pudo cargar la tabla</p>
          <button onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-lg bg-red-800/50 hover:bg-red-800 text-red-200 text-sm transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {source === 'api' && !isLoading && !isError && (
        <>
          <StandingsTable
            standings={apiQuery.data?.league?.standings?.[0] ?? []}
            leagueId={leagueId}
            leagueName={apiQuery.data?.league?.name ?? ''}
          />
          <Legend />
        </>
      )}

      {source === 'local' && !isLoading && !isError && localQuery.data && (
        <div className="space-y-6">
          {localQuery.data.groups.map((groupData) => (
            <div key={groupData.group.id} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-300">{groupData.group.name}</h2>
              <LocalStandingsTable
                standings={groupData.standings}
                qualifiersPerGroup={qualifiersPerGroup}
                tournamentName={tournamentName}
                tournamentId={tournamentId}
              />
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs text-gray-400">Clasifican a octavos ({qualifiersPerGroup} por grupo)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Local standings table ────────────────────────────────────────────────────

function LocalStandingsTable({ standings, qualifiersPerGroup, tournamentName, tournamentId }: {
  standings: any[]
  qualifiersPerGroup: number
  tournamentName: string
  tournamentId: number
}) {
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
          {standings.map((s: any, index: number) => {
            const qualifies = Number(s.rank) <= Number(qualifiersPerGroup)
            const isLast = s.rank === qualifiersPerGroup
            const fav = isFavorite(s.team.id)
            return (
              <tr key={s.team.id}
                onClick={() => navigate({ to: '/team/$teamId', params: { teamId: String(s.team.id) }, search: { leagueId: tournamentId, leagueName: tournamentName } })}
                style={{ borderLeft: qualifies ? '2px solid rgb(16 185 129)' : '2px solid transparent' }}
                className={`cursor-pointer hover:bg-gray-800/50 transition-colors ${index % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'} ${isLast ? 'border-b border-b-emerald-500/40' : ''}`}>
                <td className="pl-4 pr-2 py-3">
                  <span className={`text-sm font-bold ${qualifies ? 'text-emerald-400' : 'text-gray-400'}`}>{s.rank}</span>
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
                    disabled={!tournamentName}
                    onClick={() => toggle({ teamId: s.team.id, teamName: s.team.name, teamLogo: s.team.logo ?? '', leagueId: tournamentId, leagueName: tournamentName })}
                    className="p-1 rounded-md transition-colors hover:bg-gray-700 disabled:opacity-30"
                  >
                    <Star size={15} className={fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
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

function Legend() {
  const items = [
    { color: 'bg-yellow-400', label: 'Campeón' },
    { color: 'bg-emerald-500', label: 'Copa Libertadores' },
    { color: 'bg-blue-400', label: 'Copa Sudamericana' },
    { color: 'bg-red-500', label: 'Descenso' },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  )
}