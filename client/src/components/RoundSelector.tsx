import { ChevronLeft, ChevronRight } from 'lucide-react'

interface RoundSelectorProps {
  rounds: string[]
  selected: string
  onChange: (round: string) => void
}

// Extrae el número de la jornada para mostrar más corto
function formatRound(round: string): string {
  const parts = round.split(' - ')
  const number = parts[parts.length - 1]
  const phase = parts[0]
  return `${phase} · Fecha ${number}`
}

export function RoundSelector({ rounds, selected, onChange }: RoundSelectorProps) {
  const currentIndex = rounds.indexOf(selected)

  const prev = () => {
    if (currentIndex > 0) onChange(rounds[currentIndex - 1])
  }

  const next = () => {
    if (currentIndex < rounds.length - 1) onChange(rounds[currentIndex + 1])
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
      <button
        onClick={prev}
        disabled={currentIndex <= 0}
        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex-1 overflow-x-auto flex gap-1.5 justify-center scrollbar-hide">
        {/* En mobile muestra solo la actual, en desktop muestra algunas */}
        <span className="text-sm font-medium text-white">
          {selected ? formatRound(selected) : 'Seleccioná una fecha'}
        </span>
        {rounds.length > 0 && (
          <span className="text-sm text-gray-500">
            ({currentIndex + 1}/{rounds.length})
          </span>
        )}
      </div>

      <button
        onClick={next}
        disabled={currentIndex >= rounds.length - 1}
        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
