import { createFileRoute, Link } from '@tanstack/react-router'
import { Star, Trash2, Trophy, Users } from 'lucide-react'
import { useFavorites } from '../hooks/useFavorites'
import { TeamBadge } from '../components/TeamBadge'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
})

function FavoritesPage() {
  const { favorites, remove } = useFavorites()

  const byLeague = favorites.reduce<Record<string, typeof favorites>>((acc, fav) => {
    const key = fav.leagueName
    if (!acc[key]) acc[key] = []
    acc[key].push(fav)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Favoritos</h1>
        {favorites.length > 0 && (
          <span className="text-sm text-gray-400">{favorites.length} equipo{favorites.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {favorites.length === 0 && (
        <div className="rounded-xl border border-gray-800 p-12 text-center space-y-3">
          <Star size={32} className="text-gray-700 mx-auto" />
          <p className="text-gray-300 font-medium">No tenés equipos favoritos</p>
          <p className="text-gray-500 text-sm">
            Agregá equipos desde la{' '}
            <Link to="/standings" className="text-[#74ACDF] hover:underline">
              tabla de posiciones
            </Link>
          </p>
        </div>
      )}

      {Object.entries(byLeague).map(([leagueName, teams]) => (
        <div key={leagueName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy size={13} className="text-[#74ACDF]" />
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{leagueName}</h2>
          </div>

          <div className="space-y-2">
            {teams.map((fav) => (
              <div key={fav.teamId}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40">
                <TeamBadge name={fav.teamName} logo={fav.teamLogo} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{fav.teamName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Agregado {new Date(fav.addedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <Link
                  to="/team/$teamId"
                  params={{ teamId: String(fav.teamId) }}
                  search={{ leagueId: fav.leagueId, leagueName: fav.leagueName }}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="Ver plantel"
                >
                  <Users size={15} />
                </Link>
                <button onClick={() => remove(fav.teamId)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-600 hover:text-red-400 transition-colors"
                  title="Quitar de favoritos">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}