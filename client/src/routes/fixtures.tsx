import { useActiveTournament } from '../hooks/useActiveTournament'
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Calendar, Clock, Wifi, Globe, Database, ChevronLeft, ChevronRight, Check, Lock } from 'lucide-react'
import { useFixturesByRound, useFixturesByDate, useLiveFixtures, useRounds } from '../hooks/useFixtures'
import { useLocalFixtures } from '../hooks/useLocalFixtures'
import { FixtureCard } from '../components/FixtureCard'
import { TeamBadge } from '../components/TeamBadge'
import { LeagueSelector } from '../components/LeagueSelector'
import { RoundSelector } from '../components/RoundSelector'
import { DateSelector } from '../components/DateSelector'
import { CURRENT_SEASON } from '../config/leagues'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MatchEventsPanel } from '../components/MatchEventsPanel'
import { usePlayersByTeam } from '../hooks/useLocalPlayers'
import { apiClient } from '../lib/api'

export const Route = createFileRoute('/fixtures')({
  component: FixturesPage,
})

type DataSource = 'api' | 'local'
type ViewMode = 'round' | 'date' | 'live'

const STORAGE_KEY = 'futbol-ar:admin-token'
const FIXTURES_MATCHDAY_KEY = 'futbol-ar:fixtures-matchday'
const FIXTURES_SOURCE_KEY = 'futbol-ar:fixtures-source'

function formatMatchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Result Modal ─────────────────────────────────────────────────────────────

