import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Lock, ChevronRight, ChevronLeft, Plus, X, Check, Trophy, Trash2 } from 'lucide-react'
import { apiClient } from '../lib/api'

const STORAGE_KEY = 'futbol-ar:admin-token'
const WIZARD_KEY = 'futbol-ar:wizard-state'

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchExistingTeams(token: string) {
  const { data } = await apiClient.get('/admin', { params: { action: 'teams' }, headers: { 'x-admin-token': token } })
  return data.data ?? []
}
async function assignTeam(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=assign-team', payload, { headers: { 'x-admin-token': token } })
  return data.data
}
async function removeTeamFromGroup(token: string, groupId: number, teamId: number) {
  await apiClient.delete('/admin?action=remove-team', { params: { groupId, teamId }, headers: { 'x-admin-token': token } })
}
async function createTournament(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=setup-tournament', payload, { headers: { 'x-admin-token': token } })
  return data.data
}
async function createGroup(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=setup-group', payload, { headers: { 'x-admin-token': token } })
  return data.data
}
async function createTeam(token: string, payload: any) {
  const { data } = await apiClient.post('/admin?action=setup-team', payload, { headers: { 'x-admin-token': token } })
  return data.data
}
async function deleteTournament(token: string, tournamentId: number) {
  await apiClient.delete('/admin?action=delete-tournament', {
    params: { tournamentId },
    headers: { 'x-admin-token': token },
  })
}

async function authenticate(password: string): Promise<boolean> {
  const { data } = await apiClient.post('/admin?action=auth', { password })
  return data.data?.authenticated === true
}

// ─── Wizard state persistence ─────────────────────────────────────────────────

interface WizardState {
  step: number
  tournament: any | null
  createdGroups: any[]
  teamsByGroup: Record<number, { id: number; name: string }[]>
}

function loadWizard(): WizardState {
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { step: 0, tournament: null, createdGroups: [], teamsByGroup: {} }
}

function saveWizard(state: WizardState) {
  sessionStorage.setItem(WIZARD_KEY, JSON.stringify(state))
}

function clearWizard() {
  sessionStorage.removeItem(WIZARD_KEY)
}

// ─── Steps indicator ──────────────────────────────────────────────────────────

