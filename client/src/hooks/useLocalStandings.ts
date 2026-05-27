import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface LocalStandingRow {
  rank: number
  team: { id: number; name: string; logo: string }
  points: number
  goalsDiff: number
  form: string
  description: string | null
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
}

export interface LocalGroupStandings {
  group: { id: number; name: string }
  standings: LocalStandingRow[]
}

export interface LocalStandingsData {
  tournament: { id: number; name: string; season: number; qualifiersPerGroup: number; wildcardQualifiers: number; teamType?: string }
  groups: LocalGroupStandings[]
}

async function fetchLocalStandings(tournamentId: number): Promise<LocalStandingsData> {
  const { data } = await apiClient.get('/local', { params: { resource: 'standings', tournamentId } })
  return data.data
}

export function useLocalStandings(tournamentId: number) {
  return useQuery({ queryKey: ['local-standings', tournamentId], queryFn: () => fetchLocalStandings(tournamentId), staleTime: 1000 * 60 * 2 })
}
