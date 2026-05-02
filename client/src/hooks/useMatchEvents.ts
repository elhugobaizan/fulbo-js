import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface MatchEvent {
  id: number
  matchId: number
  minute: number | null
  type: string
  playerId: number | null
  playerOutId: number | null
  teamId: number
  isPenalty: boolean
  isOwnGoal: boolean
  player?: { id: number; firstName: string; lastName: string } | null
  team?: { id: number; name: string; shortName: string | null } | null
}

async function fetchMatchEvents(matchId: number): Promise<MatchEvent[]> {
  const { data } = await apiClient.get('/local', {
    params: { resource: 'match-events', matchId, tournamentId: 1 },
  })
  return data.data ?? []
}

async function createEvent(token: string, payload: any): Promise<MatchEvent> {
  const { data } = await apiClient.post('/admin?action=create-event', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function updateEvent(token: string, eventId: number, payload: { minute?: number | null; playerId?: number | null }): Promise<MatchEvent> {
  const { data } = await apiClient.patch('/admin?action=update-event', { eventId, ...payload }, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function deleteEvent(token: string, eventId: number): Promise<void> {
  await apiClient.delete('/admin?action=delete-event', {
    params: { eventId },
    headers: { 'x-admin-token': token },
  })
}

export function useMatchEvents(matchId: number | null) {
  return useQuery({
    queryKey: ['match-events', matchId],
    queryFn: () => fetchMatchEvents(matchId!),
    enabled: !!matchId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateEvent(matchId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, payload }: { token: string; payload: any }) =>
      createEvent(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-events', matchId] })
      queryClient.invalidateQueries({ queryKey: ['local-topscorers'] })
      queryClient.invalidateQueries({ queryKey: ['local-topassists'] })
      queryClient.invalidateQueries({ queryKey: ['local-topcards'] })
    },
  })
}

export function useUpdateEvent(matchId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, eventId, payload }: { token: string; eventId: number; payload: any }) =>
      updateEvent(token, eventId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-events', matchId] })
    },
  })
}

export function useDeleteEvent(matchId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, eventId }: { token: string; eventId: number }) =>
      deleteEvent(token, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-events', matchId] })
      queryClient.invalidateQueries({ queryKey: ['local-topscorers'] })
      queryClient.invalidateQueries({ queryKey: ['local-topassists'] })
      queryClient.invalidateQueries({ queryKey: ['local-topcards'] })
    },
  })
}
