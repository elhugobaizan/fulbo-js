import { useState } from 'react'
import { X, Download, Check, AlertCircle, Lock, ChevronRight, Link } from 'lucide-react'
import { useCreateEvent } from '../hooks/useMatchEvents'
import { useSetLineup } from '../hooks/useMatchLineup'
import { useCreatePlayer, useEditPlayer } from '../hooks/useLocalPlayers'
import { apiClient } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

const STORAGE_KEY = 'futbol-ar:admin-token'

const LEAGUE_SLUGS = [
  { label: 'Liga Profesional Argentina', value: 'arg.1' },
  { label: 'Copa Libertadores', value: 'conmebol.libertadores' },
  { label: 'Copa Sudamericana', value: 'conmebol.sudamericana' },
  { label: 'Champions League', value: 'uefa.champions' },
  { label: 'Premier League', value: 'eng.1' },
  { label: 'La Liga', value: 'esp.1' },
  { label: 'Serie A', value: 'ita.1' },
  { label: 'Bundesliga', value: 'ger.1' },
  { label: 'Ligue 1', value: 'fra.1' },
]

const EVENT_LABELS: Record<string, string> = { goal: '⚽', yellow: '🟨', red: '🟥', sub: '🔄', assist: '🅰️', save: '🧤' }

const POSITION_MAP: Record<string, string> = {
  'G': 'Arquero',
  'CD-L': 'Defensor',
  'CD-R': 'Defensor',
  'LB': 'Defensor',
  'RB': 'Defensor',
  'AM': 'Volante',
  'CM': 'Volante',
  'CM-L': 'Volante',
  'CM-R': 'Volante',
  'AM-L': 'Volante',
  'AM-R': 'Volante',
  'LM': 'Volante',
  'RM': 'Volante',
  'F': 'Delantero',
  'LF': 'Delantero',
  'RF': 'Delantero',
  'RCF': 'Delantero',
}

async function authenticate(password: string): Promise<boolean> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.authenticated === true
}

