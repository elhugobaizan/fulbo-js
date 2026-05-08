import { useWikidata } from '../hooks/useWikidata'
import { TeamBadge } from '../components/TeamBadge'
import { Star } from 'lucide-react'
import { useLocalStandings } from '../hooks/useLocalStandings';

interface LocalTeam {
  id: number;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  country: string | null;
  externalId: number | null;
  color: string | null;
  alternateColor: string | null;
}

function TournamentPills({ tournaments, teamId }: { tournaments?: any[], teamId: number }) {
  if (!tournaments?.length) return null


  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {tournaments.map((tournament) => {
        const { data: standings } = useLocalStandings(tournament.id)
        const groupData = standings?.groups
          .find((g: any) => g.standings.some((s: any) => s.team.id === teamId))
        const rank = groupData?.standings.find((s: any) => s.team.id === teamId)?.rank ?? null
        const groupName = groupData?.group?.name ?? null

        return (
          <div
            key={tournament.id}
            className="
        min-w-[170px]
        rounded-2xl
        border border-white/[0.08]
        bg-white/[0.04]
        px-4 py-3
      "
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs font-semibold text-slate-200">
                {tournament.shortName || tournament.name}
              </span>
            </div>

            <div className="mt-2 text-sm font-bold text-white">
              {rank}° en {groupName}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TeamHeader({ team, onToggleFav, isFav, tournaments }: {
  team: LocalTeam
  onToggleFav: () => void
  isFav: boolean
  tournaments?: any[]
}) {
  const { data: wiki, isLoading: loadingWiki } = useWikidata(team.name)

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/60 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div
        className="absolute inset-0"
        style={{
          background: `
      radial-gradient(
        circle at 12% 20%,
        #${team.alternateColor || '74ACDF'}18,
        transparent 58%
      ),
      linear-gradient(
        135deg,
        rgba(15,23,42,0.96),
        rgba(2,8,23,0.98)
      )
    `,
        }}
      />      <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[#74ACDF]/10 blur-3xl" />

      <div className="relative flex items-center gap-6 p-7">
        <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(116,172,223,0.12)]">
          <TeamBadge name={team.name} logo={team.logoUrl} size={88} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {team.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {team.country && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-300">
                {team.country}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onToggleFav}
          className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.04] transition-all duration-150 hover:border-yellow-400/40 hover:bg-yellow-400/10"
        >
          <Star
            size={20}
            className={
              isFav
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-slate-500 transition-colors group-hover:text-yellow-300'
            }
          />
        </button>
      </div>

      {(loadingWiki || wiki) && (
        <div className="relative border-t border-white/[0.07] bg-black/10 px-7 py-4">
          {loadingWiki ? (
            <div className="flex animate-pulse flex-wrap gap-3">
              <div className="h-7 w-28 rounded-full bg-white/[0.06]" />
              <div className="h-7 w-36 rounded-full bg-white/[0.06]" />
              <div className="h-7 w-24 rounded-full bg-white/[0.06]" />
            </div>
          ) : wiki ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {wiki.founded && (
                  <InfoPill label="Fundado" value={String(wiki.founded)} />
                )}

                {wiki.stadiumName && (
                  <InfoPill
                    label="Estadio"
                    value={`${wiki.stadiumName}${wiki.stadiumCapacity ? ` · ${wiki.stadiumCapacity.toLocaleString()}` : ''}`}
                  />
                )}

                {wiki.website && (
                  <a
                    href={wiki.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-[#74ACDF]/40 hover:text-[#74ACDF]"
                  >
                    {new URL(wiki.website).hostname.replace('www.', '')}
                  </a>
                )}

                {wiki.wikidataUrl && (
                  <a
                    href={wiki.wikidataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs font-medium text-slate-600 transition-colors hover:text-slate-400"
                  >
                    Wikidata →
                  </a>
                )}
              </div>
              <TournamentPills tournaments={tournaments} teamId={team.id} />
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
      <span className="mr-1.5 text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-300">{value}</span>
    </div>
  )
}