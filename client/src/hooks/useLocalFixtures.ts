import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface LocalFixture {
  id: number; matchday: number; scheduledAt: string | null; status: string
  homeTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  awayTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  homeScore: number | null; awayScore: number | null; homePenalties: number | null; awayPenalties: number | null
}

export interface LocalFixturesData {
  matchday: number | null; matchdays: number[]; matches: LocalFixture[]
}

async function fetchLocalFixtures(tournamentId: number, matchday?: number): Promise<LocalFixturesData> {
  const { data } = await apiClient.get('/local', { params: { resource: 'fixtures', tournamentId, ...(matchday ? { matchday } : {}) } })
  return data.data
}

export function useLocalFixtures(tournamentId: number, matchday?: number) {
  return useQuery({ queryKey: ['local-fixtures', tournamentId, matchday ?? 'next'], queryFn: () => fetchLocalFixtures(tournamentId, matchday), staleTime: 1000 * 60 * 2 })
}
