interface FormIndicatorProps {
  form: string // e.g. "WWDLW"
}

const RESULT_STYLES: Record<string, string> = {
  W: 'bg-emerald-500 text-white',
  D: 'bg-yellow-500 text-gray-950',
  L: 'bg-red-500 text-white',
}

const RESULT_LABELS: Record<string, string> = {
  W: 'G',
  D: 'E',
  L: 'P',
}

export function FormIndicator({ form }: FormIndicatorProps) {
  const results = form?.slice(-5).split('') ?? []

  return (
    <div className="flex gap-0.5">
      {results.map((result, i) => (
        <span
          key={i}
          title={result === 'W' ? 'Ganó' : result === 'D' ? 'Empató' : 'Perdió'}
          className={`
            w-5 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center
            ${RESULT_STYLES[result] ?? 'bg-gray-700 text-gray-400'}
          `}
        >
          {RESULT_LABELS[result] ?? result}
        </span>
      ))}
    </div>
  )
}
