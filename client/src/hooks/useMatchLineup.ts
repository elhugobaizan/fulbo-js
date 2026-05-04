import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface LineupEntry {
  id: number
  matchId: number
  teamId: number
  playerId: number
  isStarter: boolean
  shirtNumber: number | null
  player: { id: number; firstName: string; lastName: string; position: string | null }
}

async function fetchMatchLineup(matchId: number): Promise<LineupEntry[]> {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'match-lineup', matchId, tournamentId: 1 },
  })
  return data.data ?? []
}

async function setLineup(token: string, matchId: number, teamId: number, players: any[]) {
  const { data } = await apiClient.post('/admin?action=set-lineup',
    { matchId, teamId, players },
    { headers: { 'x-admin-token': token } }
  )
  return data.data
}

export function useMatchLineup(matchId: number | null) {
  return useQuery({
    queryKey: ['match-lineup', matchId],
    queryFn: () => fetchMatchLineup(matchId!),
    enabled: !!matchId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSetLineup(matchId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, teamId, players }: { token: string; teamId: number; players: any[] }) =>
      setLineup(token, matchId, teamId, players),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-lineup', matchId] })
    },
  })
}