function Steps({ current }: { current: number }) {
  const steps = ['Torneo', 'Grupos', 'Equipos']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i < current ? 'bg-emerald-600 text-white' : i === current ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-500'}`}>
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          <span className={`text-sm ${i === current ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-700 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Tournament ───────────────────────────────────────────────────────

function Step1({ token, onNext }: { token: string; onNext: (tournament: any) => void }) {
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [season, setSeason] = useState(String(new Date().getFullYear()))
  const [country, setCountry] = useState('')
  const [hasGroups, setHasGroups] = useState(true)
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState('8')
  const [allowCrossGroup, setAllowCrossGroup] = useState(false)

  const mutation = useMutation<any, Error, void>({
    mutationFn: () => createTournament(token, { name, shortName, country, season: Number(season), hasGroups, qualifiersPerGroup: Number(qualifiersPerGroup), allowCrossGroup }),
    onSuccess: (data) => onNext(data),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Nombre completo *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Liga Profesional 2026"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nombre corto</label>
            <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="LPF 2026"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Temporada *</label>
            <input type="number" value={season} onChange={e => setSeason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">País</label>
          <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Argentina, Mundial..."
            className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
          <input type="checkbox" id="hasGroups" checked={hasGroups} onChange={e => setHasGroups(e.target.checked)} className="w-4 h-4 accent-[#74ACDF]" />
          <label htmlFor="hasGroups" className="text-sm text-white cursor-pointer">Tiene fase de grupos</label>
        </div>
        {hasGroups && (
          <>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Clasificados por grupo</label>
              <input type="number" min="1" value={qualifiersPerGroup} onChange={e => setQualifiersPerGroup(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-700">
              <input type="checkbox" id="allowCrossGroup" checked={allowCrossGroup} onChange={e => setAllowCrossGroup(e.target.checked)} className="w-4 h-4 accent-[#74ACDF]" />
              <div>
                <label htmlFor="allowCrossGroup" className="text-sm text-white cursor-pointer">Permitir cruces entre grupos</label>
                <p className="text-xs text-gray-500 mt-0.5">Los partidos pueden ser entre equipos de distintos grupos</p>
              </div>
            </div>
          </>
        )}
      </div>
      {mutation.isError && <p className="text-red-400 text-sm">Error al crear el torneo</p>}
      <button onClick={() => mutation.mutate()} disabled={!name || !season || mutation.isPending}
        className="w-full py-2.5 rounded-xl bg-[#74ACDF] text-gray-950 font-semibold hover:bg-[#5a9fd4] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {mutation.isPending ? 'Creando...' : <><span>Siguiente</span><ChevronRight size={16} /></>}
      </button>
    </div>
  )
}

// ─── Step 2: Groups ───────────────────────────────────────────────────────────

function Step2({ token, tournament, onNext, onBack }: { token: string; tournament: any; onNext: (groups: any[]) => void; onBack: () => void }) {
  const [groupNames, setGroupNames] = useState(['Grupo A', 'Grupo B'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addGroup = () => setGroupNames([...groupNames, `Grupo ${String.fromCharCode(65 + groupNames.length)}`])
  const removeGroup = (i: number) => setGroupNames(groupNames.filter((_, idx) => idx !== i))

  const handleNext = async () => {
    setLoading(true); setError('')
    try {
      const results = []
      for (const name of groupNames) {
        const g = await createGroup(token, { tournamentId: tournament.id, name })
        results.push(g)
      }
      onNext(results)
    } catch { setError('Error al crear los grupos') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Grupos para <span className="text-white">{tournament.name}</span></p>
      <div className="space-y-2">
        {groupNames.map((name, i) => (
          <div key={i} className="flex gap-2">
            <input value={name} onChange={e => setGroupNames(groupNames.map((n, idx) => idx === i ? e.target.value : n))}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
            {groupNames.length > 1 && (
              <button onClick={() => removeGroup(i)} className="p-2 rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addGroup} className="w-full py-2 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 transition-colors text-sm flex items-center justify-center gap-2">
        <Plus size={14} /> Agregar grupo
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-colors flex items-center justify-center gap-2">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button onClick={handleNext} disabled={groupNames.some(n => !n) || loading}
          className="flex-1 py-2.5 rounded-xl bg-[#74ACDF] text-gray-950 font-semibold hover:bg-[#5a9fd4] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? 'Creando...' : <><span>Siguiente</span><ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Teams ────────────────────────────────────────────────────────────

function Step3({ token, groups, teamsByGroup, onTeamAdded, onTeamRemoved, onBack, onDone }: {
  token: string; groups: any[]
  teamsByGroup: Record<number, { id: number; name: string }[]>
  onTeamAdded: (groupId: number, team: { id: number; name: string }) => void
  onTeamRemoved: (groupId: number, teamId: number) => void
  onBack: () => void; onDone: () => void
}) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? null)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [teamName, setTeamName] = useState('')
  const [teamShort, setTeamShort] = useState('')
  const [teamCountry, setTeamCountry] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const { data: existingTeams = [] } = useQuery({
    queryKey: ['all-teams'],
    queryFn: () => fetchExistingTeams(token),
  })

  const allAddedIds = new Set(Object.values(teamsByGroup).flat().map((t: any) => t.id))

  const filteredTeams = (existingTeams as any[]).filter(t =>
    !allAddedIds.has(t.id) && (
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.shortName ?? '').toLowerCase().includes(search.toLowerCase())
    )
  )

  const addExistingTeam = async (team: any) => {
    if (!selectedGroup) return
    setLoading(true)
    try {
      await assignTeam(token, { groupId: selectedGroup, teamId: team.id })
      onTeamAdded(selectedGroup, { id: team.id, name: team.name })
    } finally { setLoading(false) }
  }

  const addNewTeam = async () => {
    if (!teamName || !selectedGroup) return
    setLoading(true)
    try {
      const team = await createTeam(token, { groupId: selectedGroup, name: teamName, shortName: teamShort || teamName.slice(0, 20), country: teamCountry || null })
      onTeamAdded(selectedGroup, { id: team.id, name: teamName })
      setTeamName(''); setTeamShort(''); setTeamCountry('')
    } finally { setLoading(false) }
  }

  const handleRemove = async (groupId: number, teamId: number) => {
    setRemovingId(teamId)
    try {
      await removeTeamFromGroup(token, groupId, teamId)
      onTeamRemoved(groupId, teamId)
    } finally { setRemovingId(null) }
  }

  const totalTeams = Object.values(teamsByGroup).reduce((sum, t) => sum + t.length, 0)
  const currentGroupTeams = teamsByGroup[selectedGroup] ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Agregá los equipos a cada grupo</p>

      {/* Group selector */}
      <div className="flex gap-2 flex-wrap">
        {groups.map(g => (
          <button key={g.id} onClick={() => setSelectedGroup(g.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedGroup === g.id ? 'bg-[#74ACDF] text-gray-950' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {g.name} <span className="opacity-60">({(teamsByGroup[g.id] ?? []).length})</span>
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
        <button onClick={() => setMode('existing')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'existing' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Equipo existente
        </button>
        <button onClick={() => setMode('new')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'new' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          Equipo nuevo
        </button>
      </div>

      {mode === 'existing' && (
        <div className="space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar equipo..."
            className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800">
            {filteredTeams.length === 0
              ? <p className="text-gray-500 text-sm text-center py-4">Sin resultados</p>
              : filteredTeams.map((team: any) => (
                <button key={team.id} onClick={() => addExistingTeam(team)} disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-800 transition-colors">
                  <Plus size={14} className="text-gray-500 flex-shrink-0" />
                  <span className="text-white">{team.name}</span>
                  {team.shortName && team.shortName !== team.name && (
                    <span className="text-gray-500 text-xs ml-auto">{team.shortName}</span>
                  )}
                </button>
              ))
            }
          </div>
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={teamName} onChange={e => setTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewTeam()} placeholder="Nombre completo"
              className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
            <input value={teamShort} onChange={e => setTeamShort(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewTeam()} placeholder="Nombre corto"
              className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          </div>
          <input value={teamCountry} onChange={e => setTeamCountry(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNewTeam()} placeholder="País (opcional)"
            className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#74ACDF]" />
          <button onClick={addNewTeam} disabled={!teamName || loading}
            className="w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Plus size={14} /> {loading ? 'Agregando...' : 'Agregar equipo nuevo'}
          </button>
        </div>
      )}

      {/* Teams in current group */}
      {currentGroupTeams.length > 0 && (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          {currentGroupTeams.map((team, i) => (
            <div key={team.id} className={`flex items-center gap-2 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-800' : ''}`}>
              <Check size={12} className="text-emerald-400 flex-shrink-0" />
              <span className="text-gray-300 flex-1">{team.name}</span>
              <button onClick={() => handleRemove(selectedGroup, team.id)} disabled={removingId === team.id}
                className="p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-400">{totalTeams} equipo{totalTeams !== 1 ? 's' : ''} en total</span>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors flex items-center gap-1">
            <ChevronLeft size={15} /> Atrás
          </button>
          <button onClick={onDone} disabled={totalTeams === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2">
            <Check size={14} /> Finalizar
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Resume Banner ────────────────────────────────────────────────────────────

function ResumeBanner({ state, token, onResume, onDiscard }: {
  state: WizardState; token: string
  onResume: () => void; onDiscard: () => void
}) {
  const [discarding, setDiscarding] = useState(false)

  const handleDiscard = async () => {
    setDiscarding(true)
    try {
      if (state.tournament?.id) {
        await deleteTournament(token, state.tournament.id)
      }
    } finally {
      clearWizard()
      setDiscarding(false)
      onDiscard()
    }
  }

  const stepLabels = ['Datos del torneo', 'Grupos', 'Equipos']
  const totalTeams = Object.values(state.teamsByGroup).reduce((sum, t) => sum + t.length, 0)

  return (
    <div className="rounded-2xl border border-yellow-800/50 bg-yellow-950/20 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trophy size={15} className="text-yellow-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Tenés un torneo sin terminar</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {state.tournament?.name ?? 'Sin nombre'} · Paso {state.step + 1}: {stepLabels[state.step]}
            {totalTeams > 0 && ` · ${totalTeams} equipo${totalTeams !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onResume}
          className="flex-1 py-2 rounded-xl bg-[#74ACDF] text-gray-950 font-semibold text-sm hover:bg-[#5a9fd4] transition-colors">
          Continuar
        </button>
        <button onClick={handleDiscard} disabled={discarding}
          className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50">
          {discarding ? 'Descartando...' : 'Descartar y empezar de cero'}
        </button>
      </div>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const ok = await authenticate(password)
      if (ok) { sessionStorage.setItem(STORAGE_KEY, password); onLogin(password) }
      else setError('Password incorrecto')
    } catch { setError('Password incorrecto') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 rounded-2xl border border-gray-800 bg-gray-900 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
            <Lock size={20} className="text-[#74ACDF]" />
          </div>
          <h1 className="text-xl font-bold text-white">Nuevo Torneo</h1>
        </div>
        <div className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} placeholder="Password"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#74ACDF]" autoFocus />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleSubmit} disabled={loading || !password}
            className="w-full py-2.5 rounded-xl bg-[#74ACDF] text-gray-950 font-semibold disabled:opacity-50">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SetupPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY))

  const [wizardState, setWizardState] = useState<WizardState>(() => loadWizard())
  const [showResume, setShowResume] = useState(() => {
    const saved = loadWizard()
    return saved.step > 0 || saved.tournament !== null
  })

  const update = (patch: Partial<WizardState>) => {
    setWizardState(prev => {
      const next = { ...prev, ...patch }
      saveWizard(next)
      return next
    })
  }

  const handleCancel = () => {
    clearWizard()
    navigate({ to: '/admin' })
  }

  const handleDiscard = () => {
    setWizardState({ step: 0, tournament: null, createdGroups: [], teamsByGroup: {} })
    setShowResume(false)
  }

  if (!token) return <LoginForm onLogin={setToken} />

  if (showResume && (wizardState.step > 0 || wizardState.tournament !== null)) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
              <Trophy size={18} className="text-[#74ACDF]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Nuevo Torneo</h1>
            </div>
          </div>
          <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-white transition-colors">Cancelar</button>
        </div>
        <ResumeBanner
          state={wizardState}
          token={token}
          onResume={() => setShowResume(false)}
          onDiscard={handleDiscard}
        />
      </div>
    )
  }

  const { step, tournament, createdGroups, teamsByGroup } = wizardState

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
            <Trophy size={18} className="text-[#74ACDF]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nuevo Torneo</h1>
            <p className="text-sm text-gray-400">Configuración inicial</p>
          </div>
        </div>
        <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-white transition-colors">
          Cancelar
        </button>
      </div>

      <Steps current={step} />

      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
        {step === 0 && (
          <Step1 token={token} onNext={(t) => update({ tournament: t, step: 1 })} />
        )}
        {step === 1 && tournament && (
          <Step2
            token={token}
            tournament={tournament}
            onNext={(g) => update({ createdGroups: g, teamsByGroup: Object.fromEntries(g.map((gr: any) => [gr.id, []])), step: 2 })}
            onBack={() => update({ step: 0 })}
          />
        )}
        {step === 2 && createdGroups.length > 0 && (
          <Step3
            token={token}
            groups={createdGroups}
            teamsByGroup={teamsByGroup}
            onTeamAdded={(groupId, team) => {
              const next = { ...teamsByGroup, [groupId]: [...(teamsByGroup[groupId] ?? []), team] }
              update({ teamsByGroup: next })
            }}
            onTeamRemoved={(groupId, teamId) => {
              const next = { ...teamsByGroup, [groupId]: (teamsByGroup[groupId] ?? []).filter((t: any) => t.id !== teamId) }
              update({ teamsByGroup: next })
            }}
            onBack={() => update({ step: 1 })}
            onDone={() => { clearWizard(); navigate({ to: '/admin' }) }}
          />
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})
