import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Trophy, Calendar } from 'lucide-react'
import { apiClient } from '../lib/api'
import { ROUND_LABELS_LONG as ROUND_LABELS, ROUND_ORDER } from '../config/rounds'
import { formatMatchDateShort } from '../lib/date'

// ─── Constants ────────────────────────────────────────────────────────────────

const NEXT_ROUND: Record<string, string> = {
  round_of_64: 'round_of_32',
  round_of_32: 'round_of_16',
  round_of_16: 'quarterfinal',
  quarterfinal: 'semifinal',
  semifinal: 'final',
}

const TEAM_COUNTS = [4, 8, 16, 32, 64]
const FIRST_ROUND_FOR_COUNT: Record<number, string> = {
  4: 'semifinal', 8: 'quarterfinal', 16: 'round_of_16', 32: 'round_of_32', 64: 'round_of_64',
}

// ─── API functions ────────────────────────────────────────────────────────────

async function fetchKnockoutMatches(tournamentId: number) {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'knockout-fixtures', tournamentId }
  })
  return data.data ?? []
}

async function fetchAllTeamsForManual(token: string, tournamentId?: number) {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'teams', ...(tournamentId ? { tournamentId } : {}) },
    headers: { 'x-admin-token': token },
  })
  return data.data ?? []
}

async function fetchBracketRules(token: string, tournamentId: number) {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'bracket-rules', tournamentId },
    headers: { 'x-admin-token': token },
  })
  return data.data ?? []
}

async function generateKnockout(token: string, tournamentId: number, round: string) {
  const { data } = await apiClient.post('/admin?action=generate-knockout',
    { tournamentId, round }, { headers: { 'x-admin-token': token } }
  )
  return data.data
}

async function setMatchDate(token: string, matchId: number, scheduledAt: string | null) {
  const { data } = await apiClient.patch('/admin?action=set-match-date',
    { matchId, scheduledAt }, { headers: { 'x-admin-token': token } }
  )
  return data.data
}

