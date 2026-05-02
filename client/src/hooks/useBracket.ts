import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface BracketSlot {
  ruleId: number
  bracketPosition: number
  knockoutRound: string
  homeTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  awayTeam: { id: number; name: string; shortName: string | null; logoUrl: string | null } | null
  homeLabel: string
  awayLabel: string
  match: {
    id: number
    status: string
    homeScore: number | null
    awayScore: number | null
    homePenalties: number | null
    awayPenalties: number | null
    scheduledAt: string | null
    homeTeamId: number | null
    awayTeamId: number | null
    knockoutRound: string
    bracketPosition: number | null
  } | null
}

export interface Bracket {
  round_of_16: BracketSlot[]
  quarterfinal: BracketSlot[]
  semifinal: BracketSlot[]
  final: BracketSlot[]
}

async function fetchBracket(tournamentId: number): Promise<Bracket> {
  const { data } = await apiClient.get('/bracket', { params: { tournamentId } })
  return data.data
}

export function useBracket(tournamentId: number) {
  return useQuery({
    queryKey: ['bracket', tournamentId],
    queryFn: () => fetchBracket(tournamentId),
    staleTime: 1000 * 60 * 2,
  })
}
