import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface LocalPlayer {
  id: number
  firstName: string
  lastName: string
  teamId: number
  tournamentId: number
  position: string | null
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  team?: { id: number; name: string; shortName: string | null; logoUrl: string | null }
}

async function fetchLocalTopScorers(tournamentId: number): Promise<LocalPlayer[]> {
  const { data } = await apiClient.get('/local', { params: { resource: 'local-topscorers', tournamentId } })
  return data.data ?? []
}

async function fetchLocalTopAssists(tournamentId: number): Promise<LocalPlayer[]> {
  const { data } = await apiClient.get('/local', { params: { resource: 'local-topassists', tournamentId } })
  return data.data ?? []
}

async function fetchLocalTopCards(tournamentId: number): Promise<LocalPlayer[]> {
  const { data } = await apiClient.get('/local', { params: { resource: 'local-topcards', tournamentId } })
  return data.data ?? []
}

async function fetchLocalPlayers(tournamentId: number): Promise<LocalPlayer[]> {
  const { data } = await apiClient.get('/local', { params: { resource: 'local-players', tournamentId } })
  return data.data ?? []
}

async function fetchPlayersByTeam(teamId: number, teamType?: string): Promise<LocalPlayer[]> {
  const { data } = await apiClient.get('/local', { params: { resource: 'players-by-team', teamId, tournamentId: 1, ...(teamType ? { teamType } : {}) } })
  return data.data ?? []
}

async function createPlayer(token: string, payload: any): Promise<LocalPlayer> {
  const { data } = await apiClient.post('/admin?action=create-player', payload, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

async function editPlayer(token: string, playerId: number, payload: any): Promise<LocalPlayer> {
  const { data } = await apiClient.post('/admin?action=edit-player', { ...payload, playerId }, {
    headers: { 'x-admin-token': token },
  })
  return data.data
}

export function useLocalTopScorers(tournamentId: number) {
  return useQuery({ queryKey: ['local-topscorers', tournamentId], queryFn: () => fetchLocalTopScorers(tournamentId), staleTime: 1000 * 60 * 5 })
}
export function useLocalTopAssists(tournamentId: number) {
  return useQuery({ queryKey: ['local-topassists', tournamentId], queryFn: () => fetchLocalTopAssists(tournamentId), staleTime: 1000 * 60 * 5 })
}
export function useLocalTopCards(tournamentId: number) {
  return useQuery({ queryKey: ['local-topcards', tournamentId], queryFn: () => fetchLocalTopCards(tournamentId), staleTime: 1000 * 60 * 5 })
}
export function useLocalPlayers(tournamentId: number) {
  return useQuery({ queryKey: ['local-players', tournamentId], queryFn: () => fetchLocalPlayers(tournamentId), staleTime: 1000 * 60 * 5 })
}
export function usePlayersByTeam(teamId: number, teamType?: string) {
  return useQuery({ queryKey: ['players-by-team', teamId, teamType], queryFn: () => fetchPlayersByTeam(teamId, teamType), enabled: teamId > 0, staleTime: 1000 * 60 * 5 })
}

export interface PlayerMembership {
  teamName: string | null
  tournamentName: string
  position: string | null
}

export interface PlayerSearchResult {
  id: number
  firstName: string
  lastName: string
  memberships: PlayerMembership[]
}

async function searchPlayers(token: string, q: string): Promise<PlayerSearchResult[]> {
  const { data } = await apiClient.get('/admin', {
    params: { action: 'search-players', q },
    headers: { 'x-admin-token': token },
  })
  return data.data ?? []
}

export function useSearchPlayers(token: string, q: string) {
  return useQuery({
    queryKey: ['search-players', q],
    queryFn: () => searchPlayers(token, q),
    enabled: !!token && q.trim().length >= 2,
    staleTime: 1000 * 30,
  })
}

async function fetchTeamTournaments(teamId: number, teamType?: string) {
  const { data } = await apiClient.get('/local', { params: { resource: 'team-tournaments', teamId, tournamentId: 1, ...(teamType ? { teamType } : {}) } })
  return data.data ?? []
}

export function useTeamTournaments(teamId: number, teamType?: string) {
  return useQuery({ queryKey: ['team-tournaments', teamId, teamType], queryFn: () => fetchTeamTournaments(teamId, teamType), enabled: teamId > 0, staleTime: 1000 * 60 * 10 })
}

async function fetchTournamentTeams(tournamentId: number) {
  const { data } = await apiClient.get('/local', { params: { resource: 'tournament-teams', tournamentId } })
  return data.data ?? []
}

export function useTournamentTeams(tournamentId: number) {
  return useQuery({ queryKey: ['tournament-teams', tournamentId], queryFn: () => fetchTournamentTeams(tournamentId), enabled: tournamentId > 0, staleTime: 1000 * 60 * 10 })
}

async function fetchPlayerStats(playerId: number, tournamentId: number) {
  const { data } = await apiClient.get('/local', { params: { resource: 'player-stats', playerId, tournamentId } })
  return data.data
}

export function usePlayerStats(playerId: number | null, tournamentId: number) {
  return useQuery({
    queryKey: ['player-stats', playerId, tournamentId],
    queryFn: () => fetchPlayerStats(playerId!, tournamentId),
    enabled: !!playerId && tournamentId > 0,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, payload }: { token: string; payload: any }) => createPlayer(token, payload),
    onSuccess: (_, { payload }) => {
      queryClient.invalidateQueries({ queryKey: ['local-players', payload.tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['players-by-team', payload.teamId ?? payload.nationalTeamId] })
    },
  })
}

export function useEditPlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ token, playerId, payload }: { token: string; playerId: number; payload: any }) => editPlayer(token, playerId, payload),
    onSuccess: (_, { payload }) => {
      queryClient.invalidateQueries({ queryKey: ['local-players', payload.tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['players-by-team', payload.teamId ?? payload.nationalTeamId] })
    },
  })
}