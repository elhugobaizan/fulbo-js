import { useState, useEffect, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, Check, X, Trophy, Trash2 } from 'lucide-react'
import { MatchEventsPanel } from '../components/MatchEventsPanel'
import { KnockoutSection } from '../components/KnockoutSection'
import { usePlayersByTeam } from '../hooks/useLocalPlayers'
import { apiClient } from '../lib/api'
import { ROUND_ORDER, KNOCKOUT_ROUNDS, ADMIN_TOKEN_KEY } from '../config/rounds'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})


// ─── API calls ───────────────────────────────────────────────────────────────

async function authenticate(password: string): Promise<boolean> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.authenticated === true
}

async function fetchTournamentData(token: string, tournamentId: number) {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'tournament', tournamentId },
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function fetchBracketRules(token: string, tournamentId: number) {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'bracket-rules', tournamentId },
    headers: { 'x-admin-token': token },
  })
  return data.data ?? []
}

async function fetchAllTournaments(token: string) {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'tournaments' },
    headers: { 'x-admin-token': token },
  })
  return data.data ?? []
}





async function activateTournament(token: string, tournamentId: number) {
  const { data } = await apiClient.post('/admin?action=activate-tournament',
    { tournamentId },
    { headers: { 'x-admin-token': token } }
  )
  return data.data
}

async function createBracketRule(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=bracket-rules', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function deleteBracketRule(token: string, ruleId: number) {
  await apiClient.delete('/admin?action=bracket-rules', {
    params: { ruleId },
    headers: { 'x-admin-token': token },
  })
}

async function createMatch(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=matches', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function updateMatch(token: string, payload: any) {
  const { data } = await apiClient.patch('/admin?action=matches', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const ok = await authenticate(password)
      if (ok) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, password)
        onLogin(password)
      } else {
        setError('Password incorrecto')
      }
    } catch {
      setError('Password incorrecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-gray-800 bg-gray-900 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
            <Lock size={20} className="text-[#74ACDF]" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400">Fútbol AR</p>
        </div>
        <div className="space-y-3">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="Password"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#74ACDF] transition-colors"
            autoFocus />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleSubmit} disabled={loading || !password}
            className="w-full py-2.5 rounded-xl bg-[#74ACDF] text-gray-950 font-semibold hover:bg-[#5a9fd4] transition-colors disabled:opacity-50">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Match Result Form ────────────────────────────────────────────────────────

function MatchResultForm({ match, tournamentId, token, onSaved, onClose }: { match: any; tournamentId: number; token: string; onSaved: () => void; onClose: () => void }) {
  const [homeScore, setHomeScore] = useState(match.homeScore ?? '')
  const [awayScore, setAwayScore] = useState(match.awayScore ?? '')
  const [homePen, setHomePen] = useState(match.homePenalties ?? '')
  const [awayPen, setAwayPen] = useState(match.awayPenalties ?? '')
  const queryClient = useQueryClient()
  const { data: homePlayers = [] } = usePlayersByTeam(match.homeTeam?.id ?? 0)
  const { data: awayPlayers = [] } = usePlayersByTeam(match.awayTeam?.id ?? 0)

  const showPenalties = homeScore !== '' && awayScore !== '' &&
    Number(homeScore) === Number(awayScore) && match.phase === 'knockout'

  const mutation = useMutation<any, Error, void>({
    mutationFn: () => updateMatch(token, {
      matchId: match.id, homeScore: Number(homeScore), awayScore: Number(awayScore),
      homePenalties: showPenalties && homePen !== '' ? Number(homePen) : null,
      awayPenalties: showPenalties && awayPen !== '' ? Number(awayPen) : null,
      status: 'finished',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournament'] });
      onSaved();
      queryClient.invalidateQueries({ queryKey: ['knockout-fixtures', tournamentId] })
    },
  })

  return (
    <div className="space-y-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white flex-1 text-right truncate">{match.homeTeam?.shortName ?? match.homeTeam?.name}</span>
        <div className="flex items-center gap-2">
          <input type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)}
            className="w-14 text-center py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" />
          <span className="text-gray-500 font-bold">-</span>
          <input type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)}
            className="w-14 text-center py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white font-bold text-lg focus:outline-none focus:border-[#74ACDF]" />
        </div>
        <span className="text-sm font-medium text-white flex-1 truncate">{match.awayTeam?.shortName ?? match.awayTeam?.name}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
      {showPenalties && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex-1 text-right">Penales</span>
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={homePen} onChange={(e) => setHomePen(e.target.value)}
              className="w-14 text-center py-1 rounded-lg bg-gray-700 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
            <span className="text-gray-500">-</span>
            <input type="number" min="0" value={awayPen} onChange={(e) => setAwayPen(e.target.value)}
              className="w-14 text-center py-1 rounded-lg bg-gray-700 border border-yellow-600/50 text-yellow-400 font-bold focus:outline-none" />
          </div>
          <span className="text-xs text-gray-400 flex-1" />
        </div>
      )}
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || homeScore === '' || awayScore === ''}
        className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        <Check size={14} />{mutation.isPending ? 'Guardando...' : 'Guardar resultado'}
      </button>
      {match.status === 'finished' && (
        <MatchEventsPanel
          matchId={match.id}
          homeTeam={match.homeTeam ?? { id: match.homeTeamId, name: '?', shortName: null }}
          awayTeam={match.awayTeam ?? { id: match.awayTeamId, name: '?', shortName: null }}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
        />
      )}
    </div>
  )
}

