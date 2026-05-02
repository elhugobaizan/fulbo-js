import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface UpcomingMatch {
  id: number; matchday: number; scheduledAt: string | null; status: string
  homeTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  awayTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  homeScore: number | null; awayScore: number | null
}

export interface UpcomingData {
  matchday: number | null; matches: UpcomingMatch[]
}

async function fetchUpcoming(tournamentId: number): Promise<UpcomingData> {
  const { data } = await apiClient.get('/local', { params: { resource: 'upcoming', tournamentId } })
  return data.data
}

export function useUpcoming(tournamentId: number) {
  return useQuery({ queryKey: ['upcoming', tournamentId], queryFn: () => fetchUpcoming(tournamentId), staleTime: 1000 * 60 * 5 })
}
