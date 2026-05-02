import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { CURRENT_SEASON } from '../config/leagues'
import type { Player } from '../types/football'

async function fetchTopScorers(leagueId: number, season: number): Promise<Player[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'topscorers', leagueId, season } })
  return data.data ?? []
}
export function useTopScorers(leagueId: number, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['topscorers', leagueId, season], queryFn: () => fetchTopScorers(leagueId, season), staleTime: 1000 * 60 * 10 })
}

async function fetchTopAssists(leagueId: number, season: number): Promise<Player[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'topassists', leagueId, season } })
  return data.data ?? []
}
export function useTopAssists(leagueId: number, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['topassists', leagueId, season], queryFn: () => fetchTopAssists(leagueId, season), staleTime: 1000 * 60 * 10 })
}

async function fetchTopCards(leagueId: number, season: number): Promise<Player[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'topcards', leagueId, season } })
  return data.data ?? []
}
export function useTopCards(leagueId: number, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['topcards', leagueId, season], queryFn: () => fetchTopCards(leagueId, season), staleTime: 1000 * 60 * 10 })
}

async function fetchPlayer(playerId: number, season: number): Promise<Player | null> {
  const { data } = await apiClient.get('/football', { params: { resource: 'player-detail', playerId, season } })
  return data.data?.[0] ?? null
}
export function usePlayer(playerId: number | null, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['player', playerId, season], queryFn: () => fetchPlayer(playerId!, season), enabled: !!playerId, staleTime: 1000 * 60 * 30 })
}
