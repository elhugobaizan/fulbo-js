import { useActiveTournament } from '../hooks/useActiveTournament'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Star, Wifi, ChevronRight, Calendar } from 'lucide-react'
import { useNews } from '../hooks/useNews'
import { useLiveFixtures } from '../hooks/useFixtures'
import { useStandings } from '../hooks/useStandings'
import { useFavorites } from '../hooks/useFavorites'
import { useTeamFixtures } from '../hooks/useTeamFixtures'
import { TeamBadge } from '../components/TeamBadge'
import { CURRENT_SEASON } from '../config/leagues'
import { formatMatchDateShort, formatTimeAgo } from '../lib/date'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}


// ─── Live Banner ─────────────────────────────────────────────────────────────

function LiveBanner() {
  const { data: liveFixtures = [] } = useLiveFixtures(128)
  if (liveFixtures.length === 0) return null

  return (
    <Link to="/fixtures" className="block">
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wifi size={14} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">En vivo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-xs text-gray-400">{liveFixtures.length} partido{liveFixtures.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-2">
          {liveFixtures.slice(0, 2).map((fixture) => (
            <div key={fixture.fixture.id} className="flex items-center gap-3">
              <img src={fixture.teams.home.logo} alt="" className="w-5 h-5 object-contain" />
              <span className="text-sm text-white flex-1">{fixture.teams.home.name}</span>
              <span className="text-sm font-bold text-white">{fixture.goals.home ?? 0} - {fixture.goals.away ?? 0}</span>
              <span className="text-sm text-white flex-1 text-right">{fixture.teams.away.name}</span>
              <img src={fixture.teams.away.logo} alt="" className="w-5 h-5 object-contain" />
            </div>
          ))}
          {liveFixtures.length > 2 && <p className="text-xs text-gray-500 text-center">+{liveFixtures.length - 2} más</p>}
        </div>
      </div>
    </Link>
  )
}

// ─── Team fixtures card ───────────────────────────────────────────────────────

function TeamFixturesCard({ fav }: { fav: any }) {
  const { data: fixtures = [], isLoading } = useTeamFixtures(fav.teamId, 3, false, fav.teamType)
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      {/* Header */}
      <Link
        to="/team/$teamId"
        params={{ teamId: String(fav.teamId) }}
        search={{ leagueId: fav.leagueId, leagueName: fav.leagueName, ...(fav.teamType ? { teamType: fav.teamType } : {}) }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800"
      >
        <TeamBadge name={fav.teamName} logo={fav.teamLogo} size={28} />
        <span className="font-semibold text-white text-sm flex-1">{fav.teamName}</span>
        <ChevronRight size={14} className="text-gray-600" />
      </Link>

      {/* Fixtures */}
      {isLoading ? (
        <div className="px-4 py-3 space-y-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-800 rounded" />)}
        </div>
      ) : fixtures.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-600">Sin próximos partidos</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {fixtures.map((match) => {
            const isHome = match.homeTeam?.id === fav.teamId
            const opponent = isHome ? match.awayTeam : match.homeTeam
            return (
              <div key={match.id}
                onClick={() => match.status === 'finished' && navigate({ to: '/match/$matchId', params: { matchId: String(match.id) } })}
                className={`flex items-center gap-3 px-4 py-2.5 ${match.status === 'finished' ? 'cursor-pointer hover:bg-gray-800/50' : ''} transition-colors`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">{isHome ? 'vs' : 'en'}</span>
                    <TeamBadge name={opponent?.name ?? '?'} logo={opponent?.logoUrl} size={16} />
                    <span className="text-sm text-white truncate">{opponent?.shortName ?? opponent?.name ?? '?'}</span>
                  </div>
                  {match.tournament && (
                    <p className="text-[10px] text-gray-600 mt-0.5">{match.tournament.shortName ?? match.tournament.name}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {match.scheduledAt
                    ? <span className="text-xs text-gray-500 capitalize">{formatMatchDateShort(match.scheduledAt)}</span>
                    : <span className="text-xs text-gray-600">Fecha {match.matchday}</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Favoritos section ────────────────────────────────────────────────────────

function FavoritesSection() {
  const { favorites } = useFavorites()
  const { data: standingsData } = useStandings({ leagueId: 128, season: CURRENT_SEASON })
  const standings = standingsData?.league?.standings?.[0] ?? []

  if (favorites.length === 0) return (
    <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center space-y-2">
      <Star size={24} className="text-gray-600 mx-auto" />
      <p className="text-sm text-gray-400">
        Todavía no tenés favoritos.{' '}
        <Link to="/standings" className="text-[#74ACDF] hover:underline">Agregar desde la tabla</Link>
      </p>
    </div>
  )

  return (
    <div className="space-y-3">
      {favorites.map((fav) => {
        const standing = standings.find((s) => s.team.id === fav.teamId)
        return (
          <div key={fav.teamId} className="space-y-0">
            <TeamFixturesCard fav={fav} />
            {standing && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-900/20 border border-t-0 border-gray-800 rounded-b-xl">
                <span className="text-xs text-gray-500">API:</span>
                <span className="text-xs text-white font-medium">{standing.points} pts</span>
                <span className="text-xs text-gray-600">· #{standing.rank}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Noticias ─────────────────────────────────────────────────────────────────

function NewsSection() {
  const { data: articles = [], isLoading } = useNews('fútbol argentino', 6)

  if (isLoading) return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl border border-gray-800">
          <div className="w-20 h-16 bg-gray-800 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="w-full h-4 bg-gray-800 rounded" />
            <div className="w-3/4 h-3 bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )

  if (articles.length === 0) return <p className="text-gray-500 text-sm text-center py-4">No hay noticias disponibles</p>

  return (
    <div className="space-y-2">
      {articles.map((article, i) => (
        <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
          className="flex gap-3 p-3 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/80 transition-colors">
          {article.urlToImage && (
            <img src={article.urlToImage} alt="" className="w-20 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-800"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{article.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-gray-500">{article.source.name}</span>
              <span className="text-gray-700">·</span>
              <span className="text-[11px] text-gray-500">{formatTimeAgo(article.publishedAt)}</span>
              <ExternalLink size={10} className="text-gray-600 ml-auto flex-shrink-0" />
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function HomePage() {
  const { data: activeTournament } = useActiveTournament()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{getGreeting()} ⚽</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {activeTournament ? activeTournament.shortName ?? activeTournament.name : 'Fútbol al día'}
        </p>
      </div>

      <LiveBanner />

      {/* Mis equipos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#74ACDF]" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Mis equipos</h2>
          </div>

        </div>
        <FavoritesSection />
      </section>

      {/* Noticias */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Noticias</h2>
        <NewsSection />
      </section>
    </div>
  )
}
