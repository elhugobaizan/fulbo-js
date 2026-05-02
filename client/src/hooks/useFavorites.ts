import { useState, useCallback, useEffect } from 'react'
import { getFavorites, addFavorite, removeFavorite, isFavorite, type FavoriteTeam } from '../lib/favorites'

// Evento custom para sincronizar entre componentes
const FAVORITES_EVENT = 'futbol-ar:favorites-changed'

function dispatchChange() {
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>(getFavorites)

  const refresh = useCallback(() => {
    setFavorites(getFavorites())
  }, [])

  // Escucha cambios desde otros componentes
  useEffect(() => {
    window.addEventListener(FAVORITES_EVENT, refresh)
    return () => window.removeEventListener(FAVORITES_EVENT, refresh)
  }, [refresh])

  const add = useCallback((team: Omit<FavoriteTeam, 'addedAt'>) => {
    addFavorite(team)
    dispatchChange()
    refresh()
  }, [refresh])

  const remove = useCallback((teamId: number) => {
    removeFavorite(teamId)
    dispatchChange()
    refresh()
  }, [refresh])

  const toggle = useCallback((team: Omit<FavoriteTeam, 'addedAt'>) => {
    if (isFavorite(team.teamId)) {
      removeFavorite(team.teamId)
    } else {
      addFavorite(team)
    }
    dispatchChange()
    refresh()
  }, [refresh])

  const checkIsFavorite = useCallback((teamId: number) => {
    return favorites.some((f) => f.teamId === teamId)
  }, [favorites])

  return { favorites, add, remove, toggle, isFavorite: checkIsFavorite }
}