function ResultModal({ match, onClose }: { match: any; onClose: () => void }) {
  const token = sessionStorage.getItem(STORAGE_KEY) ?? ''
  const [authenticated, setAuthenticated] = useState(!!token)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [homeScore, setHomeScore] = useState(String(match.homeScore ?? ''))
  const [awayScore, setAwayScore] = useState(String(match.awayScore ?? ''))
  const [homePen, setHomePen] = useState(String(match.homePenalties ?? ''))
  const [awayPen, setAwayPen] = useState(String(match.awayPenalties ?? ''))
  const queryClient = useQueryClient()

  const { data: homePlayers = [] } = usePlayersByTeam(match.homeTeam?.id ?? 0)
  const { data: awayPlayers = [] } = usePlayersByTeam(match.awayTeam?.id ?? 0)
  const showPenalties = homeScore !== '' && awayScore !== '' && Number(homeScore) === Number(awayScore)

  const authMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.post('/admin?action=auth', { password })
      return data.data
    },
    onSuccess: (data) => {
      if (data?.authenticated) { sessionStorage.setItem(STORAGE_KEY, password); setAuthenticated(true) }
      else setAuthError('Password incorrecto')
    },
    onError: () => setAuthError('Password incorrecto'),
  })

  const saveMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const t = sessionStorage.getItem(STORAGE_KEY) ?? password
      const { data } = await apiClient.patch('/admin?action=matches', {
        matchId: match.id, homeScore: Number(homeScore), awayScore: Number(awayScore),
        homePenalties: showPenalties && homePen !== '' ? Number(homePen) : null,
        awayPenalties: showPenalties && awayPen !== '' ? Number(awayPen) : null,
        status: 'finished',
      }, { headers: { 'x-admin-token': t } })
      return data.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['local-fixtures'] }); onClose() },
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm pointer-events-auto"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
            <h3 className="font-bold text-white text-sm">Cargar resultado</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 52px)' }}>
            <div className="text-sm text-center space-y-1">
              <p className="text-white font-medium">{match.homeTeam?.name ?? '?'}</p>
              <p className="text-gray-500 text-xs">vs</p>
              <p className="text-white font-medium">{match.awayTeam?.name ?? '?'}</p>
            </div>
            {!authenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400"><Lock size={12} /><span>Password de admin</span></div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && authMutation.mutate()} placeholder="Password"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" autoFocus />
                {authError && <p className="text-red-400 text-xs">{authError}</p>}
                <button onClick={() => authMutation.mutate()} disabled={!password || authMutation.isPending}
                  className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50">Verificar</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white flex-1 text-right truncate">{match.homeTeam?.shortName ?? match.homeTeam?.name}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
                      className="w-14 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" autoFocus />
                    <span className="text-gray-500 font-bold">-</span>
                    <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
                      className="w-14 text-center py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" />
                  </div>
                  <span className="text-sm text-white flex-1 truncate">{match.awayTeam?.shortName ?? match.awayTeam?.name}</span>
                </div>
                {showPenalties && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 flex-1 text-right">Penales</span>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" value={homePen} onChange={e => setHomePen(e.target.value)}
                        className="w-14 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
                      <span className="text-gray-500">-</span>
                      <input type="number" min="0" value={awayPen} onChange={e => setAwayPen(e.target.value)}
                        className="w-14 text-center py-1 rounded-lg bg-gray-800 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
                    </div>
                    <span className="flex-1" />
                  </div>
                )}
                {saveMutation.isError && <p className="text-red-400 text-xs text-center">Error al guardar</p>}
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || homeScore === '' || awayScore === ''}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check size={14} />{saveMutation.isPending ? 'Guardando...' : 'Guardar resultado'}
                </button>
              </div>
            )}
            {match.status === 'finished' && authenticated && (
              <MatchEventsPanel matchId={match.id} homeTeam={match.homeTeam} awayTeam={match.awayTeam} homePlayers={homePlayers} awayPlayers={awayPlayers} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Local fixture card ───────────────────────────────────────────────────────

function LocalFixtureCard({ match }: { match: any }) {
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const isFinished = match.status === 'finished'
  const isPast = match.scheduledAt && new Date(match.scheduledAt) < new Date()
  const homeWon = isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)
  const awayWon = isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)
  const canEdit = isFinished || isPast

  const handleClick = () => {
    if (isFinished) navigate({ to: '/match/$matchId', params: { matchId: String(match.id) } })
    else if (isPast) setEditing(true)
  }

  return (
    <>
      <div onClick={() => canEdit && handleClick()}
        className={`rounded-xl border px-4 py-3 transition-colors ${isFinished ? 'border-gray-800 bg-gray-900/40' : 'border-dashed border-gray-700 bg-gray-900/20'} ${canEdit ? 'cursor-pointer hover:bg-gray-800/40' : ''}`}>
        {match.scheduledAt && (
          <p className="text-[11px] text-gray-500 text-center mb-2 capitalize">{formatMatchDate(match.scheduledAt)}</p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <span className={`text-sm truncate font-medium ${homeWon ? 'text-white' : 'text-gray-300'}`}>{match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?'}</span>
            <TeamBadge name={match.homeTeam?.name ?? '?'} logo={match.homeTeam?.logoUrl} size={22} />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFinished ? (
              <>
                <span className={`text-lg font-bold w-6 text-center ${homeWon ? 'text-white' : 'text-gray-400'}`}>{match.homeScore}</span>
                <span className="text-gray-600">-</span>
                <span className={`text-lg font-bold w-6 text-center ${awayWon ? 'text-white' : 'text-gray-400'}`}>{match.awayScore}</span>
                {match.homePenalties !== null && <span className="text-xs text-yellow-400 ml-1">({match.homePenalties}-{match.awayPenalties} pen.)</span>}
              </>
            ) : (
              <span className="text-sm text-gray-600 px-2">{isPast ? '– vs –' : 'vs'}</span>
            )}
            {isFinished && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${match.eventCount > 0 ? 'bg-emerald-500' : 'bg-gray-600'}`} title={match.eventCount > 0 ? `${match.eventCount} incidencias` : 'Sin incidencias'} />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <TeamBadge name={match.awayTeam?.name ?? '?'} logo={match.awayTeam?.logoUrl} size={22} />
            <span className={`text-sm truncate font-medium ${awayWon ? 'text-white' : 'text-gray-300'}`}>{match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?'}</span>
          </div>
        </div>
      </div>
      {editing && <ResultModal match={match} onClose={() => setEditing(false)} />}
    </>
  )
}



// ─── Page ─────────────────────────────────────────────────────────────────────

function FixturesPage() {
  const [source, setSource] = useState<DataSource>(() =>
    (sessionStorage.getItem(FIXTURES_SOURCE_KEY) as DataSource) ?? 'local'
  )
  const [viewMode, setViewMode] = useState<ViewMode>('round')
  const [leagueId, setLeagueId] = useState(128)
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedMatchday, setSelectedMatchday] = useState<number | undefined>(() => {
    const saved = sessionStorage.getItem(FIXTURES_MATCHDAY_KEY)
    return saved ? Number(saved) : undefined
  })

  const { data: rounds = [] } = useRounds(leagueId, CURRENT_SEASON)
  const [selectedRound, setSelectedRound] = useState('')
  const currentRound = selectedRound || rounds[rounds.length - 1] || ''
  const { data: roundFixtures = [], isLoading: loadingRound } = useFixturesByRound(leagueId, currentRound)
  const { data: dateFixtures = [], isLoading: loadingDate } = useFixturesByDate(leagueId, selectedDate)
  const { data: liveFixtures = [], isLoading: loadingLive } = useLiveFixtures(leagueId)

  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1
  const { data: localData, isLoading: loadingLocal } = useLocalFixtures(tournamentId, selectedMatchday)

  const handleMatchdayChange = (m: number) => {
    setSelectedMatchday(m)
    sessionStorage.setItem(FIXTURES_MATCHDAY_KEY, String(m))
  }

  const handleSourceChange = (s: DataSource) => {
    setSource(s)
    sessionStorage.setItem(FIXTURES_SOURCE_KEY, s)
  }

  const apiFixtures = viewMode === 'round' ? roundFixtures : viewMode === 'date' ? dateFixtures : liveFixtures
  const apiLoading = viewMode === 'round' ? loadingRound : viewMode === 'date' ? loadingDate : loadingLive

  // Current matchday
  const currentMatchday = selectedMatchday ?? localData?.matchday

  // All matchdays available as select options
  const matchdays = localData?.matchdays ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fixtures</h1>
        {source === 'api' && liveFixtures.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {liveFixtures.length} en vivo
          </span>
        )}
      </div>

      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        <button onClick={() => handleSourceChange('local')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'local' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Database size={13} /> API Local
        </button>
        <button onClick={() => handleSourceChange('api')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'api' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Globe size={13} /> API Externa
        </button>
      </div>

      {source === 'local' && (
        <>
          {loadingLocal && <FixturesSkeleton />}
          {!loadingLocal && localData && (
            <>
              {matchdays.length > 0 && currentMatchday && (
                <div className="space-y-2">
                  {/* Matchday selector with arrows + direct picker */}
                  <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
                    <button onClick={() => { const idx = matchdays.indexOf(currentMatchday); if (idx > 0) handleMatchdayChange(matchdays[idx - 1]) }}
                      disabled={matchdays.indexOf(currentMatchday) <= 0}
                      className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2">
                      <span className="text-sm font-medium text-white">Fecha {currentMatchday}</span>
                      <span className="text-sm text-gray-500">({matchdays.indexOf(currentMatchday) + 1}/{matchdays.length})</span>
                    </div>
                    <button onClick={() => { const idx = matchdays.indexOf(currentMatchday); if (idx < matchdays.length - 1) handleMatchdayChange(matchdays[idx + 1]) }}
                      disabled={matchdays.indexOf(currentMatchday) >= matchdays.length - 1}
                      className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Direct matchday picker */}
                  <div className="flex gap-1.5 flex-wrap">
                    {matchdays.map(day => (
                      <button key={day} onClick={() => handleMatchdayChange(day)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${currentMatchday === day ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {localData.matches.length === 0 ? (
                <div className="rounded-xl border border-gray-800 p-10 text-center">
                  <p className="text-gray-400">No hay partidos para esta fecha</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {localData.matches.map((match) => (
                    <LocalFixtureCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {source === 'api' && (
        <>
          <LeagueSelector selected={leagueId} onChange={(id) => { setLeagueId(id); setSelectedRound('') }} />
          <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
            {([
              { mode: 'round' as ViewMode, icon: Calendar, label: 'Por Fecha' },
              { mode: 'date' as ViewMode, icon: Clock, label: 'Por Día' },
              { mode: 'live' as ViewMode, icon: Wifi, label: 'En Vivo' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === mode ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
                {mode === 'live' && liveFixtures.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            ))}
          </div>
          {viewMode === 'round' && rounds.length > 0 && <RoundSelector rounds={rounds} selected={currentRound} onChange={setSelectedRound} />}
          {viewMode === 'date' && <DateSelector selected={selectedDate} onChange={setSelectedDate} />}
          {apiLoading && <FixturesSkeleton />}
          {!apiLoading && apiFixtures.length === 0 && (
            <div className="rounded-xl border border-gray-800 p-10 text-center">
              <p className="text-gray-400">{viewMode === 'live' ? 'No hay partidos en vivo ahora' : 'No hay partidos para mostrar'}</p>
            </div>
          )}
          {!apiLoading && apiFixtures.length > 0 && (
            <div className="space-y-2">
              {apiFixtures.map((fixture) => <FixtureCard key={fixture.fixture.id} fixture={fixture} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FixturesSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 justify-end"><div className="w-20 h-4 bg-gray-800 rounded" /></div>
            <div className="w-12 h-6 bg-gray-700 rounded" />
            <div className="flex-1 flex items-center gap-2"><div className="w-20 h-4 bg-gray-800 rounded" /></div>
          </div>
        </div>
      ))}
    </div>
  )
}
