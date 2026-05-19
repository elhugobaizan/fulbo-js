import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, and } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, tournaments, localPlayers, matchEvents, matchLineups } from './_lib/tournament-schema'
import { ok, err } from './_lib/helpers'

function getDb() {
  return drizzle(neon(process.env.DATABASE_URL!))
}

function calculateStandings(relevantMatches: any[], groupTeamsList: any[]) {
  const stats: Record<number, any> = {}
  for (const gt of groupTeamsList) {
    stats[gt.teamId] = { team: gt.team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
  }
  const groupTeamIds = new Set(groupTeamsList.map((gt: any) => gt.teamId))
  for (const match of relevantMatches) {
    if (match.status !== 'finished') continue
    const hg = match.homeScore ?? 0
    const ag = match.awayScore ?? 0
    if (groupTeamIds.has(match.homeTeamId)) {
      const h = stats[match.homeTeamId]
      h.played++; h.goalsFor += hg; h.goalsAgainst += ag
      if (hg > ag) { h.won++; h.points += 3 } else if (hg < ag) { h.lost++ } else { h.drawn++; h.points++ }
    }
    if (groupTeamIds.has(match.awayTeamId)) {
      const a = stats[match.awayTeamId]
      a.played++; a.goalsFor += ag; a.goalsAgainst += hg
      if (ag > hg) { a.won++; a.points += 3 } else if (ag < hg) { a.lost++ } else { a.drawn++; a.points++ }
    }
  }
  return Object.values(stats).sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points
    const da = a.goalsFor - a.goalsAgainst, db = b.goalsFor - b.goalsAgainst
    if (db !== da) return db - da
    return b.goalsFor - a.goalsFor
  })
}

