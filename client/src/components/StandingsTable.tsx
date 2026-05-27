import { Star } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { Standing } from '../types/football'
import { FormIndicator } from './FormIndicator'
import { useFavorites } from '../hooks/useFavorites'

interface StandingsTableProps {
  standings: Standing[]
  leagueId: number
  leagueName: string
  teamType?: string
}

function getDescriptionStyle(description: string | null): string {
  if (!description) return ''
  const d = description.toLowerCase()
  if (d.includes('champion') || d.includes('campeón')) return 'border-l-2 border-yellow-400'
  if (d.includes('promotion') || d.includes('libertadores')) return 'border-l-2 border-emerald-500'
  if (d.includes('sudamericana') || d.includes('playoff')) return 'border-l-2 border-blue-400'
  if (d.includes('relegation') || d.includes('descenso')) return 'border-l-2 border-red-500'
  return ''
}

export function StandingsTable({ standings, leagueId, leagueName, teamType }: StandingsTableProps) {
  const { toggle, isFavorite } = useFavorites()
  const navigate = useNavigate()

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
            <th className="text-left pl-4 pr-2 py-3 w-8">#</th>
            <th className="text-left px-2 py-3">Equipo</th>
            <th className="text-center px-2 py-3 w-10">PJ</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">G</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">E</th>
            <th className="text-center px-2 py-3 w-10 hidden sm:table-cell">P</th>
            <th className="text-center px-2 py-3 w-10 hidden md:table-cell">GF</th>
            <th className="text-center px-2 py-3 w-10 hidden md:table-cell">GC</th>
            <th className="text-center px-2 py-3 w-10">DG</th>
            <th className="text-center px-2 py-3 w-12 font-bold text-white">PTS</th>
            <th className="text-center px-3 py-3 hidden lg:table-cell">Forma</th>
            <th className="w-10 pr-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {standings.map((standing, index) => {
            const fav = isFavorite(standing.team.id)
            return (
              <tr
                key={standing.team.id}
                className={`
                  group transition-colors hover:bg-gray-800/50 cursor-pointer
                  ${index % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'}
                  ${getDescriptionStyle(standing.description)}
                `}
                onClick={() => navigate({ to: '/team/$teamId', params: { teamId: String(standing.team.id) }, search: { leagueId, leagueName } })}
              >
                <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <span className={`text-sm font-bold ${standing.rank <= 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {standing.rank}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2.5">
                    <img src={standing.team.logo} alt={standing.team.name} className="w-6 h-6 object-contain flex-shrink-0" loading="lazy" />
                    <span className="font-medium text-white truncate max-w-[120px] sm:max-w-none">
                      {standing.team.name}
                    </span>
                  </div>
                </td>
                <td className="text-center px-2 py-3 text-gray-300">{standing.all.played}</td>
                <td className="text-center px-2 py-3 text-emerald-400 hidden sm:table-cell">{standing.all.win}</td>
                <td className="text-center px-2 py-3 text-yellow-400 hidden sm:table-cell">{standing.all.draw}</td>
                <td className="text-center px-2 py-3 text-red-400 hidden sm:table-cell">{standing.all.lose}</td>
                <td className="text-center px-2 py-3 text-gray-300 hidden md:table-cell">{standing.all.goals.for}</td>
                <td className="text-center px-2 py-3 text-gray-300 hidden md:table-cell">{standing.all.goals.against}</td>
                <td className="text-center px-2 py-3 text-gray-300">
                  {standing.goalsDiff > 0 ? `+${standing.goalsDiff}` : standing.goalsDiff}
                </td>
                <td className="text-center px-2 py-3">
                  <span className="font-bold text-white text-base">{standing.points}</span>
                </td>
                <td className="text-center px-3 py-3 hidden lg:table-cell">
                  <FormIndicator form={standing.form} />
                </td>
                <td className="pr-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    disabled={!leagueName}
                    onClick={() => toggle({
                      teamId: standing.team.id,
                      teamName: standing.team.name,
                      teamLogo: standing.team.logo,
                      leagueId,
                      leagueName,
                      ...(teamType ? { teamType } : {}),
                    })}
                    className="p-1 rounded-md transition-colors hover:bg-gray-700 disabled:opacity-30"
                    title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <Star
                      size={15}
                      className={fav ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 group-hover:text-gray-400'}
                    />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
