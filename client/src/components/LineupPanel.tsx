import { useState, useEffect } from 'react'
import { Check, Users } from 'lucide-react'
import { useMatchLineup, useSetLineup } from '../hooks/useMatchLineup'
import { apiClient } from '../lib/api'

const STORAGE_KEY = 'futbol-ar:admin-token'
const POSITION_ORDER = ['Arquero', 'Defensor', 'Volante', 'Delantero']

type SelectedMap = Record<number, { isStarter: boolean; shirtNumber: string }>

interface Player {
  id: number
  firstName: string
  lastName: string
  position: string | null
  teamId: number
}

interface Team {
  id: number
  name: string
  shortName: string | null
}

interface LineupPanelProps {
  matchId: number
  homeTeam: Team | null
  awayTeam: Team | null
  homePlayers: Player[]
  awayPlayers: Player[]
}

async function authenticate(password: string): Promise<string | null> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.token ?? null
}

function PlayerList({ players, selected, onToggle, onToggleStarter }: {
  players: Player[]
  selected: SelectedMap
  onToggle: (id: number) => void
  onToggleStarter: (id: number) => void
}) {
  const grouped = players.reduce((acc: Record<string, Player[]>, p) => {
    const pos = p.position ?? 'Sin posición'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(p)
    return acc
  }, {})

  const positions = Object.keys(grouped).sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a), bi = POSITION_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1; if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="space-y-3">
      {positions.map(pos => (
        <div key={pos}>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{pos}</p>
          <div className="space-y-1">
            {grouped[pos].map(player => {
              const isSelected = !!selected[player.id]
              const isStarter = selected[player.id]?.isStarter ?? true
              return (
                <div key={player.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-gray-700' : 'bg-gray-800/50 hover:bg-gray-800'}`}>
                  <button onClick={() => onToggle(player.id)} className="flex-1 flex items-center gap-2 text-left">
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[#74ACDF]' : 'border border-gray-600'}`}>
                      {isSelected && <Check size={10} className="text-gray-950" />}
                    </div>
                    <span className={`text-sm truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {player.lastName}, {player.firstName}
                    </span>
                  </button>
                  {isSelected && (
                    <button onClick={() => onToggleStarter(player.id)}
                      className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${isStarter ? 'bg-emerald-700/50 text-emerald-300' : 'bg-gray-600/50 text-gray-400'}`}>
                      {isStarter ? 'TIT' : 'SUP'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LineupPanel({ matchId, homeTeam, awayTeam, homePlayers, awayPlayers }: LineupPanelProps) {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem(STORAGE_KEY))
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')

  // State per team
  const [homeSelected, setHomeSelected] = useState<SelectedMap>({})
  const [awaySelected, setAwaySelected] = useState<SelectedMap>({})

  const { data: lineup = [] } = useMatchLineup(matchId)
  const { mutateAsync: setLineup, isPending } = useSetLineup(matchId)

  // Load existing lineup
  useEffect(() => {
    if (lineup.length === 0) return
    if (homeTeam) {
      const hl = lineup.filter((l: any) => l.teamId === homeTeam.id)
      if (hl.length > 0) {
        const init: SelectedMap = {}
        for (const l of hl) init[l.playerId] = { isStarter: l.isStarter, shirtNumber: String(l.shirtNumber ?? '') }
        setHomeSelected(init)
      }
    }
    if (awayTeam) {
      const al = lineup.filter((l: any) => l.teamId === awayTeam.id)
      if (al.length > 0) {
        const init: SelectedMap = {}
        for (const l of al) init[l.playerId] = { isStarter: l.isStarter, shirtNumber: String(l.shirtNumber ?? '') }
        setAwaySelected(init)
      }
    }
  }, [lineup])

  const selected = activeTeam === 'home' ? homeSelected : awaySelected
  const setSelected = activeTeam === 'home' ? setHomeSelected : setAwaySelected

  const toggle = (id: number) => {
    setSelected((prev: SelectedMap) => {
      if (prev[id]) { const next = { ...prev }; delete next[id]; return next }
      return { ...prev, [id]: { isStarter: true, shirtNumber: '' } }
    })
  }

  const toggleStarter = (id: number) => {
    setSelected((prev: SelectedMap) => ({
      ...prev,
      [id]: { ...prev[id], isStarter: !prev[id].isStarter }
    }))
  }

  const handleSave = async () => {
    if (homeTeam) {
      const players = Object.entries(homeSelected).map(([id, d]) => ({
        playerId: Number(id), isStarter: d.isStarter, shirtNumber: d.shirtNumber ? Number(d.shirtNumber) : null
      }))
      await setLineup({ token, teamId: homeTeam.id, players })
    }
    if (awayTeam) {
      const players = Object.entries(awaySelected).map(([id, d]) => ({
        playerId: Number(id), isStarter: d.isStarter, shirtNumber: d.shirtNumber ? Number(d.shirtNumber) : null
      }))
      await setLineup({ token, teamId: awayTeam.id, players })
    }
  }

  const homeCounts = { starters: Object.values(homeSelected).filter(d => d.isStarter).length, subs: Object.values(homeSelected).filter(d => !d.isStarter).length }
  const awayCounts = { starters: Object.values(awaySelected).filter(d => d.isStarter).length, subs: Object.values(awaySelected).filter(d => !d.isStarter).length }

  const handleAuth = async () => {
    setAuthLoading(true)
    try {
      const newToken = await authenticate(password)
      if (newToken) { sessionStorage.setItem(STORAGE_KEY, newToken); setToken(newToken); setAuthenticated(true) }
      else setAuthError('Password incorrecto')
    } catch { setAuthError('Password incorrecto') }
    finally { setAuthLoading(false) }
  }

  if (!authenticated) {
    return (
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[#74ACDF]" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Alineación</p>
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
      <div className="flex items-center gap-2">
        <Users size={14} className="text-[#74ACDF]" />
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Alineación</p>
      </div>

      {/* Team toggle with counts */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
        <button onClick={() => setActiveTeam('home')}
          className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${activeTeam === 'home' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <span className="font-medium">{homeTeam?.shortName ?? 'Local'}</span>
          <span className="text-xs ml-1 opacity-60">{homeCounts.starters}+{homeCounts.subs}</span>
        </button>
        <button onClick={() => setActiveTeam('away')}
          className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${activeTeam === 'away' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <span className="font-medium">{awayTeam?.shortName ?? 'Visitante'}</span>
          <span className="text-xs ml-1 opacity-60">{awayCounts.starters}+{awayCounts.subs}</span>
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <PlayerList
          players={activeTeam === 'home' ? homePlayers : awayPlayers}
          selected={selected}
          onToggle={toggle}
          onToggleStarter={toggleStarter}
        />
      </div>

      {/* Single save button for both teams */}
      <button onClick={handleSave} disabled={isPending}
        className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        <Check size={14} /> {isPending ? 'Guardando...' : 'Guardar alineación de ambos equipos'}
      </button>
    </div>
  )
}