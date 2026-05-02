import { useActiveTournament } from '../hooks/useActiveTournament'
import { createFileRoute } from '@tanstack/react-router'
import { useBracket } from '../hooks/useBracket'
import { BracketView } from '../components/BracketView'



export const Route = createFileRoute('/bracket')({
  component: BracketPage,
})

function BracketPage() {
  const { data: activeTournament } = useActiveTournament()
  const { data: bracket, isLoading } = useBracket(activeTournament?.id ?? 1)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Eliminatoria</h1>
        {activeTournament && <p className="text-sm text-gray-400 mt-0.5">{activeTournament.shortName ?? activeTournament.name}</p>}
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && bracket && (
        <BracketView bracket={bracket} />
      )}

      {!isLoading && !bracket && (
        <div className="rounded-xl border border-gray-800 p-10 text-center">
          <p className="text-gray-400">La fase eliminatoria todavía no comenzó</p>
        </div>
      )}
    </div>
  )
}