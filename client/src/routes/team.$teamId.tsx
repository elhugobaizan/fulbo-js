import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Star, Users, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '../lib/api'
import { CURRENT_SEASON } from '../config/leagues'
import { useFavorites } from '../hooks/useFavorites'
import { PlayerModal } from '../components/PlayerModal'
import { TeamBadge } from '../components/TeamBadge'
import { useWikidata } from '../hooks/useWikidata'
import { AddPlayerModal } from '../components/AddPlayerModal'
import { LocalPlayerModal } from '../components/LocalPlayerModal'
import { usePlayersByTeam, useTournamentTeams, useTeamTournaments } from '../hooks/useLocalPlayers'
import { useActiveTournament } from '../hooks/useActiveTournament'
import type { Player } from '../types/football'

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

async function fetchSquad(teamId: number, season: number): Promise<Player[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'players', teamId, season } })
  return data.data ?? []
}

async function fetchLocalTeam(teamId: number): Promise<LocalTeam | null> {
  const { data } = await apiClient.get('/local', { params: { resource: 'team', teamId, tournamentId: 1 } })
  return data.data ?? null
}

// ─── Position labels ──────────────────────────────────────────────────────────

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0, Defender: 1, Midfielder: 2, Attacker: 3,
}
const POSITION_LABELS: Record<string, string> = {
  Goalkeeper: 'Arqueros', Defender: 'Defensores',
  Midfielder: 'Mediocampistas', Attacker: 'Delanteros',
}

// ─── Local team header ────────────────────────────────────────────────────────

function LocalTeamHeader({ team, onToggleFav, isFav }: {
  team: LocalTeam
  onToggleFav: () => void; isFav: boolean
}) {
  const { data: wiki, isLoading: loadingWiki } = useWikidata(team.name)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <TeamBadge name={team.name} logo={team.logoUrl} size={72} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          {team.shortName && team.shortName !== team.name && (
            <p className="text-sm text-gray-500 mt-0.5">{team.shortName}</p>
          )}
          {team.country && <p className="text-xs text-gray-600 mt-0.5">{team.country}</p>}
        </div>
        <button onClick={onToggleFav}
          className="p-2.5 rounded-xl border border-gray-700 hover:border-yellow-400/50 transition-colors flex-shrink-0">
          <Star size={18} className={isFav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* Wikidata info */}
      {loadingWiki && (
        <div className="px-5 pb-4 animate-pulse flex gap-4">
          <div className="w-20 h-3 bg-gray-800 rounded" />
          <div className="w-28 h-3 bg-gray-800 rounded" />
          <div className="w-24 h-3 bg-gray-800 rounded" />
        </div>
      )}
      {wiki && (
        <div className="border-t border-gray-800 px-5 py-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {wiki.founded && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Fundado</span>
              <span className="text-xs font-medium text-gray-300">{wiki.founded}</span>
            </div>
          )}
          {wiki.stadiumName && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Estadio</span>
              <span className="text-xs font-medium text-gray-300">{wiki.stadiumName}</span>
              {wiki.stadiumCapacity && (
                <span className="text-xs text-gray-600">({wiki.stadiumCapacity.toLocaleString()})</span>
              )}
            </div>
          )}
          {wiki.website && (
            <a href={wiki.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#74ACDF] transition-colors">
              <span className="text-xs text-gray-500">Web</span>
              <span className="text-xs font-medium text-gray-300 hover:text-[#74ACDF]">
                {new URL(wiki.website).hostname.replace('www.', '')}
              </span>
            </a>
          )}
          {wiki.wikidataUrl && (
            <a href={wiki.wikidataUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-auto">
              Wikidata →
            </a>
          )}
        </div>
      )}
    </div>
  )
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

  const { data: squad = [], isLoading: loadingSquad } = useQuery({
    queryKey: ['squad', numericId, CURRENT_SEASON],
    queryFn: () => fetchSquad(numericId, CURRENT_SEASON),
    staleTime: 1000 * 60 * 30,
    enabled: !local, // solo para equipos de API externa
  })

  const grouped = squad.reduce<Record<string, Player[]>>((acc, player) => {
    const pos = player.statistics[0]?.games?.position ?? 'Unknown'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(player)
    return acc
  }, {})

  const sortedPositions = Object.keys(grouped).sort(
    (a, b) => (POSITION_ORDER[a] ?? 99) - (POSITION_ORDER[b] ?? 99)
  )

  const handleToggleFavorite = () => {
    if (local && localTeam) {
      toggle({ teamId: numericId, teamName: localTeam.name, teamLogo: localTeam.logoUrl ?? '', leagueId: leagueId ?? 0, leagueName: leagueName ?? '' })
    } else if (teamInfo) {
      toggle({ teamId: numericId, teamName: teamInfo.team.name, teamLogo: teamInfo.team.logo, leagueId: leagueId ?? 0, leagueName: leagueName ?? 'Sin liga' })
    }
  }

  const isLoadingHeader = local ? loadingLocal : loadingInfo

  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: '/standings' })}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        <ArrowLeft size={16} /> Volver a posiciones
      </button>

      {/* Header */}
      {isLoadingHeader ? (
        <TeamHeaderSkeleton />
      ) : local && localTeam ? (
        <LocalTeamHeader
          team={localTeam}
          onToggleFav={handleToggleFavorite} isFav={fav}
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

      {/* Tournaments */}
      {local && teamTournaments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(teamTournaments as any[]).map((t: any) => (
            <div key={t.id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${t.active ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300' : 'border-gray-700 bg-gray-800/50 text-gray-400'}`}>
              {t.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {t.shortName ?? t.name}
              <span className="text-gray-500">· {t.groupName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Local squad */}
      {local && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Plantel ({localPlayers.length})
            </h2>
            <button onClick={() => setShowAddPlayer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors">
              <UserPlus size={14} /> Agregar
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
                  <div className="space-y-4">
                    {positions.map(pos => (
                      <div key={pos}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          {pos} ({grouped[pos].length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {grouped[pos].map((player: any) => (
                            <button key={player.id} onClick={() => setSelectedLocalPlayer(player)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors text-left">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* API Squad */}
      {!local && loadingSquad ? (
        <SquadSkeleton />
      ) : squad.length === 0 ? (
        <NoSquad isLocal={false} />
      ) : (
        <div className="space-y-5">
          {sortedPositions.map((position) => (
            <div key={position}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {POSITION_LABELS[position] ?? position} ({grouped[position].length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {grouped[position].map((player) => (
                  <button key={player.player.id} onClick={() => setSelectedPlayer(player)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors text-left">
                    <img src={player.player.photo} alt={player.player.name}
                      className="w-10 h-10 rounded-full object-cover bg-gray-800 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${player.player.name}&background=1f2937&color=fff` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{player.player.name}</p>
                      <p className="text-xs text-gray-400">{player.player.nationality} · {player.player.age} años</p>
                    </div>
                    {player.statistics[0]?.games?.rating && (
                      <span className="text-sm font-bold text-gray-300 flex-shrink-0">
                        {parseFloat(player.statistics[0].games.rating).toFixed(1)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
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

function SquadSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800">
          <div className="w-10 h-10 bg-gray-800 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="w-32 h-4 bg-gray-800 rounded" />
            <div className="w-24 h-3 bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
