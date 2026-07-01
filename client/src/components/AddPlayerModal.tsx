import { useState } from 'react'
import { X, UserPlus, Lock } from 'lucide-react'
import { useCreatePlayer } from '../hooks/useLocalPlayers'
import { apiClient } from '../lib/api'

const STORAGE_KEY = 'futbol-ar:admin-token'

interface Team { id: number; name: string; shortName: string | null }

interface AddPlayerModalProps {
  tournamentId: number
  teams: Team[]
  defaultTeamId?: number
  onClose: () => void
}

async function authenticate(password: string): Promise<string | null> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.token ?? null
}

export function AddPlayerModal({ tournamentId, teams, defaultTeamId, onClose }: AddPlayerModalProps) {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem(STORAGE_KEY))
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [teamId, setTeamId] = useState(String(defaultTeamId ?? teams[0]?.id ?? ''))
  const [position, setPosition] = useState('Defensor')
  const [success, setSuccess] = useState(false)

  const { mutate: createPlayer, isPending } = useCreatePlayer()

  const handleAuth = async () => {
    setAuthLoading(true)
    try {
      const newToken = await authenticate(password)
      if (newToken) {
        sessionStorage.setItem(STORAGE_KEY, newToken)
        setToken(newToken)
        setAuthenticated(true)
      } else setAuthError('Password incorrecto')
    } catch { setAuthError('Password incorrecto') }
    finally { setAuthLoading(false) }
  }

  const handleSave = () => {
    if (!firstName || !lastName || !teamId) return
    createPlayer({
      token,
      payload: { firstName, lastName, teamId: Number(teamId), tournamentId, position },
    }, {
      onSuccess: () => {
        setFirstName('')
        setLastName('')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      },
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm p-6 space-y-4"
        style={{ transform: 'translate(-50%, -50%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-[#74ACDF]" />
            <h3 className="font-bold text-white">Agregar jugador</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {!authenticated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Lock size={12} /><span>Password de admin</span>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Password"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" autoFocus />
            {authError && <p className="text-red-400 text-xs">{authError}</p>}
            <button onClick={handleAuth} disabled={!password || authLoading}
              className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50">
              {authLoading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Juan"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Apellido *</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Pérez"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Posición *</label>
                <select value={position} onChange={e => setPosition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
                  {['Arquero', 'Defensor', 'Volante', 'Delantero'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Equipo *</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            {success && <p className="text-emerald-400 text-xs text-center">Jugador agregado</p>}
            <button onClick={handleSave} disabled={!firstName || !lastName || !teamId || isPending}
              className="w-full py-2 rounded-lg bg-[#74ACDF] text-gray-950 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus size={14} /> {isPending ? 'Guardando...' : 'Agregar jugador'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}