// ─── New Match Form ───────────────────────────────────────────────────────────

function NewMatchForm({ allTeams, token, onSaved, tournamentId, groupsData, allowCrossGroup }: { allTeams: any[]; token: string; onSaved: () => void; tournamentId: number; groupsData: any[]; allowCrossGroup: boolean }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const availableTeams = allowCrossGroup
    ? allTeams
    : selectedGroupId
      ? (groupsData.find((g: any) => String(g.id) === selectedGroupId)?.teams ?? [])
      : allTeams
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [matchday, setMatchday] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation<any, Error, void>({
    mutationFn: () => createMatch(token, {
      tournamentId, phase: 'group',
      groupId: selectedGroupId ? Number(selectedGroupId) : undefined,
      scheduledAt, matchday: Number(matchday),
      homeTeamId: Number(homeTeamId), awayTeamId: Number(awayTeamId),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournament'] })
      setHomeTeamId(''); setAwayTeamId(''); setMatchday(''); setScheduledAt('')
      setOpen(false); onSaved()
    },
  })

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 transition-colors text-sm flex items-center justify-center gap-2">
      <Plus size={14} /> Agregar partido
    </button>
  )

  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Nuevo partido</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>
      {!allowCrossGroup && (
        <select value={selectedGroupId} onChange={e => { setSelectedGroupId(e.target.value); setHomeTeamId(''); setAwayTeamId('') }}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          <option value="">Todos los grupos</option>
          {groupsData.map((g: any) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        </select>
      )}
      {!allowCrossGroup && selectedGroupId && (
        <p className="text-xs text-gray-500">
          {groupsData.find((g: any) => String(g.id) === selectedGroupId)?.teams
            ?.map((t: any) => t.shortName ?? t.name).join(', ')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          <option value="">Local</option>
          {availableTeams.map((t: any) => <option key={t.id} value={t.id}>{t.shortName ?? t.name}</option>)}
        </select>
        <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          <option value="">Visitante</option>
          {availableTeams.map((t: any) => <option key={t.id} value={t.id}>{t.shortName ?? t.name}</option>)}
        </select>
      </div>
      <input type="number" min="1" value={matchday} onChange={(e) => setMatchday(e.target.value)} placeholder="Fecha N°"
        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
      <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
      <button onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !homeTeamId || !awayTeamId || !matchday || !scheduledAt || homeTeamId === awayTeamId}
        className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-medium text-sm hover:bg-[#5a9fd4] transition-colors disabled:opacity-50">
        {mutation.isPending ? 'Creando...' : 'Crear partido'}
      </button>
    </div>
  )
}

// ─── Bracket Rules Section ────────────────────────────────────────────────────

function ruleLabel(rule: any, groups: any[], allRules: any[]): string {
  const parts = []
  // Local
  const wildcardLabel = (groupId: number | null, position: number | null, wcGroupIds: string | null) => {
    // If groupId is set, resolve normally regardless of wcGroupIds
    if (groupId !== null && position !== null) {
      const g = groups.find((g: any) => g.id === groupId)
      return `${position}° ${g?.name ?? '?'}`
    }
    // Wildcard slot: groupId is null but wcGroupIds lists possible groups
    if (wcGroupIds && position !== null) {
      const ids = wcGroupIds.split(',').map(Number)
      const names = ids.map((id: number) => groups.find((g: any) => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')
      return `${position}° ${names}`
    }
    return null
  }
  const homeLabel = wildcardLabel(rule.homeGroupId, rule.homePosition, rule.wildcardGroupIds ?? null)
  if (homeLabel) parts.push(homeLabel)
  else if (rule.homeWinnerOf !== null) {
    const prev = allRules.find((r: any) => r.id === rule.homeWinnerOf)
    parts.push(`Gan. cruce ${prev?.bracketPosition ?? '?'}`)
  }
  parts.push('vs')
  const awayLabel = wildcardLabel(rule.awayGroupId, rule.awayPosition, rule.wildcardGroupIds ?? null)
  if (awayLabel) parts.push(awayLabel)
  else if (rule.awayWinnerOf !== null) {
    const prev = allRules.find((r: any) => r.id === rule.awayWinnerOf)
    parts.push(`Gan. cruce ${prev?.bracketPosition ?? '?'}`)
  }
  return parts.join(' ')
}

function NewBracketRuleForm({ groups, allRules, token, tournamentId, hasGroups = true }: { groups: any[]; allRules: any[]; token: string; tournamentId: number; hasGroups?: boolean }) {
  const [open, setOpen] = useState(false)
  const [knockoutRound, setKnockoutRound] = useState('round_of_16')
  const [bracketPosition, setBracketPosition] = useState('')

  // Local
  const [homeSource, setHomeSource] = useState<'group' | 'winner' | 'wildcard'>(() => hasGroups ? 'group' : 'winner')
  const [homeGroupId, setHomeGroupId] = useState('')
  const [homePosition, setHomePosition] = useState('')
  const [homeWinnerOf, setHomeWinnerOf] = useState('')
  const [homeWildcardGroupIds, setHomeWildcardGroupIds] = useState<string[]>([])

  // Visitante
  const [awaySource, setAwaySource] = useState<'group' | 'winner' | 'wildcard'>(() => hasGroups ? 'group' : 'winner')
  const [awayGroupId, setAwayGroupId] = useState('')
  const [awayPosition, setAwayPosition] = useState('')
  const [awayWinnerOf, setAwayWinnerOf] = useState('')
  const [awayWildcardGroupIds, setAwayWildcardGroupIds] = useState<string[]>([])

  const queryClient = useQueryClient()

  // Reglas de rondas anteriores disponibles para "ganador de"
  const prevRoundRules = allRules.filter((r: any) => {
    const currentIdx = ROUND_ORDER.indexOf(knockoutRound)
    const ruleIdx = ROUND_ORDER.indexOf(r.knockoutRound)
    return ruleIdx < currentIdx && ruleIdx >= 0
  })

  const mutation = useMutation<any, Error, void>({
    mutationFn: () => createBracketRule(token, {
      tournamentId,
      knockoutRound,
      bracketPosition: Number(bracketPosition),
      homeGroupId: homeSource === 'group' ? Number(homeGroupId) : (homeSource === 'wildcard' ? Number(homeGroupId) || null : null),
      homePosition: homeSource === 'group' ? Number(homePosition) : (homeSource === 'wildcard' ? Number(homePosition) || null : null),
      awayGroupId: awaySource === 'group' ? Number(awayGroupId) : (awaySource === 'wildcard' ? Number(awayGroupId) || null : null),
      awayPosition: awaySource === 'group' ? Number(awayPosition) : (awaySource === 'wildcard' ? Number(awayPosition) || null : null),
      homeWinnerOf: homeSource === 'winner' ? Number(homeWinnerOf) : null,
      awayWinnerOf: awaySource === 'winner' ? Number(awayWinnerOf) : null,
      wildcardGroupIds: (homeSource === 'wildcard' || awaySource === 'wildcard')
        ? [...homeWildcardGroupIds, ...awayWildcardGroupIds].filter((v, i, a) => a.indexOf(v) === i).join(',') || null
        : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bracket-rules'] })
      setBracketPosition(''); setHomeGroupId(''); setHomePosition('')
      setHomeWinnerOf(''); setAwayGroupId(''); setAwayPosition(''); setAwayWinnerOf('')
      setHomeWildcardGroupIds([]); setAwayWildcardGroupIds([])
      setOpen(false)
    },
  })

  function isSlotValid(source: 'group' | 'winner' | 'wildcard', groupId: string, position: string, winnerId: string, wildcardGroupIds: string[]): boolean {
    if (source === 'group') return !!(groupId && position)
    if (source === 'wildcard') return !!(position && wildcardGroupIds.length > 0)
    return !!winnerId
  }

  const isFirstRoundNoGroups = !hasGroups && prevRoundRules.length === 0
  const isValid = !!bracketPosition
    && (isFirstRoundNoGroups || isSlotValid(homeSource, homeGroupId, homePosition, homeWinnerOf, homeWildcardGroupIds))
    && (isFirstRoundNoGroups || isSlotValid(awaySource, awayGroupId, awayPosition, awayWinnerOf, awayWildcardGroupIds))

  const SlotConfig = ({
    label, source, setSource, groupId, setGroupId, position, setPosition, winnerId, setWinnerId, wildcardGroupIds, setWildcardGroupIds
  }: any) => (
    <div className="space-y-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300 uppercase">{label}</span>
        {hasGroups && (
          <div className="flex gap-1">
            <button onClick={() => setSource('group')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${source === 'group' ? 'bg-[#74ACDF] text-gray-950 font-medium' : 'text-gray-500 hover:text-white'}`}>
              Grupo
            </button>
            <button onClick={() => setSource('winner')}
              disabled={prevRoundRules.length === 0}
              className={`px-2 py-0.5 rounded text-xs transition-colors disabled:opacity-30 ${source === 'winner' ? 'bg-[#74ACDF] text-gray-950 font-medium' : 'text-gray-500 hover:text-white'}`}>
              Ganador
            </button>
            <button onClick={() => setSource('wildcard')}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${source === 'wildcard' ? 'bg-yellow-500 text-gray-950 font-medium' : 'text-gray-500 hover:text-white'}`}>
              Wildcard
            </button>
          </div>
        )}
      </div>

      {source === 'group' ? (
        <div className="grid grid-cols-2 gap-2">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
            <option value="">Grupo</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input type="number" min="1" max="15" value={position} onChange={(e) => setPosition(e.target.value)}
            placeholder="Posición"
            className="px-2 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
        </div>
      ) : source === 'winner' ? (
        <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          <option value="">Ganador de...</option>
          {prevRoundRules.map((r: any) => (
            <option key={r.id} value={r.id}>
              {KNOCKOUT_ROUNDS.find(x => x.value === r.knockoutRound)?.label} · Cruce {r.bracketPosition}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-2">
          <input type="number" min="1" max="15" value={position} onChange={(e) => setPosition(e.target.value)}
            placeholder="Posición (ej: 3 para terceros)"
            className="w-full px-2 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          <div className="text-xs text-gray-400 mb-1">Grupos posibles:</div>
          <div className="flex flex-wrap gap-1">
            {groups.map((g: any) => {
              const selected = wildcardGroupIds.includes(String(g.id))
              return (
                <button key={g.id} type="button"
                  onClick={() => setWildcardGroupIds(selected
                    ? wildcardGroupIds.filter((id: string) => id !== String(g.id))
                    : [...wildcardGroupIds, String(g.id)]
                  )}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${selected ? 'bg-yellow-500 text-gray-950 font-medium' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
                  {g.name.replace('Grupo ', '')}
                </button>
              )
            })}
          </div>
          {wildcardGroupIds.length > 0 && (
            <p className="text-xs text-yellow-500/80">{position ? `${position}° ` : ''}de grupos: {wildcardGroupIds.map((id: string) => groups.find((g: any) => String(g.id) === id)?.name?.replace('Grupo ', '')).join('/')}</p>
          )}
        </div>
      )}
    </div>
  )

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 transition-colors text-sm flex items-center justify-center gap-2">
      <Plus size={14} /> Agregar regla
    </button>
  )

  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Nueva regla de cruce</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={knockoutRound} onChange={(e) => setKnockoutRound(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          {KNOCKOUT_ROUNDS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input type="number" min="1" value={bracketPosition} onChange={(e) => setBracketPosition(e.target.value)}
          placeholder="Nº cruce (1, 2...)"
          className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
      </div>

      <SlotConfig label="Local" source={homeSource} setSource={setHomeSource}
        groupId={homeGroupId} setGroupId={setHomeGroupId}
        position={homePosition} setPosition={setHomePosition}
        winnerId={homeWinnerOf} setWinnerId={setHomeWinnerOf}
        wildcardGroupIds={homeWildcardGroupIds} setWildcardGroupIds={setHomeWildcardGroupIds} />

      <SlotConfig label="Visitante" source={awaySource} setSource={setAwaySource}
        groupId={awayGroupId} setGroupId={setAwayGroupId}
        position={awayPosition} setPosition={setAwayPosition}
        winnerId={awayWinnerOf} setWinnerId={setAwayWinnerOf}
        wildcardGroupIds={awayWildcardGroupIds} setWildcardGroupIds={setAwayWildcardGroupIds} />

      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}
        className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-medium text-sm hover:bg-[#5a9fd4] transition-colors disabled:opacity-50">
        {mutation.isPending ? 'Guardando...' : 'Crear regla'}
      </button>
    </div>
  )
}

function BracketRulesSection({ token, groups, tournamentId, hasGroups = true }: { token: string; groups: any[]; tournamentId: number; hasGroups?: boolean }) {
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['admin-bracket-rules', tournamentId],
    queryFn: () => fetchBracketRules(token, tournamentId),
  })

  const deleteMutation = useMutation<any, Error, number>({
    mutationFn: (ruleId) => deleteBracketRule(token, ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-bracket-rules'] }),
  })

  const byRound = KNOCKOUT_ROUNDS.reduce<Record<string, any[]>>((acc, r) => {
    acc[r.value] = rules.filter((rule: any) => rule.knockoutRound === r.value)
      .sort((a: any, b: any) => a.bracketPosition - b.bracketPosition)
    return acc
  }, {})

  if (isLoading) return <p className="text-gray-400 text-sm">Cargando...</p>

  return (
    <div className="space-y-5">
      <NewBracketRuleForm groups={groups} allRules={rules} token={token} tournamentId={tournamentId} hasGroups={hasGroups} />
      {[...KNOCKOUT_ROUNDS].reverse().map(({ value, label }) => (
        <div key={value} className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</h3>
          {byRound[value].map((rule: any) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40">
              <span className="text-xs text-gray-500 w-6 text-center flex-shrink-0">#{rule.bracketPosition}</span>
              <span className="text-sm text-white flex-1">{ruleLabel(rule, groups, rules)}</span>
              <button onClick={() => deleteMutation.mutate(rule.id)}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {byRound[value].length === 0 && (
            <p className="text-xs text-gray-600 px-4">Sin reglas configuradas</p>
          )}
        </div>
      ))}
    </div>
  )
}


// ─── Groups Section ───────────────────────────────────────────────────────────

function GroupsSection({ allMatches, allTeams, groupsData, token, editingMatch, setEditingMatch, tournamentId, allowCrossGroup }: {
  allMatches: any[]; allTeams: any[]; groupsData: any[]; token: string
  editingMatch: number | null; setEditingMatch: (id: number | null) => void; tournamentId: number; allowCrossGroup: boolean
}) {
  const allMatchdays = useMemo(
    () => [...new Set(allMatches.filter(m => m.matchday).map(m => m.matchday as number))].sort((a, b) => a - b),
    [allMatches]
  )
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(allMatchdays[allMatchdays.length - 1] ?? null)

  const dayMatches = allMatches
    .filter(m => m.matchday === selectedMatchday)
    .sort((a, b) => (a.groupId ?? 0) - (b.groupId ?? 0))

  // Agrupar por groupId
  const byGroup = dayMatches.reduce((acc: Record<string, any[]>, m: any) => {
    const key = String(m.groupId ?? 'sin-grupo')
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* New match form - always on top */}
      <NewMatchForm allTeams={allTeams} token={token} onSaved={() => { }} tournamentId={tournamentId} groupsData={groupsData} allowCrossGroup={allowCrossGroup} />

      {/* Matchday selector */}
      {allMatchdays.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ver fecha</h3>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {allMatchdays.map(day => (
              <button key={day} onClick={() => setSelectedMatchday(day)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedMatchday === day ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                Fecha {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matches for selected matchday */}
      {selectedMatchday !== null && dayMatches.length > 0 && (
        <div className="space-y-2">
          {Object.entries(byGroup).map(([groupId, groupMatches]) => {
            const groupName = groupsData.find((g: any) => String(g.id) === groupId)?.name ?? 'Sin grupo'
            return (
              <div key={groupId} className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{groupName}</h3>
                {(groupMatches as any[]).map((match: any) => {
                  // ... el mismo render de cada partido
                  const enriched = {
                    ...match,
                    homeTeam: allTeams.find((t: any) => t.id === match.homeTeamId),
                    awayTeam: allTeams.find((t: any) => t.id === match.awayTeamId),
                  }
                  const awayTeamGroupId = match.groupId ? groupsData.find((g: any) =>
                    g.teams?.some((t: any) => t.id === match.awayTeamId)
                  )?.id : null
                  const isCrossGroup = match.groupId && awayTeamGroupId && awayTeamGroupId !== match.groupId
                  return (
                    <div key={match.id}>
                      {editingMatch === match.id ? (
                        <MatchResultForm match={enriched} tournamentId={tournamentId} token={token} onSaved={() => setEditingMatch(null)} onClose={() => setEditingMatch(null)} />
                      ) : (
                        <button onClick={() => setEditingMatch(match.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${match.status === 'finished' ? 'border-gray-800 bg-gray-900/40 hover:bg-gray-900/70' : 'border-dashed border-gray-700 hover:border-gray-500'}`}>
                          <span className="text-sm text-gray-400 w-5 text-right flex-shrink-0">
                            {groupsData.find((g: any) => g.id === match.groupId)?.name?.replace('Grupo ', '') ?? '?'}
                          </span>
                          <span className="text-sm text-white flex-1 text-right truncate">{enriched.homeTeam?.shortName ?? '?'}</span>
                          <span className={`text-sm font-bold w-16 text-center ${match.status === 'finished' ? 'text-white' : 'text-gray-600'}`}>
                            {match.status === 'finished' ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
                          </span>
                          <span className="text-sm text-white flex-1 truncate">{enriched.awayTeam?.shortName ?? '?'}</span>
                          {isCrossGroup && <span className="text-[10px] text-yellow-500 border border-yellow-700/50 rounded px-1 flex-shrink-0">inter</span>}
                          {match.status === 'finished' && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {selectedMatchday !== null && dayMatches.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">No hay partidos para esta fecha</p>
      )}
    </div>
  )
}


// ─── Knockout Section ─────────────────────────────────────────────────────────



// ─── Bracket Sub-Tabs ─────────────────────────────────────────────────────────

function BracketSubTabs({ token, tournamentId, tournament, groupsData }: {
  token: string; tournamentId: number; tournament: any; groupsData: any[]
}) {
  const [subTab, setSubTab] = useState<'matches' | 'rules'>('matches')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        <button onClick={() => setSubTab('matches')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'matches' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Partidos
        </button>
        <button onClick={() => setSubTab('rules')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${subTab === 'rules' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Reglas de cruces
        </button>
      </div>
      {subTab === 'matches' && (
        <KnockoutSection token={token} tournamentId={tournamentId} tournament={tournament} groups={groupsData ?? []} />
      )}
      {subTab === 'rules' && (
        <BracketRulesSection token={token} groups={groupsData} tournamentId={tournamentId} hasGroups={tournament?.hasGroups ?? true} />
      )}
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ token, onLogout }: { token: string; onLogout: () => void; }) {
  const [editingMatch, setEditingMatch] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'groups' | 'bracket'>('groups')


  const queryClient = useQueryClient()

  const { data: allTournaments = [] } = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: () => fetchAllTournaments(token),
  })

  const activeTournament = (allTournaments as any[]).find((t: any) => t.active)
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null)
  const tournamentId = selectedTournamentId ?? activeTournament?.id

  const activateMutation = useMutation<any, Error, number>({
    mutationFn: (id) => activateTournament(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] })
      queryClient.invalidateQueries({ queryKey: ['admin-tournament'] })
      queryClient.invalidateQueries({ queryKey: ['active-tournament'] })
      sessionStorage.removeItem('futbol-ar:fixtures-matchday') // Forzar recálculo de fixture activo
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tournament', tournamentId],
    queryFn: () => fetchTournamentData(token, tournamentId),
    enabled: !!tournamentId,
  })

  const { tournament, groups: groupsData, matches: allMatches } = data ?? {}
  const allTeams = useMemo(() => groupsData?.flatMap((g: any) => g.teams) ?? [], [groupsData])

  useEffect(() => {
    if (tournament && !tournament.hasGroups) setActiveTab('bracket')
    else if (tournament?.hasGroups) setActiveTab('groups')
  }, [tournament?.id])

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400">{tournament?.name}</p>
        </div>
        <div className="flex gap-2">
          <a href="/setup"
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
            + Torneo
          </a>
          <button onClick={onLogout}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm transition-colors">
            Salir
          </button>
        </div>
      </div>

      {/* Tournament selector */}
      {allTournaments.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Torneo:</span>
          {(allTournaments as any[]).map((t: any) => (
            <button key={t.id}
              onClick={() => setSelectedTournamentId(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${tournamentId === t.id ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t.name}
              {t.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Activo en la app" />}
            </button>
          ))}
          {tournamentId !== activeTournament?.id && (
            <button
              onClick={() => activateMutation.mutate(tournamentId)}
              disabled={activateMutation.isPending}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-800/50 text-emerald-300 hover:bg-emerald-700/50 transition-colors disabled:opacity-50">
              {activateMutation.isPending ? 'Activando...' : 'Activar en la app'}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
        {tournament?.hasGroups && (
          <button onClick={() => setActiveTab('groups')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'groups' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            Fase de Grupos
          </button>
        )}
        <button onClick={() => setActiveTab('bracket')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === 'bracket' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Trophy size={14} /> Eliminatoria
        </button>
      </div>

      {activeTab === 'groups' && (
        <GroupsSection
          allMatches={allMatches ?? []}
          allTeams={allTeams}
          groupsData={groupsData ?? []}
          token={token}
          editingMatch={editingMatch}
          setEditingMatch={setEditingMatch}
          tournamentId={tournamentId}
          allowCrossGroup={(tournament as any)?.allowCrossGroup ?? false}
        />
      )}

      {activeTab === 'bracket' && (
        <section className="space-y-4">
          <BracketSubTabs
            token={token} tournamentId={tournamentId} tournament={tournament}
            groupsData={groupsData ?? []}
          />
        </section>
      )}
    </div>
  )
}

function AdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(ADMIN_TOKEN_KEY))
  const handleLogout = () => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); setToken(null) }
  if (!token) return <LoginForm onLogin={setToken} />
  return <AdminPanel token={token} onLogout={handleLogout} />
}