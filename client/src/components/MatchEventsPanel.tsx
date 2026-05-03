import { useState } from 'react'
import { Trash2, Plus, Lock, Check, Pencil, X } from 'lucide-react'
import { useMatchEvents, useCreateEvent, useDeleteEvent, useUpdateEvent } from '../hooks/useMatchEvents'
import { apiClient } from '../lib/api'

const STORAGE_KEY = 'futbol-ar:admin-token'

const EVENT_TYPES = [
  { value: 'goal', label: '⚽ Gol' },
  { value: 'assist', label: '🅰️ Asistencia' },
  { value: 'yellow', label: '🟨 Amarilla' },
  { value: 'red', label: '🟥 Roja' },
  { value: 'sub', label: '🔄 Sustitución' },
]

const EVENT_LABELS: Record<string, string> = {
  goal: '⚽', assist: '🅰️', yellow: '🟨', red: '🟥', sub: '🔄',
}

async function authenticate(password: string): Promise<boolean> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.authenticated === true
}

interface Player {
  id: number
  firstName: string
  lastName: string
  teamId: number
}

interface Team {
  id: number
  name: string
  shortName: string | null
}

interface MatchEventsPanelProps {
  matchId: number
  homeTeam: Team | null
  awayTeam: Team | null
  homePlayers: Player[]
  awayPlayers: Player[]
}

