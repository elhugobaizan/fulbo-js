import { ARGENTINE_LEAGUES } from "../config/leagues"

interface LeagueSelectorProps {
  selected: number
  onChange: (id: number) => void
}

export function LeagueSelector({ selected, onChange }: LeagueSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {ARGENTINE_LEAGUES.map((league) => (
        <button
          key={league.id}
          onClick={() => onChange(league.id)}
          className={`
            flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all
            ${selected === league.id
              ? 'bg-[#74ACDF] text-gray-950 shadow-lg shadow-[#74ACDF]/20'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }
          `}
        >
          <span className="hidden sm:inline">{league.name}</span>
          <span className="sm:hidden">{league.shortName}</span>
        </button>
      ))}
    </div>
  )
}
