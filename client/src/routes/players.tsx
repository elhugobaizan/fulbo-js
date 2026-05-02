import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Globe, Database, UserPlus } from 'lucide-react'
import { useTopScorers, useTopAssists, useTopCards } from '../hooks/usePlayers'
import { useLocalTopScorers, useLocalTopAssists, useLocalTopCards, useTournamentTeams } from '../hooks/useLocalPlayers'
import { useActiveTournament } from '../hooks/useActiveTournament'
import { PlayerModal } from '../components/PlayerModal'
import { TeamBadge } from '../components/TeamBadge'
import { AddPlayerModal } from '../components/AddPlayerModal'
import { LeagueSelector } from '../components/LeagueSelector'
import type { Player } from '../types/football'
import type { LocalPlayer } from '../hooks/useLocalPlayers'

export const Route = createFileRoute('/players')({
  component: PlayersPage,
})

type DataSource = 'api' | 'local'
type Tab = 'scorers' | 'assists' | 'cards'

// ─── Local player row ─────────────────────────────────────────────────────────

function LocalPlayerRow({ player, stat }: { player: LocalPlayer; stat: 'goals' | 'assists' | 'cards' }) {
  const value = stat === 'goals' ? player.goals : stat === 'assists' ? player.assists : player.yellowCards
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyLocal({ tab }: { tab: Tab }) {
  const labels = { scorers: 'goleadores', assists: 'asistidores', cards: 'amonestados' }
  return (
    <div className="rounded-xl border border-gray-800 p-10 text-center">
      <p className="text-gray-400 text-sm">No hay {labels[tab]} registrados todavía</p>
    </div>
  )
}

// ─── Players Page ─────────────────────────────────────────────────────────────

function PlayersPage() {
  const [source, setSource] = useState<DataSource>('local')
  const [tab, setTab] = useState<Tab>('scorers')
  const [leagueId, setLeagueId] = useState(128)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)

  const { data: activeTournament } = useActiveTournament()
  const tournamentId = activeTournament?.id ?? 1

  // API queries
  const { data: apiScorers = [] } = useTopScorers(leagueId)
  const { data: apiAssists = [] } = useTopAssists(leagueId)
  const { data: apiCards = [] } = useTopCards(leagueId)

  // Local queries
  const { data: localScorers = [] } = useLocalTopScorers(tournamentId)
  const { data: localAssists = [] } = useLocalTopAssists(tournamentId)
  const { data: localCards = [] } = useLocalTopCards(tournamentId)
  const { data: teamsList = [] } = useTournamentTeams(tournamentId)

  const apiData = tab === 'scorers' ? apiScorers : tab === 'assists' ? apiAssists : apiCards

  const tabs = [
    { key: 'scorers' as Tab, label: 'Goleadores' },
    { key: 'assists' as Tab, label: 'Asistidores' },
    { key: 'cards' as Tab, label: 'Amonestados' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Estadisticas</h1>
          {source === 'local' && activeTournament && (
            <p className="text-sm text-gray-400 mt-0.5">{activeTournament.shortName ?? activeTournament.name}</p>
          )}
        </div>
        {source === 'local' && (
          <button onClick={() => setShowAddPlayer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors">
            <UserPlus size={14} /> Agregar
          </button>
        )}
      </div>

      {/* Source toggle */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        <button onClick={() => setSource('local')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'local' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Database size={13} /> API Local
        </button>
        <button onClick={() => setSource('api')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${source === 'api' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
          <Globe size={13} /> API Externa
        </button>
      </div>

      {/* League selector for API */}
      {source === 'api' && <LeagueSelector selected={leagueId} onChange={setLeagueId} />}

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Local rankings */}
      {source === 'local' && (
        <div className="space-y-2">
          {tab === 'scorers' && (
            localScorers.length === 0 ? <EmptyLocal tab="scorers" /> :
              localScorers.map((p: LocalPlayer) => <LocalPlayerRow key={p.id} player={p} stat="goals" />)
          )}
          {tab === 'assists' && (
            localAssists.length === 0 ? <EmptyLocal tab="assists" /> :
              localAssists.map((p: LocalPlayer) => <LocalPlayerRow key={p.id} player={p} stat="assists" />)
          )}
          {tab === 'cards' && (
            localCards.length === 0 ? <EmptyLocal tab="cards" /> :
              localCards.map((p: LocalPlayer) => <LocalPlayerRow key={p.id} player={p} stat="cards" />)
          )}
        </div>
      )}

      {/* API rankings */}
      {source === 'api' && (
        <div className="space-y-2">
          {apiData.map((player: Player) => (
            <button key={player.player.id} onClick={() => setSelectedPlayer(player)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors text-left">
              <img src={player.player.photo} alt={player.player.name}
                className="w-10 h-10 rounded-full object-cover bg-gray-800 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${player.player.name}&background=1f2937&color=fff` }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{player.player.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <img src={player.statistics[0]?.team?.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                  <p className="text-xs text-gray-400 truncate">{player.statistics[0]?.team?.name}</p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xl font-bold text-white">
                  {tab === 'scorers' ? player.statistics[0]?.goals?.total ?? 0
                    : tab === 'assists' ? player.statistics[0]?.goals?.assists ?? 0
                      : player.statistics[0]?.cards?.yellow ?? 0}
                </p>
                <p className="text-xs text-gray-500">
                  {tab === 'scorers' ? 'goles' : tab === 'assists' ? 'asist.' : 'amarillas'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      {showAddPlayer && teamsList.length > 0 && (
        <AddPlayerModal
          tournamentId={tournamentId}
          teams={teamsList}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
      {showAddPlayer && teamsList.length === 0 && (
        <AddPlayerModal
          tournamentId={tournamentId}
          teams={[]}
          onClose={() => setShowAddPlayer(false)}
        />
      )}
    </div>
  )
}