async function getTournamentEvents(db: any, tournamentId: number) {
  const tournamentMatches = await db.select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
  const matchIds = tournamentMatches.map((m: any) => m.id)
  if (matchIds.length === 0) return []
  return await db.select({
    event: matchEvents,
    player: localPlayers,
    team: teams,
  })
    .from(matchEvents)
    .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
    .leftJoin(teams, eq(matchEvents.teamId, teams.id))
    .where(inArray(matchEvents.matchId, matchIds))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)

  const { resource, tournamentId: tid } = req.query
  const tournamentId = Number(tid)
  const db = getDb()

  try {
    // active tournament (no tournamentId needed)
    if (resource === 'active-tournament') {
      const [active] = await db.select().from(tournaments).where(eq(tournaments.active, true))
      if (!active) return err(res, 'No active tournament', 404)
      return ok(res, active)
    }

    // team tournaments - all tournaments a team participates in
    if (resource === 'team-tournaments') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const rows = await db.select({ tournament: tournaments, group: groups })
        .from(groupTeams)
        .innerJoin(groups, eq(groupTeams.groupId, groups.id))
        .innerJoin(tournaments, eq(groups.tournamentId, tournaments.id))
        .where(eq(groupTeams.teamId, teamId))
      const unique = Array.from(new Map(rows.map((r: any) => [r.tournament.id, { ...r.tournament, groupName: r.group.name }])).values())
      return ok(res, unique)
    }

    // team info (no tournamentId needed)
    if (resource === 'team') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId))
      if (!team) return err(res, 'Team not found', 404)
      return ok(res, team)
    }

    // match lineup
    if (resource === 'match-lineup') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)
      const lineups = await db.select({ lineup: matchLineups, player: localPlayers })
        .from(matchLineups)
        .innerJoin(localPlayers, eq(matchLineups.playerId, localPlayers.id))
        .where(eq(matchLineups.matchId, matchId))
        .orderBy(matchLineups.teamId, matchLineups.isStarter, localPlayers.lastName)
      return ok(res, lineups.map((r: any) => ({ ...r.lineup, player: r.player })))
    }

    // team fixtures - next matches for a team across all tournaments (no tournamentId needed)
    if (resource === 'team-fixtures') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const limit = Number(req.query.limit) || 3

      const allMatches = await db.select().from(matches)

      const all = req.query.all === 'true'
      const teamMatches = allMatches
        .filter((m: any) =>
          (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
          (all || (m.status !== 'finished' && m.scheduledAt !== null))
        )
        .sort((a: any, b: any) => {
          if (a.scheduledAt && b.scheduledAt)
            return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
          return (b.matchday ?? 0) - (a.matchday ?? 0)
        })
        .slice(0, limit)

      if (teamMatches.length === 0) return ok(res, [])

      const teamIds = [...new Set(teamMatches.flatMap((m: any) =>
        [m.homeTeamId, m.awayTeamId].filter(Boolean)
      ))] as number[]
      const tournamentIds = [...new Set(teamMatches.map((m: any) => m.tournamentId))] as number[]

      const teamsData = await db.select().from(teams).where(inArray(teams.id, teamIds))
      const tournamentsData = await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))

      const teamById = Object.fromEntries(teamsData.map((t: any) => [t.id, t]))
      const tournamentById = Object.fromEntries(tournamentsData.map((t: any) => [t.id, t]))

      // Count events per match
      const matchIdsList = teamMatches.map((m: any) => m.id)
      const eventsData = matchIdsList.length > 0
        ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, matchIdsList))
        : []
      const eventCountByMatch: Record<number, number> = {}
      for (const e of eventsData) {
        eventCountByMatch[e.matchId] = (eventCountByMatch[e.matchId] ?? 0) + 1
      }

      const enriched = teamMatches.map((m: any) => ({
        id: m.id,
        matchday: m.matchday,
        knockoutRound: m.knockoutRound,   // ← agregar
        scheduledAt: m.scheduledAt,
        status: m.status,
        tournament: tournamentById[m.tournamentId] ?? null,
        homeTeam: m.homeTeamId ? teamById[m.homeTeamId] : null,
        awayTeam: m.awayTeamId ? teamById[m.awayTeamId] : null,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        eventCount: eventCountByMatch[m.id] ?? 0,
      }))

      return ok(res, enriched)
    }

    if (!tournamentId) return err(res, 'tournamentId required', 400)

    // standings
    if (resource === 'standings') {
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      if (!tournament) return err(res, 'Tournament not found', 404)
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        const members = await db.select({ teamId: groupTeams.teamId, team: teams })
          .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id))
          .where(eq(groupTeams.groupId, group.id))
        return { ...group, members }
      }))
      const allGroupMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group')
      const standingsData = groupsWithTeams.map(group => {
        const ids = new Set(group.members.map((m: any) => m.teamId))
        const relevant = allGroupMatches.filter((m: any) => ids.has(m.homeTeamId!) || ids.has(m.awayTeamId!))
        const table = calculateStandings(relevant, group.members)
        return {
          group: { id: group.id, name: group.name },
          standings: table.map((row: any, i: number) => ({
            rank: i + 1,
            team: { id: row.team.id, name: row.team.name, logo: row.team.logoUrl ?? '' },
            points: row.points, goalsDiff: row.goalsFor - row.goalsAgainst, form: '', description: null,
            all: { played: row.played, win: row.won, draw: row.drawn, lose: row.lost, goals: { for: row.goalsFor, against: row.goalsAgainst } },
          }))
        }
      })
      return ok(res, { tournament: { id: tournament.id, name: tournament.name, season: tournament.season, qualifiersPerGroup: (tournament as any).qualifiersPerGroup ?? 8 }, groups: standingsData })
    }

    // fixtures
    if (resource === 'fixtures') {
      const matchday = req.query.matchday ? Number(req.query.matchday) : null
      const allMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group' && m.matchday !== null)
      const allMatchdays = [...new Set(allMatches.map((m: any) => m.matchday as number))].sort((a, b) => a - b)
      let target = matchday
      if (!target) {
        const pending = allMatches.filter((m: any) => m.status !== 'finished').sort((a: any, b: any) => a.matchday - b.matchday)
        target = pending[0]?.matchday ?? null
      }
      if (!target) return ok(res, { matchday: null, matchdays: allMatchdays, matches: [] })
      const dayMatches = allMatches.filter((m: any) => m.matchday === target)
      const teamIds = [...new Set(dayMatches.flatMap((m: any) => [m.homeTeamId, m.awayTeamId].filter(Boolean)))] as number[]
      const teamsData = teamIds.length > 0 ? await db.select().from(teams).where(inArray(teams.id, teamIds)) : []
      const teamById = Object.fromEntries(teamsData.map((t: any) => [t.id, t]))
      const dayMatchIds = dayMatches.map((m: any) => m.id)
      const dayEventsData = dayMatchIds.length > 0
        ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, dayMatchIds))
        : []
      const dayEventCount: Record<number, number> = {}
      for (const e of dayEventsData) {
        dayEventCount[e.matchId] = (dayEventCount[e.matchId] ?? 0) + 1
      }

      const enriched = dayMatches.sort((a: any, b: any) => {
        if (!a.scheduledAt) return 1; if (!b.scheduledAt) return -1
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }).map((m: any) => ({ id: m.id, matchday: m.matchday, scheduledAt: m.scheduledAt, status: m.status, homeTeam: m.homeTeamId ? teamById[m.homeTeamId] : null, awayTeam: m.awayTeamId ? teamById[m.awayTeamId] : null, homeScore: m.homeScore, awayScore: m.awayScore, homePenalties: m.homePenalties, awayPenalties: m.awayPenalties, eventCount: dayEventCount[m.id] ?? 0 }))
      return ok(res, { matchday: target, matchdays: allMatchdays, matches: enriched })
    }

    // upcoming
    if (resource === 'upcoming') {
      const allMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group' && m.matchday !== null)
      const pending = allMatches.filter((m: any) => m.status !== 'finished').sort((a: any, b: any) => a.matchday - b.matchday)
      if (pending.length === 0) return ok(res, { matchday: null, matches: [] })
      const nextMatchday = pending[0].matchday!
      const nextMatches = pending.filter((m: any) => m.matchday === nextMatchday)
      const teamIds = [...new Set(nextMatches.flatMap((m: any) => [m.homeTeamId, m.awayTeamId].filter(Boolean)))] as number[]
      const teamsData = await db.select().from(teams).where(inArray(teams.id, teamIds))
      const teamById = Object.fromEntries(teamsData.map((t: any) => [t.id, t]))
      const enriched = nextMatches.sort((a: any, b: any) => {
        if (!a.scheduledAt) return 1; if (!b.scheduledAt) return -1
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }).map((m: any) => ({ id: m.id, matchday: m.matchday, scheduledAt: m.scheduledAt, status: m.status, homeTeam: m.homeTeamId ? teamById[m.homeTeamId] : null, awayTeam: m.awayTeamId ? teamById[m.awayTeamId] : null, homeScore: m.homeScore, awayScore: m.awayScore }))
      return ok(res, { matchday: nextMatchday, matches: enriched })
    }

    // players by team - all tournaments
    if (resource === 'players-by-team') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const players = await db.select({ player: localPlayers, team: teams })
        .from(localPlayers)
        .innerJoin(teams, eq(localPlayers.teamId, teams.id))
        .where(eq(localPlayers.teamId, teamId))
        .orderBy(localPlayers.lastName)
      return ok(res, players.map((r: any) => ({ ...r.player, team: r.team })))
    }

    // full match detail with events
    if (resource === 'match-detail') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)

      const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
      if (!match) return err(res, 'Match not found', 404)

      const teamIds = [match.homeTeamId, match.awayTeamId].filter(Boolean) as number[]
      const teamsData = teamIds.length > 0 ? await db.select().from(teams).where(inArray(teams.id, teamIds)) : []
      const teamById = Object.fromEntries(teamsData.map((t: any) => [t.id, t]))

      const events = await db.select({ event: matchEvents, player: localPlayers })
        .from(matchEvents)
        .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
        .where(eq(matchEvents.matchId, matchId))
        .orderBy(matchEvents.minute)

      return ok(res, {
        ...match,
        homeTeam: match.homeTeamId ? teamById[match.homeTeamId] : null,
        awayTeam: match.awayTeamId ? teamById[match.awayTeamId] : null,
        events: events.map((r: any) => ({ ...r.event, player: r.player })),
      })
    }

    // match events for a match
    if (resource === 'match-events') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)
      const events = await db.select({
        event: matchEvents,
        player: localPlayers,
        team: teams,
      })
        .from(matchEvents)
        .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
        .leftJoin(teams, eq(matchEvents.teamId, teams.id))
        .where(eq(matchEvents.matchId, matchId))
        .orderBy(matchEvents.minute)
      return ok(res, events.map((r: any) => ({ ...r.event, player: r.player, team: r.team })))
    }

    // top scorers local - calculated from events
    if (resource === 'local-topscorers') {
      const events = await getTournamentEvents(db, tournamentId)
      const goalEvents = events.filter((e: any) => e.event.type === 'goal' && !e.event.isOwnGoal && e.player)
      const byPlayer: Record<number, any> = {}
      for (const e of goalEvents) {
        const pid = e.event.playerId
        if (!byPlayer[pid]) byPlayer[pid] = { ...e.player, team: e.team, goals: 0 }
        byPlayer[pid].goals++
      }
      return ok(res, Object.values(byPlayer).sort((a: any, b: any) => b.goals - a.goals))
    }

    // top assists local - calculated from events
    if (resource === 'local-topassists') {
      const events = await getTournamentEvents(db, tournamentId)
      const assistEvents = events.filter((e: any) => e.event.type === 'assist' && e.player)
      const byPlayer: Record<number, any> = {}
      for (const e of assistEvents) {
        const pid = e.event.playerId
        if (!byPlayer[pid]) byPlayer[pid] = { ...e.player, team: e.team, assists: 0 }
        byPlayer[pid].assists++
      }
      return ok(res, Object.values(byPlayer).sort((a: any, b: any) => b.assists - a.assists))
    }

    // top cards local - calculated from events
    if (resource === 'local-topcards') {
      const events = await getTournamentEvents(db, tournamentId)
      const cardEvents = events.filter((e: any) => (e.event.type === 'yellow' || e.event.type === 'red') && e.player)
      const byPlayer: Record<number, any> = {}
      for (const e of cardEvents) {
        const pid = e.event.playerId
        if (!byPlayer[pid]) byPlayer[pid] = { ...e.player, team: e.team, yellowCards: 0, redCards: 0 }
        if (e.event.type === 'yellow') byPlayer[pid].yellowCards++
        else byPlayer[pid].redCards++
      }
      return ok(res, Object.values(byPlayer).sort((a: any, b: any) => (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2)))
    }

    // all players for a tournament (for selects)
    if (resource === 'local-players') {
      const players = await db.select({ player: localPlayers, team: teams })
        .from(localPlayers)
        .innerJoin(teams, eq(localPlayers.teamId, teams.id))
        .where(eq(localPlayers.tournamentId, tournamentId))
        .orderBy(localPlayers.lastName)
      return ok(res, players.map((r: any) => ({ ...r.player, team: r.team })))
    }

    // teams by tournament
    if (resource === 'tournament-teams') {
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      const allTeams = []
      for (const group of groupsData) {
        const members = await db.select({ team: teams })
          .from(groupTeams)
          .innerJoin(teams, eq(groupTeams.teamId, teams.id))
          .where(eq(groupTeams.groupId, group.id))
        allTeams.push(...members.map((m: any) => m.team))
      }
      const unique = Array.from(new Map(allTeams.map((t: any) => [t.id, t])).values())
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      return ok(res, unique)
    }

    // player stats in tournament
    if (resource === 'player-stats') {
      const playerId = Number(req.query.playerId)
      if (!playerId) return err(res, 'playerId required', 400)

      const tournamentMatches = await db.select().from(matches)
        .where(eq(matches.tournamentId, tournamentId))
      const matchIds = tournamentMatches.map((m: any) => m.id)
      if (matchIds.length === 0) return ok(res, { played: 0, started: 0, subIn: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0 })

      // Get lineup entries for this player
      const lineupEntries = await db.select().from(matchLineups)
        .where(and(inArray(matchLineups.matchId, matchIds), eq(matchLineups.playerId, playerId)))

      // Get events
      const playerEvents = (await db.select({ event: matchEvents })
        .from(matchEvents)
        .where(and(inArray(matchEvents.matchId, matchIds), eq(matchEvents.playerId, playerId))))
        .map((r: any) => r.event)

      const subOutEvents = (await db.select({ event: matchEvents })
        .from(matchEvents)
        .where(and(inArray(matchEvents.matchId, matchIds), eq(matchEvents.playerOutId, playerId), eq(matchEvents.type, 'sub'))))
        .map((r: any) => r.event)

      // Stats from events
      const goals = playerEvents.filter((e: any) => e.type === 'goal' && !e.isOwnGoal).length
      const assists = playerEvents.filter((e: any) => e.type === 'assist').length
      const yellowCards = playerEvents.filter((e: any) => e.type === 'yellow').length
      const redCards = playerEvents.filter((e: any) => e.type === 'red').length
      const penaltySaves = playerEvents.filter((e: any) => e.type === 'save').length

      // Played/started from lineups (preferred) or events (fallback)
      const matchesAsStarter = new Set<number>()
      const matchesAsSubIn = new Set<number>()

      if (lineupEntries.length > 0) {
        // Use lineup data
        for (const l of lineupEntries) {
          if (l.isStarter) matchesAsStarter.add(l.matchId)
          else matchesAsSubIn.add(l.matchId)
        }
      } else {
        // Fallback to events
        for (const e of subOutEvents) matchesAsStarter.add(e.matchId)
        for (const e of playerEvents.filter((e: any) => e.type === 'sub')) matchesAsSubIn.add(e.matchId)
        for (const e of playerEvents) {
          if (e.type !== 'sub' && !matchesAsSubIn.has(e.matchId) && !matchesAsStarter.has(e.matchId)) {
            matchesAsStarter.add(e.matchId)
          }
        }
      }

      const started = matchesAsStarter.size
      const subIn = matchesAsSubIn.size
      const played = started + subIn

      // Minutes played
      let minutesPlayed = 0
      const subInEvents = playerEvents.filter((e: any) => e.type === 'sub')

      for (const matchId of matchesAsStarter) {
        const subOut = subOutEvents.find((e: any) => e.matchId === matchId)
        minutesPlayed += subOut?.minute ? subOut.minute : 90
      }
      for (const matchId of matchesAsSubIn) {
        const subInEvent = subInEvents.find((e: any) => e.matchId === matchId)
        minutesPlayed += subInEvent?.minute ? (90 - subInEvent.minute) : 45
      }

      return ok(res, { played, started, subIn, goals, assists, yellowCards, redCards, minutesPlayed, penaltySaves })
    }

    // knockout matches
    if (resource === 'knockout-fixtures') {
      const round = req.query.round as string | undefined
      const knockoutMatches = await db.select().from(matches)
        .where(and(
          eq(matches.tournamentId, tournamentId),
          eq(matches.phase, 'knockout'),
          ...(round ? [eq(matches.knockoutRound as any, round)] : [])
        ))
        .orderBy(matches.knockoutRound, matches.bracketPosition)

      if (knockoutMatches.length === 0) return ok(res, [])

      const teamIds = [...new Set(knockoutMatches.flatMap((m: any) =>
        [m.homeTeamId, m.awayTeamId].filter(Boolean)
      ))] as number[]
      const teamsData = teamIds.length > 0 ? await db.select().from(teams).where(inArray(teams.id, teamIds)) : []
      const teamById = Object.fromEntries(teamsData.map((t: any) => [t.id, t]))

      const matchIds = knockoutMatches.map((m: any) => m.id)
      const eventsData = matchIds.length > 0
        ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, matchIds))
        : []
      const eventCountByMatch: Record<number, number> = {}
      for (const e of eventsData) {
        eventCountByMatch[e.matchId] = (eventCountByMatch[e.matchId] ?? 0) + 1
      }

      const enriched = knockoutMatches.map((m: any) => ({
        ...m,
        homeTeam: m.homeTeamId ? teamById[m.homeTeamId] : null,
        awayTeam: m.awayTeamId ? teamById[m.awayTeamId] : null,
        eventCount: eventCountByMatch[m.id] ?? 0,
      }))
      return ok(res, enriched)
    }

    return err(res, 'Unknown resource', 400)
  } catch (error) {
    console.error(error)
    return err(res, 'Error fetching local data')
  }
}