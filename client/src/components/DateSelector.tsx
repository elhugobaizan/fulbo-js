import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateSelectorProps {
  selected: string // YYYY-MM-DD
  onChange: (date: string) => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'

  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function DateSelector({ selected, onChange }: DateSelectorProps) {
  // Genera los 7 días centrados en hoy
  const today = new Date().toISOString().split('T')[0]
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3))

  return (
    <div className="space-y-2">
      {/* Navegación */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(addDays(selected, -1))}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-white capitalize">
            {formatDate(selected)}
          </span>
          <span className="text-xs text-gray-500 ml-2">{selected}</span>
        </div>

        <button
          onClick={() => onChange(addDays(selected, 1))}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Pills de días */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {days.map((day) => {
          const isSelected = day === selected
          const isToday = day === today
          const date = new Date(day + 'T00:00:00')
          return (
            <button
              key={day}
              onClick={() => onChange(day)}
              className={`
                flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg text-xs transition-colors
                ${isSelected
                  ? 'bg-[#74ACDF] text-gray-950 font-bold'
                  : isToday
                    ? 'bg-gray-700 text-white font-medium'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <span className="uppercase text-[10px]">
                {date.toLocaleDateString('es-AR', { weekday: 'short' })}
              </span>
              <span className="text-sm font-bold">{date.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