async function createBracketRule(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=bracket-rules', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

// ─── Manual Knockout Form ─────────────────────────────────────────────────────

function ManualKnockoutForm({ tournamentId, allTeams, token, createMatchMutation, tournamentCountry }: {
  tournamentId: number; allTeams: any[]; token: string; createMatchMutation: any; tournamentCountry: string | null
}) {
  const queryClient = useQueryClient()
  const [teamCount, setTeamCount] = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, { homeTeamId: string; awayTeamId: string }>>({})
  const [newTeamPos, setNewTeamPos] = useState<{ pos: number; side: 'home' | 'away' } | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamShort, setNewTeamShort] = useState('')

  const createTeamMutation = useMutation<any, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.post('/admin?action=teams',
        { name: newTeamName, shortName: newTeamShort, country: tournamentCountry ?? null },
        { headers: { 'x-admin-token': token } }
      )
      return data.data
    },
    onSuccess: (team) => {
      if (!newTeamPos) return
      setSelections(prev => ({
        ...prev,
        [newTeamPos.pos]: {
          ...prev[newTeamPos.pos] ?? { homeTeamId: '', awayTeamId: '' },
          [newTeamPos.side === 'home' ? 'homeTeamId' : 'awayTeamId']: String(team.id)
        }
      }))
      queryClient.invalidateQueries({ queryKey: ['all-teams-manual'] })
      setNewTeamPos(null); setNewTeamName(''); setNewTeamShort('')
    },
  })

  if (teamCount === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">¿Cuántos equipos participan en la primera ronda?</p>
        <div className="flex gap-2 flex-wrap">
          {TEAM_COUNTS.map(n => (
            <button key={n} onClick={() => setTeamCount(n)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-[#74ACDF] hover:text-gray-950 text-gray-300 text-sm font-medium transition-colors">
              {n} equipos
            </button>
          ))}
        </div>
      </div>
    )
  }

  const round = FIRST_ROUND_FOR_COUNT[teamCount] ?? 'round_of_16'
  const matchCount = teamCount / 2
  const cruces = Array.from({ length: matchCount }, (_, i) => i + 1)

  const handleSave = async () => {
    for (const pos of cruces) {
      const sel = selections[pos]
      if (!sel?.homeTeamId || !sel?.awayTeamId) continue
      await createMatchMutation.mutateAsync({
        tournamentId, phase: 'knockout', knockoutRound: round,
        bracketPosition: pos,
        homeTeamId: Number(sel.homeTeamId), awayTeamId: Number(sel.awayTeamId),
        scheduledAt: null,
      })
      await createBracketRule(token, {
        tournamentId, knockoutRound: round, bracketPosition: pos,
        homeGroupId: null, homePosition: null,
        awayGroupId: null, awayPosition: null,
        homeWinnerOf: null, awayWinnerOf: null,
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{ROUND_LABELS[round] ?? round} — {teamCount} equipos ({matchCount} cruces)</p>
        <button onClick={() => setTeamCount(null)} className="text-xs text-gray-500 hover:text-white">Cambiar</button>
      </div>
      <div className="space-y-2">
        {cruces.map(pos => {
          const sel = selections[pos] ?? { homeTeamId: '', awayTeamId: '' }
          return (
            <div key={pos} className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 space-y-1.5">
              <p className="text-xs text-gray-600">Cruce {pos}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['home', 'away'] as const).map(side => {
                  const val = side === 'home' ? sel.homeTeamId : sel.awayTeamId
                  return (
                    <div key={side} className="space-y-1">
                      <select value={val}
                        onChange={e => {
                          if (e.target.value === '__new__') { setNewTeamPos({ pos, side }); return }
                          setSelections(prev => ({ ...prev, [pos]: { ...sel, [side === 'home' ? 'homeTeamId' : 'awayTeamId']: e.target.value } }))
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
                        <option value="">{side === 'home' ? 'Local...' : 'Visitante...'}</option>
                        {allTeams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        <option value="__new__">＋ Crear equipo nuevo</option>
                      </select>
                      {newTeamPos?.pos === pos && newTeamPos?.side === side && (
                        <div className="flex gap-1">
                          <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                            placeholder="Nombre" className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]" />
                          <input value={newTeamShort} onChange={e => setNewTeamShort(e.target.value)}
                            placeholder="Abrev." className="w-16 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]" />
                          <button onClick={() => createTeamMutation.mutate()} disabled={!newTeamName || createTeamMutation.isPending}
                            className="px-2 py-1 rounded bg-[#74ACDF] text-gray-950 text-xs disabled:opacity-50">
                            <Check size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={handleSave} disabled={createMatchMutation.isPending}
        className="w-full py-2 rounded-xl bg-[#74ACDF] text-gray-950 font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        <Check size={14} /> {createMatchMutation.isPending ? 'Guardando...' : 'Guardar cruces'}
      </button>
    </div>
  )
}

// ─── Wildcard Slot Label ──────────────────────────────────────────────────────
// Shows "3° A/B/C/D/F" for wildcard slots before knockout is generated

function WildcardSlotLabel({ match, rules, groups }: { match: any; rules: any[]; groups: any[] }) {
  // Find the bracket rule for this match
  const rule = rules.find((r: any) =>
    r.knockoutRound === match.knockoutRound && r.bracketPosition === match.bracketPosition
  )
  if (!rule?.wildcardGroupIds) return null

  const ids = rule.wildcardGroupIds.split(',').map(Number)
  const names = ids.map((id: number) => groups.find((g: any) => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')

  const homeIsWildcard = rule.homeGroupId === null && rule.wildcardGroupIds
  const awayIsWildcard = rule.awayGroupId === null && rule.wildcardGroupIds

  return (
    <div className="flex items-center gap-1 mt-1">
      {homeIsWildcard && !match.homeTeamId && (
        <span className="text-[10px] text-yellow-500/80 bg-yellow-950/30 border border-yellow-800/40 rounded px-1.5 py-0.5">
          {rule.homePosition}° {names}
        </span>
      )}
      {awayIsWildcard && !match.awayTeamId && (
        <span className="text-[10px] text-yellow-500/80 bg-yellow-950/30 border border-yellow-800/40 rounded px-1.5 py-0.5">
          {rule.awayPosition}° {names}
        </span>
      )}
    </div>
  )
}

// ─── Knockout Section ─────────────────────────────────────────────────────────

export function KnockoutSection({ token, tournamentId, tournament, groups = [] }: {
  token: string; tournamentId: number; tournament: any; groups?: any[]
}) {
  const queryClient = useQueryClient()
  const [editingDate, setEditingDate] = useState<number | null>(null)
  const [dateValue, setDateValue] = useState('')

  const hasGroups = (tournament as any)?.hasGroups ?? true
  const tournamentCountry = (tournament as any)?.country ?? null

  const { data: knockoutMatches = [], isLoading } = useQuery({
    queryKey: ['knockout-matches', tournamentId],
    queryFn: () => fetchKnockoutMatches(tournamentId),
  })

  const { data: bracketRulesData = [] } = useQuery({
    queryKey: ['admin-bracket-rules', tournamentId],
    queryFn: () => fetchBracketRules(token, tournamentId),
    enabled: !!tournamentId,
  })

  const { data: allTeamsRaw = [] } = useQuery({
    queryKey: ['all-teams-manual', tournamentId],
    queryFn: () => fetchAllTeamsForManual(token, tournamentId),
    staleTime: 1000 * 60 * 10,
    enabled: !hasGroups,
  })

  const allTeamsForManual = tournamentCountry
    ? (allTeamsRaw as any[]).filter((t: any) => !t.country || t.country === tournamentCountry)
    : allTeamsRaw as any[]

  const createMatchMutation = useMutation<any, Error, any>({
    mutationFn: (payload) => apiClient.post('/admin?action=matches', payload, { headers: { 'x-admin-token': token } }).then(r => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knockout-matches', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['all-teams-manual', tournamentId] })
    },
  })

  const generateMutation = useMutation<any, Error, string>({
    mutationFn: (round) => generateKnockout(token, tournamentId, round),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knockout-matches', tournamentId] }),
  })

  const dateMutation = useMutation<any, Error, { matchId: number; scheduledAt: string | null }>({
    mutationFn: ({ matchId, scheduledAt }) => setMatchDate(token, matchId, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knockout-matches', tournamentId] })
      setEditingDate(null)
    },
  })

  const knockoutStarted = (tournament as any)?.knockoutStarted

  const byRound = (knockoutMatches as any[]).reduce((acc: Record<string, any[]>, m: any) => {
    const r = m.knockoutRound ?? 'unknown'
    if (!acc[r]) acc[r] = []
    acc[r].push(m)
    return acc
  }, {})

  const existingRounds = new Set(Object.keys(byRound))
  const nextRoundToGenerate = (() => {
    if (!hasGroups && existingRounds.size === 0) return null
    if (existingRounds.size === 0) {
      const rounds = [...new Set(bracketRulesData.map((item: any) => item.knockoutRound))];
      const highestRound = Object.entries(FIRST_ROUND_FOR_COUNT)
        .filter(([, round]) => rounds.includes(round))
        .sort((a, b) => Number(b[0]) - Number(a[0]))[0]?.[1]
      return highestRound
    }
    const lastRound = ROUND_ORDER.filter(r => existingRounds.has(r)).pop()
    if (!lastRound) return null
    const lastRoundMatches = byRound[lastRound] ?? []
    const allFinished = lastRoundMatches.length > 0 && lastRoundMatches.every((m: any) => m.status === 'finished')
    if (!allFinished) return null
    return NEXT_ROUND[lastRound] ?? null
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Fase Eliminatoria</h2>
        {knockoutStarted && nextRoundToGenerate && (
          <button onClick={() => generateMutation.mutate(nextRoundToGenerate)} disabled={generateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#74ACDF] text-gray-950 font-medium text-sm disabled:opacity-50 transition-colors">
            <Trophy size={13} /> {generateMutation.isPending ? 'Generando...' : `Generar ${ROUND_LABELS[nextRoundToGenerate] ?? nextRoundToGenerate}`}
          </button>
        )}
        {!knockoutStarted && (
          <span className="text-xs text-gray-600">Activá la fase eliminatoria en Neon para generar los partidos</span>
        )}
      </div>

      {generateMutation.isError && (
        <p className="text-red-400 text-xs">{(generateMutation.error as any)?.response?.data?.error ?? 'Error al generar'}</p>
      )}

      {isLoading && <p className="text-gray-500 text-sm">Cargando...</p>}

      {knockoutMatches.length === 0 && !isLoading && knockoutStarted && !hasGroups && (
        <ManualKnockoutForm
          tournamentId={tournamentId}
          allTeams={allTeamsForManual}
          token={token}
          createMatchMutation={createMatchMutation}
          tournamentCountry={tournamentCountry}
        />
      )}

      {knockoutMatches.length === 0 && !isLoading && knockoutStarted && hasGroups && (
        <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center">
          <p className="text-gray-400 text-sm">No hay partidos de eliminatoria generados todavía</p>
        </div>
      )}

      {ROUND_ORDER.filter(r => byRound[r]).reverse().map(round => (
        <div key={round} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{ROUND_LABELS[round] ?? round}</h3>
            {byRound[round]?.every((m: any) => m.status === 'finished') && (
              <span className="text-[10px] text-emerald-500">✓ Completa</span>
            )}
          </div>
          {(byRound[round] as any[]).map((match: any) => (
            <div key={match.id} className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white flex-1 text-right truncate font-medium">
                  {match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?'}
                </span>
                <span className={`text-sm font-bold w-16 text-center ${match.status === 'finished' ? 'text-white' : 'text-gray-600'}`}>
                  {match.status === 'finished' ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
                </span>
                <span className="text-sm text-white flex-1 truncate font-medium">
                  {match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?'}
                </span>
              </div>
              <WildcardSlotLabel match={match} rules={bracketRulesData} groups={groups} />
              {editingDate === match.id ? (
                <div className="flex gap-2">
                  <input type="datetime-local" value={dateValue} onChange={e => setDateValue(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]" />
                  <button onClick={() => dateMutation.mutate({ matchId: match.id, scheduledAt: dateValue ? dateValue + ':00.000Z' : null })}
                    disabled={dateMutation.isPending}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-50">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingDate(null)}
                    className="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-xs">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {match.scheduledAt ? formatMatchDateShort(match.scheduledAt) : 'Sin fecha'}
                  </span>
                  <button onClick={() => { setEditingDate(match.id); setDateValue(match.scheduledAt?.slice(0, 16) ?? '') }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#74ACDF] transition-colors">
                    <Calendar size={11} /> Editar fecha
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
