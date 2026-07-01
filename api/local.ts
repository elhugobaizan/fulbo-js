import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, and, sql } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, tournaments, localPlayers, matchEvents, matchLineups, nationalTeams, players } from './_lib/tournament-schema'
import { ok, err } from './_lib/helpers'


// Resolve team data based on tournament type
async function resolveTeams(db: any, teamIds: number[], isNational: boolean): Promise<Record<number, any>> {
  if (teamIds.length === 0) return {}
  if (isNational) {
    const natTeams = await db.select({
      id: nationalTeams.id, name: nationalTeams.name,
      shortName: nationalTeams.name, logoUrl: nationalTeams.flagUrl,
      color: nationalTeams.color, alternateColor: nationalTeams.alternateColor,
    }).from(nationalTeams).where(inArray(nationalTeams.id, teamIds))
    return Object.fromEntries(natTeams.map((t: any) => [t.id, t]))
  }
  const clubTeams = await db.select().from(teams).where(inArray(teams.id, teamIds))
  return Object.fromEntries(clubTeams.map((t: any) => [t.id, t]))
}

function getDb() {
  return drizzle(neon(process.env.DATABASE_URL!))
}

async function isNationalTournament(db: any, tournamentId: number): Promise<boolean> {
  const [t] = await db.select({ teamType: tournaments.teamType }).from(tournaments).where(eq(tournaments.id, tournamentId))
  return (t as any)?.teamType === 'national'
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

async function getTournamentEvents(db: any, tournamentId: number, isNational: boolean) {
  const tournamentMatches = await db.select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
  const matchIds = tournamentMatches.map((m: any) => m.id)
  if (matchIds.length === 0) return []
  const teamTable = isNational ? nationalTeams : teams
  const rows = await db.select({
    event: matchEvents,
    link: localPlayers,
    person: players,
    team: teamTable,
  })
    .from(matchEvents)
    .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
    .leftJoin(players, eq(localPlayers.personId, players.id))
    .leftJoin(teamTable, eq(matchEvents.teamId, (teamTable as any).id))
    .where(inArray(matchEvents.matchId, matchIds))
  return rows.map((r: any) => ({
    event: r.event,
    player: r.link ? { ...r.link, firstName: r.person?.firstName, lastName: r.person?.lastName } : null,
    team: isNational && r.team ? { ...r.team, shortName: r.team.name, logoUrl: r.team.flagUrl } : r.team,
  }))
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
      const isNationalTeam = req.query.teamType === 'national'
      let rows: any[]
      if (isNationalTeam) {
        rows = await db.select({ tournament: tournaments, group: groups })
          .from(groupTeams)
          .innerJoin(groups, eq(groupTeams.groupId, groups.id))
          .innerJoin(tournaments, eq(groups.tournamentId, tournaments.id))
          .where(eq((groupTeams as any).nationalTeamId, teamId))
      } else {
        rows = await db.select({ tournament: tournaments, group: groups })
          .from(groupTeams)
          .innerJoin(groups, eq(groupTeams.groupId, groups.id))
          .innerJoin(tournaments, eq(groups.tournamentId, tournaments.id))
          .where(eq(groupTeams.teamId, teamId))
      }
      const unique = Array.from(new Map(rows.map((r: any) => [r.tournament.id, { ...r.tournament, groupName: r.group.name }])).values())
      return ok(res, unique)
    }

    // team info (no tournamentId needed)
    if (resource === 'team') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      if (req.query.teamType === 'national') {
        const [nt] = await db.select().from(nationalTeams).where(eq(nationalTeams.id, teamId))
        if (!nt) return err(res, 'National team not found', 404)
        return ok(res, { ...nt, shortName: nt.name, logoUrl: nt.flagUrl })
      }
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId))
      if (!team) return err(res, 'Team not found', 404)
      return ok(res, team)
    }

    // player memberships - todos los clubes/selecciones de la misma persona (no tournamentId needed)
    if (resource === 'player-memberships') {
      const linkId = Number(req.query.playerId) // local_players.id
      if (!linkId) return err(res, 'playerId required', 400)
      const [link] = await db.select().from(localPlayers).where(eq(localPlayers.id, linkId))
      if (!link) return ok(res, { clubs: [], nations: [] })
      const allLinks = await db.select({ link: localPlayers, team: teams, nationalTeam: nationalTeams })
        .from(localPlayers)
        .leftJoin(teams, eq(localPlayers.teamId, teams.id))
        .leftJoin(nationalTeams, eq(localPlayers.nationalTeamId, nationalTeams.id))
        .where(eq(localPlayers.personId, link.personId))
      const clubsMap = new Map<number, { name: string; logoUrl: string | null }>()
      const nationsMap = new Map<number, { name: string; logoUrl: string | null }>()
      for (const r of allLinks as any[]) {
        if (r.team) clubsMap.set(r.team.id, { name: r.team.name, logoUrl: r.team.logoUrl })
        if (r.nationalTeam) nationsMap.set(r.nationalTeam.id, { name: r.nationalTeam.name, logoUrl: r.nationalTeam.flagUrl })
      }
      return ok(res, { clubs: [...clubsMap.values()], nations: [...nationsMap.values()] })
    }

    // match lineup
    if (resource === 'match-lineup') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)
      const lineups = await db.select({ lineup: matchLineups, link: localPlayers, person: players })
        .from(matchLineups)
        .innerJoin(localPlayers, eq(matchLineups.playerId, localPlayers.id))
        .leftJoin(players, eq(localPlayers.personId, players.id))
        .where(eq(matchLineups.matchId, matchId))
        .orderBy(matchLineups.teamId, matchLineups.isStarter, players.lastName)
      return ok(res, lineups.map((r: any) => ({ ...r.lineup, player: { ...r.link, firstName: r.person?.firstName, lastName: r.person?.lastName } })))
    }

    // team fixtures - next matches for a team across all tournaments (no tournamentId needed)
    if (resource === 'team-fixtures') {
      const teamId = Number(req.query.teamId)
      if (!teamId) return err(res, 'teamId required', 400)
      const limit = Number(req.query.limit) || 3
      const isNationalTeam = req.query.teamType === 'national'

      const allMatches = await db.select().from(matches)

      // For national teams, only include matches from national tournaments (raw SQL since team_type was added via ALTER TABLE)
      let nationalTournamentIds: Set<number> | null = null
      if (isNationalTeam) {
        const raw = await db.execute(sql`SELECT id FROM tournaments WHERE team_type = 'national'`)
        nationalTournamentIds = new Set(((raw as any).rows ?? []).map((r: any) => Number(r.id)))
      }

      const all = req.query.all === 'true'
      const teamMatches = allMatches
        .filter((m: any) =>
          (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
          (all || (m.status !== 'finished' && m.scheduledAt !== null)) &&
          (!nationalTournamentIds || nationalTournamentIds.has(m.tournamentId))
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

      const teamById = await resolveTeams(db, teamIds, isNationalTeam)
      const tournamentsData = await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))

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
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        eventCount: eventCountByMatch[m.id] ?? 0,
      }))

      return ok(res, enriched)
    }

    if (!tournamentId) return err(res, 'tournamentId required', 400)

    // standings
    if (resource === 'standings') {
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      if (!tournament) return err(res, 'Tournament not found', 404)
      const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        let members: any[]
        if (isNational) {
          const rows = await db.select({ teamId: (groupTeams as any).nationalTeamId, team: nationalTeams })
            .from(groupTeams).innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id))
            .where(eq(groupTeams.groupId, group.id))
          members = rows.map((r: any) => ({ ...r, team: { ...r.team, logoUrl: r.team.flagUrl } }))
        } else {
          members = await db.select({ teamId: groupTeams.teamId, team: teams })
            .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id))
            .where(eq(groupTeams.groupId, group.id))
        }
        return { ...group, members }
      }))
      const allGroupMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group')
      const standingsData = groupsWithTeams.map(group => {
        const ids = new Set(group.members.map((m: any) => m.teamId).filter(Boolean))
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
      return ok(res, {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          season: tournament.season,
          qualifiersPerGroup: (tournament as any).qualifiersPerGroup ?? 2,
          wildcardQualifiers: (tournament as any).wildcardQualifiers ?? 0,
          teamType: (tournament as any).teamType ?? (tournament as any).team_type ?? 'club',
        },
        groups: standingsData
      })
    }

    // fixtures
    if (resource === 'fixtures') {
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
      const matchday = req.query.matchday ? Number(req.query.matchday) : null
      const allMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group' && m.matchday !== null)
      const allMatchdays = [...new Set(allMatches.map((m: any) => m.matchday as number))].sort((a, b) => a - b)
      let target = matchday
      if (!target) {
        const pending = allMatches.filter((m: any) => m.status !== 'finished').sort((a: any, b: any) => a.matchday - b.matchday)
        target = pending[0]?.matchday ?? allMatchdays[allMatchdays.length - 1] ?? null
      }
      if (!target) return ok(res, { matchday: null, matchdays: allMatchdays, matches: [] })
      const dayMatches = allMatches.filter((m: any) => m.matchday === target)
      const teamIds = [...new Set(dayMatches.flatMap((m: any) => [m.homeTeamId, m.awayTeamId].filter(Boolean)))] as number[]
      const teamById = await resolveTeams(db, teamIds, isNational)
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
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
      const allMatches = (await db.select().from(matches).where(eq(matches.tournamentId, tournamentId)))
        .filter((m: any) => m.phase === 'group' && m.matchday !== null)
      const pending = allMatches.filter((m: any) => m.status !== 'finished').sort((a: any, b: any) => a.matchday - b.matchday)
      if (pending.length === 0) return ok(res, { matchday: null, matches: [] })
      const nextMatchday = pending[0].matchday!
      const nextMatches = pending.filter((m: any) => m.matchday === nextMatchday)
      const teamIds = [...new Set(nextMatches.flatMap((m: any) => [m.homeTeamId, m.awayTeamId].filter(Boolean)))] as number[]
      const teamById = await resolveTeams(db, teamIds, isNational)
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
      const isNationalTeam = req.query.teamType === 'national'
      const teamTable = isNationalTeam ? nationalTeams : teams
      const teamFk = isNationalTeam ? localPlayers.nationalTeamId : localPlayers.teamId
      const rows = await db.select({ link: localPlayers, person: players, team: teamTable })
        .from(localPlayers)
        .innerJoin(players, eq(localPlayers.personId, players.id))
        .innerJoin(teamTable, eq(teamFk, (teamTable as any).id))
        .where(eq(teamFk, teamId))
        .orderBy(players.lastName)
      return ok(res, rows.map((r: any) => ({
        ...r.link, firstName: r.person.firstName, lastName: r.person.lastName,
        team: isNationalTeam ? { ...r.team, shortName: r.team.name, logoUrl: r.team.flagUrl } : r.team,
      })))
    }

    // full match detail with events
    if (resource === 'match-detail') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)

      const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
      if (!match) return err(res, 'Match not found', 404)

      const [matchTournament] = await db.select().from(tournaments).where(eq(tournaments.id, match.tournamentId))
      const isNational = (matchTournament as any)?.teamType === 'national' || (matchTournament as any)?.team_type === 'national'

      const teamIds = [match.homeTeamId, match.awayTeamId].filter(Boolean) as number[]
      const teamById = await resolveTeams(db, teamIds, isNational)

      const events = await db.select({ event: matchEvents, link: localPlayers, person: players })
        .from(matchEvents)
        .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
        .leftJoin(players, eq(localPlayers.personId, players.id))
        .where(eq(matchEvents.matchId, matchId))
        .orderBy(matchEvents.minute)

      return ok(res, {
        ...match,
        isNational,
        homeTeam: match.homeTeamId ? teamById[match.homeTeamId] : null,
        awayTeam: match.awayTeamId ? teamById[match.awayTeamId] : null,
        events: events.map((r: any) => ({ ...r.event, player: r.link ? { ...r.link, firstName: r.person?.firstName, lastName: r.person?.lastName } : null })),
      })
    }

    // match events for a match
    if (resource === 'match-events') {
      const matchId = Number(req.query.matchId)
      if (!matchId) return err(res, 'matchId required', 400)
      const [eventsMatch] = await db.select({ tournamentId: matches.tournamentId }).from(matches).where(eq(matches.id, matchId))
      const isNational = eventsMatch ? await isNationalTournament(db, eventsMatch.tournamentId) : false
      const teamTable = isNational ? nationalTeams : teams
      const events = await db.select({
        event: matchEvents,
        link: localPlayers,
        person: players,
        team: teamTable,
      })
        .from(matchEvents)
        .leftJoin(localPlayers, eq(matchEvents.playerId, localPlayers.id))
        .leftJoin(players, eq(localPlayers.personId, players.id))
        .leftJoin(teamTable, eq(matchEvents.teamId, (teamTable as any).id))
        .where(eq(matchEvents.matchId, matchId))
        .orderBy(matchEvents.minute)
      return ok(res, events.map((r: any) => ({
        ...r.event,
        player: r.link ? { ...r.link, firstName: r.person?.firstName, lastName: r.person?.lastName } : null,
        team: isNational && r.team ? { ...r.team, shortName: r.team.name, logoUrl: r.team.flagUrl } : r.team,
      })))
    }

    // top scorers local - calculated from events
    if (resource === 'local-topscorers') {
      const events = await getTournamentEvents(db, tournamentId, await isNationalTournament(db, tournamentId))
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
      const events = await getTournamentEvents(db, tournamentId, await isNationalTournament(db, tournamentId))
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
      const events = await getTournamentEvents(db, tournamentId, await isNationalTournament(db, tournamentId))
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
      const isNational = await isNationalTournament(db, tournamentId)
      const teamTable = isNational ? nationalTeams : teams
      const teamFk = isNational ? localPlayers.nationalTeamId : localPlayers.teamId
      const rows = await db.select({ link: localPlayers, person: players, team: teamTable })
        .from(localPlayers)
        .innerJoin(players, eq(localPlayers.personId, players.id))
        .innerJoin(teamTable, eq(teamFk, (teamTable as any).id))
        .where(eq(localPlayers.tournamentId, tournamentId))
        .orderBy(players.lastName)
      return ok(res, rows.map((r: any) => ({
        ...r.link, firstName: r.person.firstName, lastName: r.person.lastName,
        team: isNational ? { ...r.team, shortName: r.team.name, logoUrl: r.team.flagUrl } : r.team,
      })))
    }

    // teams by tournament
    if (resource === 'tournament-teams') {
      const isNational = await isNationalTournament(db, tournamentId)
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      const allTeams = []
      for (const group of groupsData) {
        if (isNational) {
          const members = await db.select({ team: nationalTeams })
            .from(groupTeams)
            .innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id))
            .where(eq(groupTeams.groupId, group.id))
          allTeams.push(...members.map((m: any) => ({ ...m.team, shortName: m.team.name, logoUrl: m.team.flagUrl })))
        } else {
          const members = await db.select({ team: teams })
            .from(groupTeams)
            .innerJoin(teams, eq(groupTeams.teamId, teams.id))
            .where(eq(groupTeams.groupId, group.id))
          allTeams.push(...members.map((m: any) => m.team))
        }
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
      const [knockoutTournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      const isNational = (knockoutTournament as any)?.teamType === 'national' || (knockoutTournament as any)?.team_type === 'national'
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
      const teamById = await resolveTeams(db, teamIds, isNational)

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