import { useActiveTournament } from '../hooks/useActiveTournament'
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Check, Lock } from 'lucide-react'
import { useLocalFixtures } from '../hooks/useLocalFixtures'
import { TeamBadge } from '../components/TeamBadge'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MatchEventsPanel } from '../components/MatchEventsPanel'
import { usePlayersByTeam } from '../hooks/useLocalPlayers'
import { apiClient } from '../lib/api'

export const Route = createFileRoute('/fixtures')({
  component: FixturesPage,
})

const STORAGE_KEY = 'futbol-ar:admin-token'

const ROUND_LABELS: Record<string, string> = {
  round_of_16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinal',
  final: 'Final',
}
const FIXTURES_MATCHDAY_KEY = 'futbol-ar:fixtures-matchday'

function getDateKey(dateStr?: string | null) {
  if (!dateStr) return 'sin-fecha'

  return dateStr.split('T')[0]
}

function formatDateGroup(dateStr?: string | null) {
  if (!dateStr) return 'Sin fecha'

  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)

  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function groupMatchesByDate(matches: any[]) {
  return matches.reduce<Record<string, any[]>>((acc, match) => {
    const key = getDateKey(match.scheduledAt)

    if (!acc[key]) acc[key] = []
    acc[key].push(match)

    return acc
  }, {})
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
    if (isFinished) {
      navigate({ to: '/match/$matchId', params: { matchId: String(match.id) } })
    } else if (isPast) {
      setEditing(true)
    }
  }

  return (
    <>
      <div
        onClick={() => canEdit && handleClick()}
        className={[
          'group rounded-2xl border px-4 py-3 transition-all duration-150 relative',
          isFinished
            ? 'border-white/[0.05] bg-white/[0.025] hover:border-white/[0.08] hover:bg-white/[0.045]'
            : 'border-dashed border-white/[0.08] bg-white/[0.015]',
          canEdit ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span
              className={[
                'truncate text-sm font-semibold',
                homeWon ? 'text-white' : 'text-slate-300',
              ].join(' ')}
            >
              {match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?'}
            </span>

            <TeamBadge
              name={match.homeTeam?.name ?? '?'}
              logo={match.homeTeam?.logoUrl}
              size={24}
            />
          </div>

          <div className="flex min-w-[86px] items-center justify-center">
            {isFinished ? (
              <div className="flex items-baseline justify-center gap-1.5 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-1.5">
                <span
                  className={[
                    'w-5 text-center text-xl font-bold tracking-tight',
                    homeWon ? 'text-white' : 'text-slate-500',
                  ].join(' ')}
                >
                  {match.homeScore}
                </span>

                <span className="text-sm font-semibold text-slate-600">–</span>

                <span
                  className={[
                    'w-5 text-center text-xl font-bold tracking-tight',
                    awayWon ? 'text-white' : 'text-slate-500',
                  ].join(' ')}
                >
                  {match.awayScore}
                </span>

                {match.homePenalties !== null && (
                  <span className="ml-1 text-[11px] font-medium text-yellow-300">
                    ({match.homePenalties}-{match.awayPenalties})
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.05] bg-black/10 px-4 py-1.5 text-sm font-semibold text-slate-600">
                {isPast ? 'vs' : 'vs'}
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <TeamBadge
              name={match.awayTeam?.name ?? '?'}
              logo={match.awayTeam?.logoUrl}
              size={24}
            />

            <span
              className={[
                'truncate text-sm font-semibold',
                awayWon ? 'text-white' : 'text-slate-300',
              ].join(' ')}
            >
              {match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?'}
            </span>
          </div>
        </div>

        {isFinished && (
          <div className="absolute right-3 top-3">
            <span
              className={[
                'block h-1.5 w-1.5 rounded-full opacity-40 hover:opacity-100',
                match.eventCount > 0
                  ? 'bg-emerald-400/80'
                  : 'bg-slate-700',
              ].join(' ')}
            />
          </div>
        )}
      </div>

      {editing && <ResultModal match={match} onClose={() => setEditing(false)} />}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const KNOCKOUT_KEY = 'knockout'

function FixturesPage() {
  const [selectedMatchday, setSelectedMatchday] = useState<number | string | undefined>(() => {
    const saved = sessionStorage.getItem(FIXTURES_MATCHDAY_KEY)
    return saved === KNOCKOUT_KEY ? KNOCKOUT_KEY : saved ? Number(saved) : undefined
  })

  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1
  const isKnockout = selectedMatchday === KNOCKOUT_KEY
  const { data: localData, isLoading: loadingLocal } = useLocalFixtures(tournamentId, isKnockout ? undefined : selectedMatchday as number | undefined)

  const { data: knockoutMatches = [], isLoading: loadingKnockout } = useQuery({
    queryKey: ['knockout-fixtures', tournamentId],
    queryFn: async () => {
      const { data } = await apiClient.get('/local', { params: { resource: 'knockout-fixtures', tournamentId } })
      return data.data ?? []
    },
    enabled: !!tournamentId,
    staleTime: 1000 * 60 * 5,
  })

  const handleMatchdayChange = (m: number | string) => {
    setSelectedMatchday(m)
    sessionStorage.setItem(FIXTURES_MATCHDAY_KEY, String(m))
  }

  const currentMatchday = selectedMatchday ?? localData?.matchday
  const matchdays = localData?.matchdays ?? []
  const hasKnockout = knockoutMatches.length > 0

  const groupedMatches = groupMatchesByDate(localData?.matches || [])
  const dateGroups = Object.entries(groupedMatches)

  const currentIndex = matchdays.findIndex(
    (matchday) => matchday === selectedMatchday,
  )

  const previousMatchday = matchdays[currentIndex - 1]
  const nextMatchday = matchdays[currentIndex + 1]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Fixtures</h1>

      {loadingLocal && <FixturesSkeleton />}
      {!loadingLocal && localData && (
        <>
          {(matchdays.length > 0 || hasKnockout) && currentMatchday && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4">
              {/* Arrow selector */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Fecha seleccionada
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-white">
                    Fecha {selectedMatchday}
                    <span className="ml-2 text-sm font-medium text-slate-500">
                      de {matchdays.length}
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (previousMatchday !== undefined) {
                        setSelectedMatchday(previousMatchday)
                      }
                    }}
                    disabled={currentIndex <= 0}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-400 transition-all hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft />
                  </button>

                  <button
                    onClick={() => {
                      if (nextMatchday !== undefined) {
                        setSelectedMatchday(nextMatchday)
                      }
                    }}
                    disabled={currentIndex === -1 || currentIndex >= matchdays.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-400 transition-all hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>

              {/* Pills */}
              <div className="flex flex-wrap gap-2">
                {matchdays.map((matchday) => {
                  const active = selectedMatchday === matchday

                  return (
                    <button
                      key={matchday}
                      onClick={() => setSelectedMatchday(matchday)}
                      className={[
                        'h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition-all duration-150',
                        active
                          ? 'border border-white/[0.08] bg-white/[0.09] text-white shadow-[0_0_24px_rgba(255,255,255,0.04)]'
                          : 'border border-white/[0.04] bg-white/[0.025] text-slate-500 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-slate-300',
                      ].join(' ')}
                    >
                      {matchday}
                    </button>
                  )
                })}
                {hasKnockout && (
                  <button onClick={() => handleMatchdayChange(KNOCKOUT_KEY)}
                    className={[
                      'h-10 min-w-10 rounded-xl px-3 text-sm font-semibold transition-all duration-150',
                      'border border-white/[0.04] bg-white/[0.025] text-slate-500 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-slate-300',
                    ].join(' ')}
                  >
                    Eliminatoria
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Group matches */}
          {!isKnockout && localData && (localData.matches.length === 0 ? (
            <div className="rounded-xl border border-gray-800 p-10 text-center">
              <p className="text-gray-400">No hay partidos para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-6">
              {dateGroups.map(([dateKey, dateMatches]) => (
                <section key={dateKey}>
                  <div className="mb-2.5 flex items-center gap-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {formatDateGroup(dateMatches[0]?.scheduledAt)}
                    </h3>

                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  <div className="space-y-2">
                    {dateMatches.map((match) => (
                      <LocalFixtureCard key={match.id} match={match} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))}

          {/* Knockout matches */}
          {isKnockout && (loadingKnockout ? <FixturesSkeleton /> : (
            <div className="space-y-4">
              {Object.entries(
                (knockoutMatches as any[]).reduce((acc: Record<string, any[]>, m: any) => {
                  const r = m.knockoutRound ?? 'other'
                  if (!acc[r]) acc[r] = []
                  acc[r].push(m)
                  return acc
                }, {})
              ).map(([round, matches]) => (
                <div key={round} className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{ROUND_LABELS[round] ?? round}</h3>
                  {(matches as any[]).map((match: any) => (
                    <LocalFixtureCard key={match.id} match={match} />
                  ))}
                </div>
              ))}
            </div>
          ))}
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