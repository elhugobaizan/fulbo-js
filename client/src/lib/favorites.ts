// Manejo de favoritos en localStorage
// Cuando se agregue auth, reemplazar por llamadas al backend

export interface FavoriteTeam {
  teamId: number
  teamName: string
  teamLogo: string
  leagueId: number
  leagueName: string
  addedAt: string
}

const STORAGE_KEY = 'futbol-ar:favorites'

export function getFavorites(): FavoriteTeam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addFavorite(team: Omit<FavoriteTeam, 'addedAt'>): void {
  const favorites = getFavorites()
  const exists = favorites.some((f) => f.teamId === team.teamId)
  if (exists) return
  favorites.push({ ...team, addedAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
}

export function removeFavorite(teamId: number): void {
  const favorites = getFavorites().filter((f) => f.teamId !== teamId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
}

export function isFavorite(teamId: number): boolean {
  return getFavorites().some((f) => f.teamId === teamId)
}
