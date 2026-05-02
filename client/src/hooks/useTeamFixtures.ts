import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface TeamFixture {
  id: number
  matchday: number | null
  scheduledAt: string | null
  status: string
  tournament: { id: number; name: string; shortName: string | null } | null
  homeTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  awayTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  homeScore: number | null
  awayScore: number | null
}

async function fetchTeamFixtures(teamId: number, limit = 3): Promise<TeamFixture[]> {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'team-fixtures', teamId, limit },
  })
  return data.data ?? []
}

export function useTeamFixtures(teamId: number, limit = 3) {
  return useQuery({
    queryKey: ['team-fixtures', teamId, limit],
    queryFn: () => fetchTeamFixtures(teamId, limit),
    staleTime: 1000 * 60 * 5,
    enabled: teamId > 0,
  })
}