async function fetchESPNSummary(eventId: string, league: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`)
  return res.json()
}

function extractESPNTeams(data: any): { id: string; name: string }[] {
  const competitors = data?.header?.competitions?.[0]?.competitors ?? []
  return competitors.map((c: any) => ({ id: c.team?.id, name: c.team?.displayName }))
}

function parseMinute(clock: any): number | null {
  // displayValue can be "90 + 3" for added time
  const display = clock?.displayValue ?? ''
  const added = display.match(/(\d+)\s*\'\+\s*(\d+)\'/)
  if (added) return Number(added[1]) + Number(added[2])
  const plain = display.match(/(\d+)/)
  if (plain) return Number(plain[1])
  if (clock?.value) return Math.floor(clock.value / 60)
  return null
}

function parseEvents(data: any, espnHomeId: string, espnAwayId: string, homeTeamId: number, awayTeamId: number, lineups?: { home: any[]; away: any[] }) {
  const events: any[] = []
  for (const event of data?.keyEvents ?? []) {
    const type = event.type?.type ?? ''
    const text = event.text ?? ''
    const minute = parseMinute(event.clock)
    const espnTeamId = event.team?.id
    const teamId = espnTeamId === espnHomeId ? homeTeamId : espnTeamId === espnAwayId ? awayTeamId : null
    if (!teamId) continue

    const isPenaltySaved = type.includes('saved')
    if (isPenaltySaved) {
      // Register save event for the goalkeeper of the opposing team
      const savingTeamId = teamId === homeTeamId ? awayTeamId : homeTeamId
      const savingRoster = teamId === homeTeamId ? lineups?.away : lineups?.home
      const goalkeeper = savingRoster?.find((p: any) => p.position === 'Arquero' && p.isStarter)
      events.push({ type: 'save', minute, teamId: savingTeamId, playerName: goalkeeper?.name ?? null })
      continue
    }
    const isGoalType = type === 'goal' || type.startsWith('goal') || type === 'penalty' || type.startsWith('penalty') || type === 'own-goal'
    const isPenalty = type === 'penalty' || text.toLowerCase().includes('penalty') || text.toLowerCase().includes('penal')
    const isOwnGoal = text.toLowerCase().includes('own goal') || text.toLowerCase().includes('en contra') || type === 'own-goal'

    if (isGoalType) {
      events.push({ type: 'goal', minute, teamId, playerName: event.participants?.[0]?.athlete?.displayName ?? null, isPenalty, isOwnGoal })
    } else if (type === 'yellow-card') {
      events.push({ type: 'yellow', minute, teamId, playerName: event.participants?.[0]?.athlete?.displayName ?? null })
    } else if (type === 'red-card') {
      events.push({ type: 'red', minute, teamId, playerName: event.participants?.[0]?.athlete?.displayName ?? null })
    } else if (type === 'substitution') {
      events.push({ type: 'sub', minute, teamId, playerInName: event.participants?.[0]?.athlete?.displayName ?? null, playerOutName: event.participants?.[1]?.athlete?.displayName ?? null })
    }
  }
  return events
}

function parseLineups(data: any) {
  const rosters = data?.rosters ?? []
  const home = rosters.find((r: any) => r.homeAway === 'home')
  const away = rosters.find((r: any) => r.homeAway === 'away')
  const parseRoster = (roster: any) => (roster?.roster ?? []).map((p: any) => ({
    name: p.athlete?.displayName ?? '?',
    shirtNumber: p.jersey ? Number(p.jersey) : null,
    isStarter: p.starter ?? true,
    position: POSITION_MAP[p.position?.abbreviation] ?? null,
  }))
  return { home: parseRoster(home), away: parseRoster(away) }
}

// Extract unique player names from events + lineups
function extractPlayerNames(events: any[], lineups: { home: any[]; away: any[] }, homeTeamId: number, awayTeamId: number): { name: string; teamId: number }[] {
  const seen = new Set<string>()
  const players: { name: string; teamId: number }[] = []
  const add = (name: string, teamId: number) => {
    if (name && !seen.has(name)) { seen.add(name); players.push({ name, teamId }) }
  }
  // From lineups first (most complete)
  for (const p of lineups.home) add(p.name, homeTeamId)
  for (const p of lineups.away) add(p.name, awayTeamId)
  // From events
  for (const e of events) {
    for (const name of [e.playerName, e.playerInName, e.playerOutName]) {
      add(name, e.teamId)
    }
  }
  return players
}


// Try to find matching player by last name
function findMatch(espnName: string, players: any[]): any | null {
  const lastName = espnName.split(' ').slice(-1)[0].toLowerCase()
  return players.find(p =>
    p.lastName.toLowerCase() === lastName ||
    `${p.firstName} ${p.lastName}`.toLowerCase() === espnName.toLowerCase()
  ) ?? null
}

interface ESPNImportModalProps {
  matchId: number
  homeTeam: { id: number; name: string; shortName: string | null } | null
  awayTeam: { id: number; name: string; shortName: string | null } | null
  homePlayers: any[]
  awayPlayers: any[]
  tournamentId: number
  onClose: () => void
}

type ImportStep = 'auth' | 'input' | 'mapping' | 'reconcile' | 'preview' | 'done'

export function ESPNImportModal({ matchId, homeTeam, awayTeam, homePlayers, awayPlayers, tournamentId, onClose }: ESPNImportModalProps) {
  const [step, setStep] = useState<ImportStep>(() => sessionStorage.getItem(STORAGE_KEY) ? 'input' : 'auth')
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [league, setLeague] = useState('arg.1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [espnTeams, setEspnTeams] = useState<{ id: string; name: string }[]>([])
  const [espnHomeId, setEspnHomeId] = useState('')
  const [espnAwayId, setEspnAwayId] = useState('')
  const [rawData, setRawData] = useState<any>(null)
  const [parsedEvents, setParsedEvents] = useState<any[]>([])
  const [parsedLineups, setParsedLineups] = useState<{ home: any[]; away: any[] }>({ home: [], away: [] })
  const [importEvents, setImportEvents] = useState(true)
  const [importLineup, setImportLineup] = useState(true)
  const [importNewPlayers, setImportNewPlayers] = useState(true)
  const [saving, setSaving] = useState(false)

  // Reconciliation: espnName → { action: 'new' | 'existing' | 'edit', playerId?: number }
  const [reconciliation, setReconciliation] = useState<Record<string, { action: 'new' | 'existing' | 'edit'; playerId?: number }>>({})
  const [espnPlayerList, setEspnPlayerList] = useState<{ name: string; teamId: number }[]>([])

  const { mutateAsync: createEvent } = useCreateEvent(matchId)
  const { mutateAsync: setLineup } = useSetLineup(matchId)
  const { mutateAsync: createPlayer } = useCreatePlayer()
  const { mutateAsync: editPlayer } = useEditPlayer()
  const queryClient = useQueryClient()

  const handleAuth = async () => {
    setAuthLoading(true)
    try {
      const ok = await authenticate(password)
      if (ok) { sessionStorage.setItem(STORAGE_KEY, password); setToken(password); setStep('input') }
      else setAuthError('Password incorrecto')
    } catch { setAuthError('Password incorrecto') }
    finally { setAuthLoading(false) }
  }

  const handleFetch = async () => {
    setLoading(true); setError('')
    try {
      const m = url.match(/juegoId\/(\d+)/) ?? url.match(/gameId\/(\d+)/) ?? url.match(/event=(\d+)/) ?? url.match(/\/(\d+)$/)
      if (!m) throw new Error('No se pudo extraer el ID del partido de la URL')
      const data = await fetchESPNSummary(m[1], league)
      const teams = extractESPNTeams(data)
      setEspnTeams(teams)
      setRawData(data)
      if (teams.length >= 2) { setEspnHomeId(teams[0].id); setEspnAwayId(teams[1].id) }
      setStep('mapping')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleMapping = () => {
    const lineups = parseLineups(rawData)
    const events = parseEvents(rawData, espnHomeId, espnAwayId, homeTeam?.id ?? 0, awayTeam?.id ?? 0, lineups)
    const playerNames = extractPlayerNames(events, lineups, homeTeam?.id ?? 0, awayTeam?.id ?? 0)
    setParsedEvents(events)
    setParsedLineups(lineups)
    setEspnPlayerList(playerNames)

    // Auto-match players
    const init: Record<string, { action: 'new' | 'existing' | 'edit'; playerId?: number }> = {}
    for (const { name, teamId } of playerNames) {
      const teamPlayers = teamId === homeTeam?.id ? homePlayers : awayPlayers
      const match = findMatch(name, teamPlayers)
      init[name] = match ? (!match.position ? { action: 'edit', playerId: match.id } : { action: 'existing', playerId: match.id }) : { action: 'new' }
    }
    setReconciliation(init)
    setStep('reconcile')
  }

  const handleImport = async () => {
    setSaving(true); setError('')
    try {
      // Step 1: Build playerId map — first from existing reconciliation
      const playerIdMap: Record<string, number> = {}
      for (const [name, rec] of Object.entries(reconciliation)) {
        if ((rec.action === 'existing' || rec.action === 'edit') && rec.playerId) {
          playerIdMap[name] = rec.playerId
        }
      }

      // Step 2: Create new players and await each one
      for (const { name, teamId } of espnPlayerList) {
        const rec = reconciliation[name]
        if (!rec || rec.action === 'existing') continue
        const parts = name.trim().split(' ')
        const firstName = parts[0]
        const lastName = parts.slice(1).join(' ') || parts[0]
        const lineupEntry = [...parsedLineups.home, ...parsedLineups.away].find(p => p.name === name)
        const newPlayer = rec.action === 'new' ? await createPlayer({
          token,
          payload: { firstName, lastName, teamId, tournamentId, position: lineupEntry?.position ?? '' }
        }) : await editPlayer({
          token,
          playerId: rec.playerId!,
          payload: { firstName, lastName, teamId, tournamentId, position: lineupEntry?.position ?? '' }
        })
        if (newPlayer?.id) playerIdMap[name] = newPlayer.id
      }

      // Step 3: Save lineup
      if (importLineup) {
        if (homeTeam && parsedLineups.home.length > 0) {
          const players = parsedLineups.home
            .map(p => ({ playerId: playerIdMap[p.name], isStarter: p.isStarter, shirtNumber: p.shirtNumber }))
            .filter(p => p.playerId)
          await setLineup({ token, teamId: homeTeam.id, players })
        }
        if (awayTeam && parsedLineups.away.length > 0) {
          const players = parsedLineups.away
            .map(p => ({ playerId: playerIdMap[p.name], isStarter: p.isStarter, shirtNumber: p.shirtNumber }))
            .filter(p => p.playerId)
          await setLineup({ token, teamId: awayTeam.id, players })
        }
      }

      // Step 4: Save events — always require a playerId
      if (importEvents) {
        for (const event of parsedEvents) {
          const pName = event.playerName ?? event.playerInName
          const playerId = pName ? playerIdMap[pName] : undefined
          if (!playerId) continue // skip events without a resolvable player
          await createEvent({
            token, payload: {
              matchId, type: event.type, minute: event.minute,
              teamId: event.teamId, playerId,
              isPenalty: event.isPenalty ?? false,
              isOwnGoal: event.isOwnGoal ?? false,
            }
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['match-events', matchId] })
      queryClient.invalidateQueries({ queryKey: ['match-detail', matchId] })
      setStep('done')
    } catch (e: any) { setError('Error al importar: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md pointer-events-auto"
          style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
            <span className="font-semibold text-white text-sm">Importar desde ESPN</span>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
          </div>

          <div className="px-5 py-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(85vh - 60px)' }}>

            {step === 'auth' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400"><Lock size={12} /><span>Password de admin</span></div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Password"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" autoFocus />
                {authError && <p className="text-red-400 text-xs">{authError}</p>}
                <button onClick={handleAuth} disabled={!password || authLoading}
                  className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50">
                  {authLoading ? 'Verificando...' : 'Verificar'}
                </button>
              </div>
            )}

            {step === 'input' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">URL del partido en ESPN</label>
                  <input value={url} onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.espn.com.ar/futbol/alineacion/_/juegoId/762971"
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Liga</label>
                  <select value={league} onChange={e => setLeague(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
                    {LEAGUE_SLUGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                {error && <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                <button onClick={handleFetch} disabled={!url || loading}
                  className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <Download size={14} />{loading ? 'Buscando...' : 'Obtener datos'}
                </button>
              </div>
            )}

            {step === 'mapping' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Confirmá qué equipo de ESPN corresponde a cada equipo:</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">ESPN → {homeTeam?.name}</label>
                    <select value={espnHomeId} onChange={e => setEspnHomeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
                      {espnTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">ESPN → {awayTeam?.name}</label>
                    <select value={espnAwayId} onChange={e => setEspnAwayId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
                      {espnTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('input')} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Atrás</button>
                  <button onClick={handleMapping} disabled={!espnHomeId || !espnAwayId}
                    className="flex-1 py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    <ChevronRight size={14} /> Siguiente
                  </button>
                </div>
              </div>
            )}

            {step === 'reconcile' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Verificá los jugadores detectados en los eventos:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {espnPlayerList.map(({ name, teamId }) => {
                    const rec = reconciliation[name] ?? { action: 'new' }
                    const teamPlayers = teamId === homeTeam?.id ? homePlayers : awayPlayers
                    const teamName = teamId === homeTeam?.id ? homeTeam?.shortName : awayTeam?.shortName
                    const pendingId = rec.action === 'existing' ? rec.playerId : (findMatch(name, teamPlayers)?.id ?? teamPlayers[0]?.id)
                    return (
                      <div key={name} className="rounded-lg border border-gray-800 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-white">{name}</span>
                            <span className="text-xs text-gray-500 ml-2">{teamName}</span>
                          </div>
                          {(rec.action === 'existing' || rec.action === 'edit') ? (
                            <button onClick={() => setReconciliation(prev => ({ ...prev, [name]: { action: 'new' } }))}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-700 text-white hover:bg-red-800 hover:text-white transition-colors">
                              <Check size={10} /> Vinculado {rec.action === 'edit' ? '(editar)' : ''}
                            </button>
                          ) : (
                            <button onClick={() => setReconciliation(prev => ({ ...prev, [name]: { action: 'existing', playerId: pendingId } }))}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:text-white transition-colors">
                              <Link size={10} /> Vincular
                            </button>
                          )}
                        </div>
                        {(() => {
                          return (
                            <select
                              value={rec.action === 'existing' ? (rec.playerId ?? '') : (findMatch(name, teamPlayers)?.id ?? '')}
                              onChange={e => setReconciliation(prev => ({ ...prev, [name]: { action: 'existing', playerId: Number(e.target.value) } }))}
                              disabled={rec.action === 'existing'}
                              className={`w-full px-2 py-1 rounded border text-xs focus:outline-none ${rec.action === 'existing' ? 'bg-gray-900 border-emerald-700/50 text-gray-300 cursor-default' : 'bg-gray-800 border-gray-700 text-white focus:border-[#74ACDF]'}`}>
                              <option value="">Sin vincular</option>
                              {teamPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>)}
                            </select>
                          )
                        })()}
                        {rec.action === 'new' && (
                          <p className="text-xs text-gray-600">Se creará el jugador y se guardará el evento en la BD</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep('mapping')} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Atrás</button>
                  <button onClick={() => setStep('preview')}
                    className="flex-1 py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm flex items-center justify-center gap-2">
                    <ChevronRight size={14} /> Ver preview
                  </button>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={importEvents} onChange={e => setImportEvents(e.target.checked)} className="accent-[#74ACDF]" />
                    <span className="text-sm text-white">Incidencias ({parsedEvents.length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={importLineup} onChange={e => setImportLineup(e.target.checked)} className="accent-[#74ACDF]" />
                    <span className="text-sm text-white">Alineación</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={importNewPlayers} onChange={e => setImportNewPlayers(e.target.checked)} className="accent-[#74ACDF]" />
                    <span className="text-sm text-white">Nuevos ({Object.keys(reconciliation).filter(key => reconciliation[key].action === 'new').length})</span>
                  </label>
                </div>

                {importEvents && parsedEvents.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Incidencias</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {parsedEvents.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                          <span className="w-8 text-right text-xs text-gray-500">{e.minute ? `${e.minute}'` : '–'}</span>
                          <span>{EVENT_LABELS[e.type] ?? e.type}</span>
                          <span className="flex-1 truncate">
                            {e.playerName ?? e.playerInName ?? '–'}
                            {reconciliation[e.playerName ?? e.playerInName ?? '']?.action === 'existing' && (
                              <span className="text-emerald-500 ml-1 text-xs">✓</span>
                            )}
                          </span>
                          <span className="text-xs text-gray-600">{e.teamId === homeTeam?.id ? homeTeam?.shortName : awayTeam?.shortName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setStep('reconcile')} disabled={saving} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50">Atrás</button>
                  <button onClick={handleImport} disabled={saving || (!importEvents && !importLineup)}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check size={14} />{saving ? 'Importando...' : 'Importar'}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto">
                  <Check size={24} className="text-emerald-400" />
                </div>
                <p className="text-white font-medium">Importado correctamente</p>
                <button onClick={onClose} className="w-full py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cerrar</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}