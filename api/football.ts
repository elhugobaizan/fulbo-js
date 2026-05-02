import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { ok, err } from './_lib/helpers'

const LIGA_PROFESIONAL_ID = 128
const CURRENT_SEASON = 2024

function getApi() {
  return axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY ?? '' },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)

  const { resource } = req.query
  const api = getApi()

  try {
    // /api/football?resource=standings&leagueId=128&season=2024
    if (resource === 'standings') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/standings', { params: { league: leagueId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=fixtures&leagueId=&season=&round=&date=
    if (resource === 'fixtures') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const params: Record<string, unknown> = { league: leagueId, season }
      if (req.query.round) params.round = req.query.round
      if (req.query.date) params.date = req.query.date
      const r = await api.get('/fixtures', { params })
      return ok(res, r.data.response)
    }

    // /api/football?resource=fixtures-live&leagueId=
    if (resource === 'fixtures-live') {
      const params: Record<string, unknown> = { live: 'all' }
      if (req.query.leagueId) params.league = req.query.leagueId
      const r = await api.get('/fixtures', { params })
      return ok(res, r.data.response)
    }

    // /api/football?resource=rounds&leagueId=&season=
    if (resource === 'rounds') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/fixtures/rounds', { params: { league: leagueId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=players&teamId=&season=
    if (resource === 'players') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/players', { params: { team: teamId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=topscorers&leagueId=&season=
    if (resource === 'topscorers') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/players/topscorers', { params: { league: leagueId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=topassists&leagueId=&season=
    if (resource === 'topassists') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/players/topassists', { params: { league: leagueId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=topcards&leagueId=&season=
    if (resource === 'topcards') {
      const leagueId = Number(req.query.leagueId) || LIGA_PROFESIONAL_ID
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/players/topyellowcards', { params: { league: leagueId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=player-detail&playerId=&season=
    if (resource === 'player-detail') {
      const playerId = Number(req.query.playerId)
      if (!playerId) return err(res, 'playerId required', 400)
      const season = Number(req.query.season) || CURRENT_SEASON
      const r = await api.get('/players', { params: { id: playerId, season } })
      return ok(res, r.data.response)
    }

    // /api/football?resource=team-info&teamId=
    if (resource === 'team-info') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const r = await api.get('/teams', { params: { id: teamId } })
      return ok(res, r.data.response)
    }

    return err(res, 'Unknown resource', 400)
  } catch (error: any) {
    console.error('Football API error:', error?.response?.data ?? error?.message)
    return err(res, 'Error fetching data')
  }
}
