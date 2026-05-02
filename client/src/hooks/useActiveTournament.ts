import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface ActiveTournament {
  id: number
  name: string
  shortName: string | null
  season: number
  hasGroups: boolean
  qualifiersPerGroup: number
  active: boolean
}

async function fetchActiveTournament(): Promise<ActiveTournament | null> {
  try {
    const { data } = await apiClient.get('/local', { params: { resource: 'active-tournament', tournamentId: 0 } })
    return data.data ?? null
  } catch {
    return null
  }
}

export function useActiveTournament() {
  return useQuery({
    queryKey: ['active-tournament'],
    queryFn: fetchActiveTournament,
    staleTime: 1000 * 60 * 5,
  })
}