export function MatchEventsPanel({ matchId, homeTeam, awayTeam, homePlayers, awayPlayers }: MatchEventsPanelProps) {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem(STORAGE_KEY))
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Form state
  const [type, setType] = useState('goal')
  const [minute, setMinute] = useState('')
  const [teamId, setTeamId] = useState(String(homeTeam?.id ?? ''))
  const [playerId, setPlayerId] = useState('')
  const [playerOutId, setPlayerOutId] = useState('')
  const [isPenalty, setIsPenalty] = useState(false)
  const [isOwnGoal, setIsOwnGoal] = useState(false)

  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editMinute, setEditMinute] = useState('')
  const [editPlayerId, setEditPlayerId] = useState('')

  const { data: events = [], isLoading } = useMatchEvents(matchId)
  const { mutate: createEvent, isPending: creating } = useCreateEvent(matchId)
  const { mutate: deleteEvent, isPending: deleting } = useDeleteEvent(matchId)
  const { mutate: updateEvent, isPending: updating } = useUpdateEvent(matchId)

  const startEdit = (event: any) => {
    setEditingEventId(event.id)
    setEditMinute(String(event.minute ?? ''))
    setEditPlayerId(String(event.playerId ?? ''))
  }

  const handleUpdate = (event: any) => {
    updateEvent({
      token,
      eventId: event.id,
      payload: {
        minute: editMinute ? Number(editMinute) : null,
        playerId: editPlayerId ? Number(editPlayerId) : null,
      },
    }, { onSuccess: () => setEditingEventId(null) })
  }

  const selectedTeamId = Number(teamId)
  const allPlayers = [...homePlayers, ...awayPlayers]
  const teamPlayers = allPlayers.filter(p => p.teamId === selectedTeamId)

  const handleAuth = async () => {
    setAuthLoading(true)
    try {
      const ok = await authenticate(password)
      if (ok) { sessionStorage.setItem(STORAGE_KEY, password); setToken(password); setAuthenticated(true) }
      else setAuthError('Password incorrecto')
    } catch { setAuthError('Password incorrecto') }
    finally { setAuthLoading(false) }
  }

  const handleCreate = () => {
    if (!type || !teamId) return
    createEvent({
      token,
      payload: {
        matchId,
        type,
        minute: minute ? Number(minute) : null,
        teamId: Number(teamId),
        playerId: playerId ? Number(playerId) : null,
        playerOutId: (type === 'sub' && playerOutId) ? Number(playerOutId) : null,
        isPenalty,
        isOwnGoal,
      },
    }, {
      onSuccess: () => {
        setMinute('')
        setPlayerId('')
        setPlayerOutId('')
        setIsPenalty(false)
        setIsOwnGoal(false)
      },
    })
  }

  const handleDelete = (eventId: number) => {
    deleteEvent({ token, eventId })
  }

  if (!authenticated) {
    return (
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Incidencias</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Lock size={12} /><span>Password para cargar incidencias</span>
        </div>
        <div className="flex gap-2">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Password"
            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          <button onClick={handleAuth} disabled={!password || authLoading}
            className="px-3 py-1.5 rounded-lg bg-[#74ACDF] text-gray-950 font-medium text-sm disabled:opacity-50">
            {authLoading ? '...' : 'OK'}
          </button>
        </div>
        {authError && <p className="text-red-400 text-xs">{authError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-3 border-t border-gray-800">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Incidencias</p>

      {/* Existing events */}
      {isLoading ? (
        <div className="animate-pulse space-y-1">
          {[1, 2].map(i => <div key={i} className="h-7 bg-gray-800 rounded-lg" />)}
        </div>
      ) : events.length > 0 ? (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {events.map((event) => {
            const eventTeamPlayers = allPlayers.filter((p: any) => p.teamId === event.teamId)
            const isEditing = editingEventId === event.id
            return (
              <div key={event.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-8 text-right text-xs">{event.minute ? `${event.minute}'` : '–'}</span>
                  <span>{EVENT_LABELS[event.type] ?? event.type}</span>
                  <span className={`text-xs flex-1 truncate ${event.teamId === homeTeam?.id ? 'text-white' : 'text-gray-400'}`}>
                    {event.player ? `${event.player.firstName} ${event.player.lastName}` : event.team?.shortName ?? '?'}
                    {event.isPenalty && ' (pen.)'}
                    {event.isOwnGoal && ' (e.c.)'}
                  </span>
                  <button onClick={() => isEditing ? setEditingEventId(null) : startEdit(event)}
                    className="p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-[#74ACDF] transition-colors flex-shrink-0">
                    {isEditing ? <X size={12} /> : <Pencil size={12} />}
                  </button>
                  <button onClick={() => handleDelete(event.id)} disabled={deleting}
                    className="p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                {isEditing && (
                  <div className="flex gap-1.5 pl-10">
                    <input type="number" value={editMinute} onChange={e => setEditMinute(e.target.value)}
                      placeholder="Min" className="w-14 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]" />
                    <select value={editPlayerId} onChange={e => setEditPlayerId(e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
                      <option value="">Sin jugador</option>
                      {eventTeamPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>)}
                    </select>
                    <button onClick={() => handleUpdate(event)} disabled={updating}
                      className="px-2 py-1 rounded bg-[#74ACDF] text-gray-950 text-xs font-medium disabled:opacity-50">
                      <Check size={12} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-600">Sin incidencias cargadas</p>
      )}

      {/* Add event form */}
      <div className="space-y-2 pt-2 border-t border-gray-800/60">
        <div className="grid grid-cols-3 gap-2">
          {/* Tipo */}
          <select value={type} onChange={e => { setType(e.target.value); setPlayerId(''); setPlayerOutId('') }}
            className="col-span-2 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {/* Minuto */}
          <input type="number" min="1" max="120" value={minute} onChange={e => setMinute(e.target.value)}
            placeholder="Min"
            className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]" />
        </div>

        {/* Equipo */}
        <div className="flex gap-1">
          {[homeTeam, awayTeam].filter(Boolean).map(t => (
            <button key={t!.id} onClick={() => { setTeamId(String(t!.id)); setPlayerId('') }}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${Number(teamId) === t!.id ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t!.shortName ?? t!.name}
            </button>
          ))}
        </div>

        {/* Jugador */}
        {type !== 'sub' ? (
          <select value={playerId} onChange={e => setPlayerId(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
            <option value="">Jugador (opcional)</option>
            {teamPlayers.map(p => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>)}
          </select>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <select value={playerId} onChange={e => setPlayerId(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
              <option value="">Entra</option>
              {teamPlayers.map(p => <option key={p.id} value={p.id}>ˋ${p.lastName}, ${p.firstName.slice(0,1)}.ˋ</option>)}
            </select>
            <select value={playerOutId} onChange={e => setPlayerOutId(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-[#74ACDF]">
              <option value="">Sale</option>
              {teamPlayers.map(p => <option key={p.id} value={p.id}>ˋ${p.lastName}, ${p.firstName.slice(0,1)}ˋ</option>)}
            </select>
          </div>
        )}

        {/* Checkboxes */}
        {type === 'goal' && (
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={isPenalty} onChange={e => setIsPenalty(e.target.checked)} className="accent-[#74ACDF]" />
              Penal
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={isOwnGoal} onChange={e => setIsOwnGoal(e.target.checked)} className="accent-[#74ACDF]" />
              En contra
            </label>
          </div>
        )}

        <button onClick={handleCreate} disabled={creating || !teamId}
          className="w-full py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
          <Plus size={12} /> {creating ? 'Guardando...' : 'Agregar incidencia'}
        </button>
      </div>
    </div>
  )
}
