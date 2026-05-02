import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { CURRENT_SEASON } from '../config/leagues'
import type { StandingsResponse } from '../types/football'

interface StandingsParams {
  leagueId?: number
  season?: number
}

async function fetchStandings(leagueId: number, season: number): Promise<StandingsResponse | null> {
  const { data } = await apiClient.get('/football', {
    params: { resource: 'standings', leagueId, season },
  })
  return data.data?.[0] ?? null
}

export function useStandings({ leagueId = 128, season = CURRENT_SEASON }: StandingsParams = {}) {
  return useQuery({
    queryKey: ['standings', leagueId, season],
    queryFn: () => fetchStandings(leagueId, season),
    staleTime: 1000 * 60 * 5,
  })
}
