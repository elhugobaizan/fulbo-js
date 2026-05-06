import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, X, Users, Download } from 'lucide-react'
import { apiClient } from '../lib/api'
import { TeamBadge } from '../components/TeamBadge'
import { MatchEventsPanel } from '../components/MatchEventsPanel'
import { LineupPanel } from '../components/LineupPanel'
import { ESPNImportModal } from '../components/ESPNImportModal'
import { usePlayersByTeam } from '../hooks/useLocalPlayers'

export const Route = createFileRoute('/match/$matchId')({
  component: MatchPage,
})

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  save: '🧤',
  assist: '🅰️',
  yellow: '🟨',
  red: '🟥',
  sub: '🔄',
}

async function fetchMatchDetail(matchId: number) {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'match-detail', matchId, tournamentId: 1 },
  })
  return data.data
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function MatchPage() {
  const { matchId } = Route.useParams()
  const navigate = useNavigate()
  const { data: match, isLoading } = useQuery({
    queryKey: ['match-detail', Number(matchId)],
    queryFn: () => fetchMatchDetail(Number(matchId)),
    staleTime: 1000 * 60 * 2,
  })

  const [showPanel, setShowPanel] = useState(false)
  const [showLineup, setShowLineup] = useState(false)
  const [showESPN, setShowESPN] = useState(false)
  const homeTeamId = match?.homeTeamId ?? 0
  const awayTeamId = match?.awayTeamId ?? 0
  const { data: homePlayers = [] } = usePlayersByTeam(homeTeamId)
  const { data: awayPlayers = [] } = usePlayersByTeam(awayTeamId)

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 bg-gray-800 rounded" />
      <div className="h-32 bg-gray-800 rounded-xl" />
    </div>
  )

  if (!match) return (
    <div className="rounded-xl border border-gray-800 p-10 text-center">
      <p className="text-gray-400">Partido no encontrado</p>
    </div>
  )

  const isFinished = match.status === 'finished'
  const homeEvents = (match.events ?? []).filter((e: any) => e.teamId === match.homeTeamId)
  const awayEvents = (match.events ?? []).filter((e: any) => e.teamId === match.awayTeamId)
  const allEvents = [...(match.events ?? [])].sort((a: any, b: any) => (a.minute ?? 999) - (b.minute ?? 999))

  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: '/fixtures' })}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        <ArrowLeft size={16} /> Volver a fixtures
      </button>

      {/* Match header */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
        {match.scheduledAt && (
          <p className="text-xs text-gray-500 text-center mb-4 capitalize">
            {formatDate(match.scheduledAt)}
            {match.matchday && <span className="ml-2 text-gray-600">· Fecha {match.matchday}</span>}
          </p>
        )}
        <div className="flex items-center gap-4">
          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <Link to="/team/$teamId" params={{ teamId: String(match.homeTeamId) }} search={{ leagueId: match.tournamentId, leagueName: '' }}
              className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
              <TeamBadge name={match.homeTeam?.name ?? '?'} logo={match.homeTeam?.logoUrl} size={52} />
              <p className="text-sm font-semibold text-white text-center">{match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?'}</p>
            </Link>
            <div className="flex flex-wrap justify-center gap-1 min-h-4">
              {homeEvents.filter((e: any) => e.type === 'goal').map((e: any, i: number) => (
                <span key={i} className="text-xs text-gray-400">
                  {e.player ? `${e.player.lastName}${e.isPenalty ? ' (p)' : ''}${e.isOwnGoal ? ' (e/c)' : ''}${e.minute ? ` ${e.minute}'` : ''}` : `⚽${e.minute ? ` ${e.minute}'` : ''}`}
                  {i < homeEvents.filter((e: any) => e.type === 'goal').length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center flex-shrink-0">
            {isFinished ? (
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black text-white">{match.homeScore ?? 0}</span>
                <span className="text-2xl text-gray-600">-</span>
                <span className="text-5xl font-black text-white">{match.awayScore ?? 0}</span>
              </div>
            ) : (
              <span className="text-2xl text-gray-600 font-bold">vs</span>
            )}
            {match.homePenalties !== null && (
              <p className="text-xs text-yellow-400 mt-1">
                ({match.homePenalties} - {match.awayPenalties} pen.)
              </p>
            )}
            <span className={`text-xs mt-2 px-2 py-0.5 rounded-full ${isFinished ? 'bg-gray-800 text-gray-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
              {isFinished ? 'Final' : 'Pendiente'}
            </span>
          </div>

          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <Link to="/team/$teamId" params={{ teamId: String(match.awayTeamId) }} search={{ leagueId: match.tournamentId, leagueName: '' }}
              className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
              <TeamBadge name={match.awayTeam?.name ?? '?'} logo={match.awayTeam?.logoUrl} size={52} />
              <p className="text-sm font-semibold text-white text-center">{match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?'}</p>
            </Link>
            <div className="flex flex-wrap justify-center gap-1 min-h-4">
              {awayEvents.filter((e: any) => e.type === 'goal').map((e: any, i: number) => (
                <span key={i} className="text-xs text-gray-400">
                  {e.player ? `${e.player.lastName}${e.minute ? ` ${e.minute}'` : ''}` : `⚽${e.minute ? ` ${e.minute}'` : ''}`}
                  {i < awayEvents.filter((e: any) => e.type === 'goal').length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {allEvents.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Incidencias</h2>
          <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800/60">
            {allEvents.map((event: any) => {
              const isHome = event.teamId === match.homeTeamId
              const team = isHome ? match.homeTeam : match.awayTeam
              return (
                <div key={event.id} className={`flex items-center gap-3 px-4 py-2.5 ${isHome ? '' : 'flex-row-reverse'}`}>
                  <span className="text-xs text-gray-600 w-8 text-center flex-shrink-0">
                    {event.minute ? `${event.minute}'` : '–'}
                  </span>
                  <span className="text-base">{EVENT_ICONS[event.type] ?? '•'}</span>
                  <div className={`flex-1 ${isHome ? '' : 'text-right'}`}>
                    <p className="text-sm text-white">
                      {event.player
                        ? `${event.player.firstName} ${event.player.lastName}`
                        : team?.shortName ?? team?.name ?? '?'}
                    </p>
                    {(event.isPenalty || event.isOwnGoal) && (
                      <p className="text-xs text-gray-500">
                        {event.isPenalty && 'Penal'}
                        {event.isOwnGoal && 'En contra'}
                      </p>
                    )}
                  </div>
                  <TeamBadge name={team?.name ?? '?'} logo={team?.logoUrl} size={20} className="flex-shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isFinished && allEvents.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-4">Sin incidencias cargadas</p>
      )}

      {location.hostname === 'localhost' && match && (
        <div className="fixed bottom-20 right-3 z-40 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 font-mono text-[15px] text-fuchsia-700 shadow-xl space-y-0.5 select-all">
          <p><span className="text-emerald-600">match:</span> {match.id}</p>
          <p><span className="text-emerald-600">home:</span> {match.homeTeamId}</p>
          <p><span className="text-emerald-600">away:</span> {match.awayTeamId}</p>
        </div>
      )}

      {isFinished && (
        <div className="flex gap-2">
          <button onClick={() => setShowPanel(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-gray-900/40 hover:bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors">
            <Pencil size={14} /> Incidencias
          </button>
          <button onClick={() => setShowLineup(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-gray-900/40 hover:bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors">
            <Users size={14} /> Alineación
          </button>
          <button onClick={() => setShowESPN(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-gray-900/40 hover:bg-gray-800 text-gray-400 hover:text-white text-sm transition-colors">
            <Download size={14} /> ESPN
          </button>
        </div>
      )}

      {showESPN && (
        <ESPNImportModal
          matchId={match.id}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          tournamentId={match.tournamentId}
          onClose={() => setShowESPN(false)}
        />
      )}

      {showLineup && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowLineup(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm pointer-events-auto"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
                <span className="font-semibold text-white text-sm">Alineación</span>
                <button onClick={() => setShowLineup(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
                <LineupPanel
                  matchId={match.id}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  homePlayers={homePlayers}
                  awayPlayers={awayPlayers}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {showPanel && isFinished && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowPanel(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm pointer-events-auto"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
                <span className="font-semibold text-white text-sm">Incidencias</span>
                <button onClick={() => setShowPanel(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
                <MatchEventsPanel
                  matchId={match.id}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  homePlayers={homePlayers}
                  awayPlayers={awayPlayers}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}