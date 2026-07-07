const SHORT_OPTS: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
const LONG_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatMatchDate(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString('es-AR', LONG_OPTS)
}

export function formatMatchDateShort(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString('es-AR', SHORT_OPTS)
}

export function formatMatchDateParts(dateStr: string): { day: string; month: string } {
  const d = parseDateLocal(dateStr)
  const day = d.toLocaleDateString('es-AR', { day: 'numeric' })
  const month = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
  return { day, month }
}

// Hora del partido (HH:MM). Se extrae directo del string ISO sin conversion de
// timezone, porque scheduledAt se guarda con la hora local etiquetada como Z
// (ver convencion de fechas del proyecto). Devuelve null si no hay hora util.
export function formatMatchTime(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const timePart = dateStr.split('T')[1]
  if (!timePart) return null
  const hhmm = timePart.slice(0, 5)
  if (hhmm === '00:00') return null // sin hora definida (solo fecha)
  return hhmm
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  return parseDateLocal(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
