import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Star, Users, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '../lib/api'
import { useFavorites } from '../hooks/useFavorites'
import { PlayerModal } from '../components/PlayerModal'
import { TeamBadge } from '../components/TeamBadge'
import { TeamHeader } from '../components/TeamHeader'
import { AddPlayerModal } from '../components/AddPlayerModal'
import { LocalPlayerModal } from '../components/LocalPlayerModal'
import { usePlayersByTeam, useTournamentTeams, useTeamTournaments } from '../hooks/useLocalPlayers'
import { useActiveTournament } from '../hooks/useActiveTournament'
import { useTeamFixtures } from '../hooks/useTeamFixtures'
import type { Player } from '../types/football'
import { PlayerRow } from '../components/PlayerRow'

const searchSchema = z.object({
  leagueId: z.number().optional(),
  leagueName: z.string().optional(),
})

export const Route = createFileRoute('/team/$teamId')({
  validateSearch: searchSchema,
  component: TeamPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOCAL_LEAGUE_THRESHOLD = 100 // IDs de torneo local son bajos

function isLocalTeam(leagueId?: number) {
  return leagueId !== undefined && leagueId <= LOCAL_LEAGUE_THRESHOLD
}

interface TeamInfo {
  team: { id: number; name: string; logo: string; country: string; founded: number }
  venue: { name: string; city: string; capacity: number }
}

interface LocalTeam {
  id: number; name: string; shortName: string | null; logoUrl: string | null; country: string | null
}

async function fetchTeamInfo(teamId: number): Promise<TeamInfo | null> {
  const { data } = await apiClient.get('/football', { params: { resource: 'team-info', teamId } })
  return data.data?.[0] ?? null
}

async function fetchLocalTeam(teamId: number): Promise<LocalTeam | null> {
  const { data } = await apiClient.get('/local', { params: { resource: 'team', teamId, tournamentId: 1 } })
  return data.data ?? null
}

// ─── No squad message ─────────────────────────────────────────────────────────

function NoSquad({ isLocal }: { isLocal: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 p-10 text-center space-y-2">
      <Users size={28} className="text-gray-700 mx-auto" />
      <p className="text-gray-400 text-sm">
        {isLocal
          ? 'No hay jugadores cargados para este equipo todavía.'
          : 'No hay plantel disponible para esta temporada'}
      </p>
    </div>
  )
}

function TeamTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: 'fixtures' | 'squad'
  setActiveTab: (tab: 'fixtures' | 'squad') => void
}) {
  const tabs = [
    { id: 'fixtures' as const, label: 'Partidos' },
    { id: 'squad' as const, label: 'Plantel' },
  ]

  return (
    <div className="mt-6 flex items-center">
      <div className="inline-flex rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150',
                active
                  ? 'bg-white/[0.06] text-white shadow-[0_0_24px_rgba(255,255,255,0.04)]'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MatchRow({ match }: { match: any }) {
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: String(match.id) }}
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 transition-all duration-150 hover:border-[#74ACDF]/20 hover:bg-white/[0.055] hover:shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#74ACDF]/20 bg-[#74ACDF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#dbeeff]">
            {match.tournament?.shortName || match.tournamentName}
          </span>

          {match.groupName && (
            <span className="text-xs font-medium text-slate-500">
              {match.groupName}
            </span>
          )}
        </div>

        <span className="text-xs font-medium text-slate-500">
          {match.dateLabel}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <TeamBadge
            name={match.homeTeam.name}
            logo={match.homeTeam.logoUrl}
            size={34}
          />
          <span className="truncate text-sm font-semibold text-slate-200">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>

        <div className="min-w-[72px] rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-center">
          {match.status === 'finished' ? (
            <span className="text-xl font-bold tracking-tight text-white">
              {match.homeScore} - {match.awayScore}
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-400">
              vs
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 min-w-0">
          <span className="truncate text-right text-sm font-semibold text-slate-200">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          <TeamBadge
            name={match.awayTeam.name}
            logo={match.awayTeam.logoUrl}
            size={34}
          />
        </div>
      </div>
    </Link>
  )
}

// ─── Team Page ────────────────────────────────────────────────────────────────

function TeamPage() {
  const { teamId } = Route.useParams()
  const { leagueId, leagueName } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const { isFavorite, toggle } = useFavorites()

  const numericId = Number(teamId)
  const local = isLocalTeam(leagueId)
  const fav = isFavorite(numericId)

  // API externa
  const { data: teamInfo, isLoading: loadingInfo } = useQuery({
    queryKey: ['team-info', numericId],
    queryFn: () => fetchTeamInfo(numericId),
    staleTime: 1000 * 60 * 60,
    enabled: !local,
  })

  // Torneo local
  const { data: localTeam, isLoading: loadingLocal } = useQuery({
    queryKey: ['local-team', numericId],
    queryFn: () => fetchLocalTeam(numericId),
    staleTime: 1000 * 60 * 60,
    enabled: local,
  })

  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? leagueId ?? 1
  const { data: localPlayers = [] } = usePlayersByTeam(local ? numericId : 0)
  const { data: tournamentTeams = [] } = useTournamentTeams(local ? tournamentId : 0)
  const { data: teamTournaments = [] } = useTeamTournaments(local ? numericId : 0)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [selectedLocalPlayer, setSelectedLocalPlayer] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'squad' | 'fixtures'>('fixtures')
  const { data: teamFixtures = [] } = useTeamFixtures(numericId, 20, true)

  const handleToggleFavorite = () => {
    if (local && localTeam) {
      toggle({ teamId: numericId, teamName: localTeam.name, teamLogo: localTeam.logoUrl ?? '', leagueId: leagueId ?? 0, leagueName: leagueName ?? '' })
    } else if (teamInfo) {
      toggle({ teamId: numericId, teamName: teamInfo.team.name, teamLogo: teamInfo.team.logo, leagueId: leagueId ?? 0, leagueName: leagueName ?? 'Sin liga' })
    }
  }


  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: '/standings' })}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        <ArrowLeft size={16} /> Volver a posiciones
      </button>

      {/* Header */}
      {(local ? loadingLocal : loadingInfo) ? (
        <TeamHeaderSkeleton />
      ) : local && localTeam ? (
        <TeamHeader
          team={localTeam}
          onToggleFav={handleToggleFavorite} isFav={fav}
          tournaments={teamTournaments}
        />
      ) : !local && teamInfo ? (
        <div className="flex items-center gap-4 p-5 rounded-xl border border-gray-800 bg-gray-900/40">
          <img src={teamInfo.team.logo} alt={teamInfo.team.name} className="w-20 h-20 object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{teamInfo.team.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-400">
              {teamInfo.team.founded && <span>Fundado: {teamInfo.team.founded}</span>}
              {teamInfo.venue?.name && <span>🏟 {teamInfo.venue.name}</span>}
              {teamInfo.venue?.capacity && <span>{teamInfo.venue.capacity.toLocaleString()} cap.</span>}
            </div>
            {leagueName && <p className="text-xs text-[#74ACDF] mt-1">{leagueName}</p>}
          </div>
          <button onClick={handleToggleFavorite}
            className="p-2.5 rounded-xl border border-gray-700 hover:border-yellow-400/50 transition-colors flex-shrink-0">
            <Star size={18} className={fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'} />
          </button>
        </div>
      ) : null}

      {/* Tab toggle - only for local teams */}
      <TeamTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Local squad */}
      {local && activeTab === 'squad' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
              Plantel <span className="text-slate-600">({localPlayers.length})</span>
            </h2>

            <button
              onClick={() => setShowAddPlayer(true)}
              className="
      flex items-center gap-1.5
      rounded-xl
      border border-white/[0.06]
      bg-white/[0.03]
      px-3 py-1.5
      text-sm font-medium
      text-slate-400
      transition-all duration-150
      hover:border-white/[0.1]
      hover:bg-white/[0.05]
      hover:text-white
    "
            >
              <UserPlus size={14} strokeWidth={1.9} />
              Agregar
            </button>
          </div>
          {localPlayers.length === 0
            ? <NoSquad isLocal={true} />
            : (() => {
              const POSITION_ORDER = ['Arquero', 'Defensor', 'Volante', 'Delantero']
              const grouped = localPlayers.reduce((acc: any, p: any) => {
                const pos = p.position ?? 'Sin posición'
                if (!acc[pos]) acc[pos] = []
                acc[pos].push(p)
                return acc
              }, {})
              const positions = Object.keys(grouped).sort((a, b) => {
                const ai = POSITION_ORDER.indexOf(a), bi = POSITION_ORDER.indexOf(b)
                if (ai === -1 && bi === -1) return a.localeCompare(b)
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })
              return (
                <div className="space-y-5">
                  {positions.map((pos) => (
                    <section key={pos}>
                      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {pos} <span className="text-slate-600">({grouped[pos].length})</span>
                      </h3>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {grouped[pos].map((player: any) => (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            tournamentId={tournamentId}
                            setSelectedLocalPlayer={setSelectedLocalPlayer}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                /*                 <div className="space-y-4">
                                  {positions.map(pos => (
                                    <div key={pos}>
                                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        {pos} ({grouped[pos].length})
                                      </h3>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {grouped[pos].map((player: any) => (
                                          <button key={player.id} onClick={() => setSelectedLocalPlayer(player)} 
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                              <span className="text-sm font-bold text-gray-300">
                                                {player.firstName[0]}{player.lastName[0]}
                                              </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-white truncate">{player.firstName} {player.lastName}</p>
                                              <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                                                {player.goals > 0 && <span>{player.goals} gol{player.goals !== 1 ? 'es' : ''}</span>}
                                                {player.assists > 0 && <span>{player.assists} asist.</span>}
                                                {player.yellowCards > 0 && <span>{player.yellowCards} 🟨</span>}
                                                {player.redCards > 0 && <span>{player.redCards} 🟥</span>}
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div> */
              )
            })()
          }
          {showAddPlayer && (
            <AddPlayerModal
              tournamentId={tournamentId}
              teams={tournamentTeams.length > 0 ? tournamentTeams : (localTeam ? [localTeam] : [])}
              defaultTeamId={numericId}
              onClose={() => setShowAddPlayer(false)}
            />
          )}
          {selectedLocalPlayer && (
            <LocalPlayerModal
              player={selectedLocalPlayer}
              tournamentId={tournamentId}
              onClose={() => setSelectedLocalPlayer(null)}
            />
          )}
        </div>
      )}

      {/* Local fixtures tab */}
      {local && activeTab === 'fixtures' && (
        <div className="space-y-2">
          {teamFixtures.length === 0 ? (
            <div className="rounded-xl border border-gray-800 p-8 text-center">
              <p className="text-gray-400 text-sm">No hay partidos registrados</p>
            </div>
          ) : (
            teamFixtures.map((match: any) => {
              const isFinished = match.status === 'finished'
              const homeWon = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)
              const awayWon = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)
              const phase = match.knockoutRound
                ? ({ round_of_16: 'Octavos', quarterfinal: 'Cuartos', semifinal: 'Semifinal', final: 'Final' } as Record<string, string>)[match.knockoutRound] ?? match.knockoutRound
                : match.matchday ? `Fecha ${match.matchday}` : null

              return (<MatchRow key={match.id} match={match} />)

              return (
                <button key={match.id}
                  onClick={() => isFinished && navigate({ to: '/match/$matchId', params: { matchId: String(match.id) } })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${isFinished ? 'border-gray-800 bg-gray-900/40 hover:bg-gray-900/70 cursor-pointer' : 'border-dashed border-gray-700 bg-gray-900/20 cursor-default'}`}>
                  {/* Left: badges + score */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <TeamBadge name={match.homeTeam?.name ?? '?'} logo={match.homeTeam?.logoUrl} size={20} />
                      <span className="text-[9px] text-gray-500 truncate max-w-[36px]">{match.homeTeam?.shortName ?? match.homeTeam?.name?.split(' ')[0] ?? '?'}</span>
                    </div>
                    <span className={`text-sm font-bold w-4 text-center ${homeWon ? 'text-white' : 'text-gray-500'}`}>
                      {isFinished ? match.homeScore : '–'}
                    </span>
                    <span className="text-gray-600 text-xs">-</span>
                    <span className={`text-sm font-bold w-4 text-center ${awayWon ? 'text-white' : 'text-gray-500'}`}>
                      {isFinished ? match.awayScore : '–'}
                    </span>
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <TeamBadge name={match.awayTeam?.name ?? '?'} logo={match.awayTeam?.logoUrl} size={20} />
                      <span className="text-[9px] text-gray-500 truncate max-w-[36px]">{match.awayTeam?.shortName ?? match.awayTeam?.name?.split(' ')[0] ?? '?'}</span>
                    </div>
                  </div>
                  {/* Right: date + tournament + phase */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {match.scheduledAt
                        ? (() => { const [y, m, d] = match.scheduledAt.split('T')[0].split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) })()
                        : 'TBD'}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {match.tournament?.shortName ?? match.tournament?.name ?? ''}
                      {phase ? ` · ${phase}` : ''}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}


      <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}

function TeamHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 p-5 rounded-xl border border-gray-800 animate-pulse">
      <div className="w-20 h-20 bg-gray-800 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-48 h-6 bg-gray-800 rounded" />
        <div className="w-64 h-4 bg-gray-700 rounded" />
      </div>
    </div>
  )
}