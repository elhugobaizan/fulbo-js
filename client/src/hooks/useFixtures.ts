import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { CURRENT_SEASON } from '../config/leagues'
import type { Fixture } from '../types/football'

async function fetchFixturesByRound(leagueId: number, season: number, round: string): Promise<Fixture[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'fixtures', leagueId, season, round } })
  return data.data ?? []
}
export function useFixturesByRound(leagueId: number, round: string, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['fixtures', 'round', leagueId, season, round], queryFn: () => fetchFixturesByRound(leagueId, season, round), enabled: !!round, staleTime: 1000 * 60 * 5 })
}

async function fetchFixturesByDate(leagueId: number, season: number, date: string): Promise<Fixture[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'fixtures', leagueId, season, date } })
  return data.data ?? []
}
export function useFixturesByDate(leagueId: number, date: string, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['fixtures', 'date', leagueId, season, date], queryFn: () => fetchFixturesByDate(leagueId, season, date), enabled: !!date, staleTime: 1000 * 60 * 2 })
}

async function fetchLiveFixtures(leagueId?: number): Promise<Fixture[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'fixtures-live', ...(leagueId ? { leagueId } : {}) } })
  return data.data ?? []
}
export function useLiveFixtures(leagueId?: number) {
  return useQuery({ queryKey: ['fixtures', 'live', leagueId], queryFn: () => fetchLiveFixtures(leagueId), refetchInterval: 1000 * 60, staleTime: 1000 * 30 })
}

async function fetchRounds(leagueId: number, season: number): Promise<string[]> {
  const { data } = await apiClient.get('/football', { params: { resource: 'rounds', leagueId, season } })
  return data.data ?? []
}
export function useRounds(leagueId: number, season = CURRENT_SEASON) {
  return useQuery({ queryKey: ['rounds', leagueId, season], queryFn: () => fetchRounds(leagueId, season), staleTime: 1000 * 60 * 60 })
}
