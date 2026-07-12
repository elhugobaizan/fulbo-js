import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import { useLocalTopScorers, useLocalTopCards, useTournamentTeams } from '../hooks/useLocalPlayers'
import { useActiveTournament } from '../hooks/useActiveTournament'
import { TeamBadge } from '../components/TeamBadge'
import { AddPlayerModal } from '../components/AddPlayerModal'
import type { LocalPlayer } from '../hooks/useLocalPlayers'

export const Route = createFileRoute('/players')({
  component: PlayersPage,
})

type Tab = 'scorers' | 'cards'

// País del jugador: country del club, o el nombre de la selección (que ES el país)
function playerCountry(p: LocalPlayer): string | null {
  return p.team?.country ?? p.team?.name ?? null
}

function LocalPlayerRow({ player, stat }: { player: LocalPlayer; stat: 'goals' | 'cards' }) {
  const value = stat === 'goals' ? player.goals : player.yellowCards
  const name = `${player.firstName} ${player.lastName}`
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40">
      <TeamBadge name={player.team?.name ?? '?'} logo={player.team?.logoUrl} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-gray-400 truncate">{player.team?.shortName ?? player.team?.name ?? '?'}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xl font-bold text-white">{value}</p>
        {stat === 'cards' && player.redCards > 0 && (
          <p className="text-xs text-red-400">+{player.redCards} rojas</p>
        )}
      </div>
    </div>
  )
}

function EmptyLocal({ tab }: { tab: Tab }) {
  const labels = { scorers: 'goleadores', cards: 'amonestados' }
  return (
    <div className="rounded-xl border border-gray-800 p-10 text-center">
      <p className="text-gray-400 text-sm">No hay {labels[tab]} registrados todavía</p>
    </div>
  )
}

function PlayersPage() {
  const [tab, setTab] = useState<Tab>('scorers')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [countryFilter, setCountryFilter] = useState('')

  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1

  const { data: localScorers = [] } = useLocalTopScorers(tournamentId)
  const { data: localCards = [] } = useLocalTopCards(tournamentId)
  const { data: teamsList = [] } = useTournamentTeams(tournamentId)

  const tabs = [
    { key: 'scorers' as Tab, label: 'Goleadores' },
    { key: 'cards' as Tab, label: 'Amonestados' },
  ]

  // Países presentes entre los goleadores (para el filtro)
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const p of localScorers as LocalPlayer[]) {
      const c = playerCountry(p)
      if (c) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [localScorers])

  const filteredScorers = useMemo(() => {
    if (!countryFilter) return localScorers as LocalPlayer[]
    return (localScorers as LocalPlayer[]).filter(p => playerCountry(p) === countryFilter)
  }, [localScorers, countryFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Estadísticas</h1>
          {activeTournament && (
            <p className="text-sm text-gray-400 mt-0.5">{activeTournament.shortName ?? activeTournament.name}</p>
          )}
        </div>
        <button onClick={() => setShowAddPlayer(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors">
          <UserPlus size={14} /> Agregar
        </button>
      </div>

      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'scorers' && countries.length > 1 && (
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:border-[#74ACDF]">
          <option value="">Todos los países</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <div className="space-y-2">
        {tab === 'scorers' && (
          filteredScorers.length === 0 ? <EmptyLocal tab="scorers" /> :
            filteredScorers.map((p: LocalPlayer) => <LocalPlayerRow key={p.id} player={p} stat="goals" />)
        )}
        {tab === 'cards' && (
          localCards.length === 0 ? <EmptyLocal tab="cards" /> :
            localCards.map((p: LocalPlayer) => <LocalPlayerRow key={p.id} player={p} stat="cards" />)
        )}
      </div>

      {showAddPlayer && (
        <AddPlayerModal
          tournamentId={tournamentId}
          teams={teamsList}
          isNational={activeTournament?.teamType === 'national'}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
    </div>
  )
}
