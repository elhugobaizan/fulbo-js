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
  homePenalties: number | null
  awayPenalties: number | null
}

async function fetchTeamFixtures(teamId: number, limit = 3, all = false, teamType?: string): Promise<TeamFixture[]> {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'team-fixtures', teamId, limit, ...(all ? { all: 'true' } : {}), ...(teamType ? { teamType } : {}) },
  })
  return data.data ?? []
}

export function useTeamFixtures(teamId: number, limit = 3, all = false, teamType?: string) {
  return useQuery({
    queryKey: ['team-fixtures', teamId, limit, all, teamType],
    queryFn: () => fetchTeamFixtures(teamId, limit, all, teamType),
    staleTime: 1000 * 60 * 5,
    enabled: teamId > 0,
  })
}