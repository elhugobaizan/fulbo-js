interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
  dashed?: boolean
}

export function EmptyState({ message, icon, dashed = false }: EmptyStateProps) {
  return (
    <div className={`rounded-xl border ${dashed ? 'border-dashed border-gray-700' : 'border-gray-800'} p-10 text-center space-y-2`}>
      {icon && <div className="mx-auto text-gray-700">{icon}</div>}
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  )
}
