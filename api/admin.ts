import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, tournaments, bracketRules, localPlayers, matchEvents, matchLineups, nationalTeams } from './_lib/tournament-schema'
import { ok, err } from './_lib/helpers'

function getDb() {
  return drizzle(neon(process.env.DATABASE_URL!))
}

function checkAuth(req: VercelRequest): boolean {
  return req.headers['x-admin-token'] === process.env.ADMIN_PASSWORD
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query
  const db = getDb()

  // ── Public: auth ──────────────────────────────────────────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const { password } = req.body
    if (!password) return err(res, 'Password required', 400)
    if (password !== process.env.ADMIN_PASSWORD) return err(res, 'Invalid password', 401)
    return ok(res, { authenticated: true })
  }

  // ── Protected routes ──────────────────────────────────────────────────────
  if (!checkAuth(req)) return err(res, 'Unauthorized', 401)

  try {
    // tournament data
    if (action === 'tournament' && req.method === 'GET') {
      const tournamentId = Number(req.query.tournamentId)
      if (!tournamentId) return err(res, 'tournamentId required', 400)
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      if (!tournament) return err(res, 'Not found', 404)
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        const clubMembers = !isNational ? await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName, logoUrl: teams.logoUrl, color: teams.color })
          .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id)).where(eq(groupTeams.groupId, group.id)) : []
        const nationalMembers = isNational ? await db.select({ id: nationalTeams.id, name: nationalTeams.name, shortName: nationalTeams.name, logoUrl: nationalTeams.flagUrl, color: nationalTeams.color })
          .from(groupTeams).innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id)).where(eq(groupTeams.groupId, group.id)) : []
        return { ...group, teams: [...clubMembers, ...nationalMembers] }
      }))
      const existingMatches = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId))
      return ok(res, { tournament, groups: groupsWithTeams, matches: existingMatches })
    }

    // matches CRUD
    if (action === 'matches') {
      if (req.method === 'POST') {
        const { tournamentId, phase, groupId, matchday, knockoutRound, bracketPosition, homeTeamId, awayTeamId, scheduledAt } = req.body
        if (!tournamentId || !homeTeamId || !awayTeamId) return err(res, 'Missing fields', 400)
        let resolvedGroupId = groupId ?? null
        if (phase === 'group' && !resolvedGroupId && homeTeamId) {
          const rows = await db.select().from(groupTeams).where(eq(groupTeams.teamId, homeTeamId))
          resolvedGroupId = rows[0]?.groupId ?? null
        }
        const [match] = await db.insert(matches).values({ tournamentId, phase, groupId: resolvedGroupId, matchday: matchday ?? null, knockoutRound: knockoutRound ?? null, bracketPosition: bracketPosition ?? null, homeTeamId, awayTeamId, status: 'scheduled', scheduledAt: scheduledAt ? new Date(scheduledAt) : null }).returning()
        return res.status(201).json({ data: match })
      }
      if (req.method === 'PATCH') {
        const { matchId, homeScore, awayScore, homePenalties, awayPenalties, status, espnMatchId } = req.body
        if (!matchId) return err(res, 'matchId required', 400)
        const setFields: any = { updatedAt: new Date() }
        if (homeScore !== undefined) setFields.homeScore = homeScore ?? null
        if (awayScore !== undefined) setFields.awayScore = awayScore ?? null
        if (homePenalties !== undefined) setFields.homePenalties = homePenalties ?? null
        if (awayPenalties !== undefined) setFields.awayPenalties = awayPenalties ?? null
        if (status !== undefined) setFields.status = status
        if (espnMatchId !== undefined) setFields.espnMatchId = espnMatchId
        const [updated] = await db.update(matches).set(setFields).where(eq(matches.id, matchId)).returning()
        return ok(res, updated)
      }
    }

    // bracket-rules CRUD
    if (action === 'bracket-rules') {
      if (req.method === 'GET') {
        const tournamentId = Number(req.query.tournamentId)
        if (!tournamentId || isNaN(tournamentId)) return ok(res, [])
        const rulesRaw = await db.execute(sql`SELECT * FROM bracket_rules WHERE tournament_id = ${tournamentId}`)
        const rules = ((rulesRaw as any).rows ?? []).map((r: any) => ({
          id: r.id, tournamentId: r.tournament_id, knockoutRound: r.knockout_round,
          bracketPosition: r.bracket_position, homeGroupId: r.home_group_id,
          homePosition: r.home_position, awayGroupId: r.away_group_id,
          awayPosition: r.away_position, homeWinnerOf: r.home_winner_of,
          awayWinnerOf: r.away_winner_of, wildcardGroupIds: r.wildcard_group_ids,
          createdAt: r.created_at,
        }))
        return ok(res, rules)
      }
      if (req.method === 'POST') {
        const { tournamentId, knockoutRound, bracketPosition, homeGroupId, homePosition, awayGroupId, awayPosition, homeWinnerOf, awayWinnerOf, wildcardGroupIds } = req.body
        if (!tournamentId || !knockoutRound || !bracketPosition) return err(res, 'Missing fields', 400)
        // Use raw SQL to include wildcard_group_ids which was added via ALTER TABLE
        const rows = await db.execute(sql`
          INSERT INTO bracket_rules
            (tournament_id, knockout_round, bracket_position, home_group_id, home_position,
             away_group_id, away_position, home_winner_of, away_winner_of, wildcard_group_ids)
          VALUES
            (${Number(tournamentId)}, ${knockoutRound}, ${Number(bracketPosition)},
             ${homeGroupId ?? null}, ${homePosition ?? null},
             ${awayGroupId ?? null}, ${awayPosition ?? null},
             ${homeWinnerOf ?? null}, ${awayWinnerOf ?? null},
             ${wildcardGroupIds ?? null})
          RETURNING *
        `)
        const rule = (rows as any).rows?.[0] ?? {}
        return res.status(201).json({ data: rule })
      }
      if (req.method === 'DELETE') {
        const ruleId = Number(req.query.ruleId)
        if (!ruleId) return err(res, 'ruleId required', 400)
        await db.delete(bracketRules).where(eq(bracketRules.id, ruleId))
        return res.status(204).end()
      }
    }

    // setup
    if (action === 'setup-tournament' && req.method === 'POST') {
      const { name, shortName, country, season, hasGroups, qualifiersPerGroup, wildcardQualifiers, allowCrossGroup, teamType } = req.body
      if (!name || !season) return err(res, 'name and season required', 400)
      const [tournament] = await db.insert(tournaments).values({ name, shortName: shortName ?? null, country: country ?? null, season: Number(season), hasGroups: hasGroups ?? true, qualifiersPerGroup: Number(qualifiersPerGroup) || 2, wildcardQualifiers: Number(wildcardQualifiers) || 0, allowCrossGroup: allowCrossGroup ?? false, teamType: teamType ?? 'club', active: true }).returning()
      return res.status(201).json({ data: tournament })
    }

    if (action === 'setup-group' && req.method === 'POST') {
      const { tournamentId, name } = req.body
      if (!tournamentId || !name) return err(res, 'Missing fields', 400)
      const [group] = await db.insert(groups).values({ tournamentId: Number(tournamentId), name }).returning()
      return res.status(201).json({ data: group })
    }

    if (action === 'setup-team' && req.method === 'POST') {
      const { groupId, name, shortName, country } = req.body
      if (!groupId || !name) return err(res, 'Missing fields', 400)
      const [team] = await db.insert(teams).values({ name, shortName: (shortName || name).slice(0, 20), country: country ?? null }).returning()
      await db.insert(groupTeams).values({ groupId: Number(groupId), teamId: team.id })
      return res.status(201).json({ data: team })
    }

    // teams CRUD
    if (action === 'teams') {
      if (req.method === 'GET') {
        const allTeams = await db.select().from(teams).orderBy(teams.name)
        return ok(res, allTeams)
      }
      if (req.method === 'POST') {
        const { name, shortName, country } = req.body
        if (!name) return err(res, 'name required', 400)
        const [team] = await db.insert(teams).values({
          name, shortName: (shortName || name).slice(0, 20), country: country ?? null
        }).returning()
        return res.status(201).json({ data: team })
      }
    }

    // list all tournaments
    if (action === 'tournaments' && req.method === 'GET') {
      const all = await db.select().from(tournaments).orderBy(tournaments.season)
      return ok(res, all)
    }

    // set active tournament
    if (action === 'activate-tournament' && req.method === 'POST') {
      const { tournamentId } = req.body
      if (!tournamentId) return err(res, 'tournamentId required', 400)
      await db.update(tournaments).set({ active: false })
      await db.update(tournaments).set({ active: true }).where(eq(tournaments.id, tournamentId))
      return ok(res, { activated: tournamentId })
    }

    // delete tournament (cleanup incomplete wizard)
    if (action === 'delete-tournament' && req.method === 'DELETE') {
      const tournamentId = Number(req.query.tournamentId)
      if (!tournamentId) return err(res, 'tournamentId required', 400)
      // cascade: delete matches, group_teams, groups, bracket_rules, then tournament
      await db.delete(matches).where(eq(matches.tournamentId, tournamentId))
      await db.delete(bracketRules).where(eq(bracketRules.tournamentId, tournamentId))
      const groupsToDelete = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId))
      for (const g of groupsToDelete) {
        await db.delete(groupTeams).where(eq(groupTeams.groupId, g.id))
      }
      await db.delete(groups).where(eq(groups.tournamentId, tournamentId))
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId))
      return res.status(204).end()
    }

    // remove team from group
    if (action === 'remove-team' && req.method === 'DELETE') {
      const groupId = Number(req.query.groupId)
      const teamId = Number(req.query.teamId)
      if (!groupId || !teamId) return err(res, 'groupId and teamId required', 400)
      await db.delete(groupTeams).where(
        and(eq(groupTeams.groupId, groupId), eq(groupTeams.teamId, teamId))
      )
      return res.status(204).end()
    }

    // assign existing team to group
    if (action === 'assign-team' && req.method === 'POST') {
      const { groupId, teamId } = req.body
      if (!groupId || !teamId) return err(res, 'groupId and teamId required', 400)
      await db.insert(groupTeams).values({ groupId: Number(groupId), teamId: Number(teamId) }).onConflictDoNothing()
      return ok(res, { groupId, teamId })
    }

    // national teams CRUD
    if (action === 'national-teams' && req.method === 'GET') {
      const all = await db.select().from(nationalTeams).orderBy(nationalTeams.name)
      return ok(res, all)
    }

    if (action === 'setup-national-team' && req.method === 'POST') {
      const { name, fifaCode, confederation, color, flagUrl } = req.body
      if (!name || !fifaCode) return err(res, 'name and fifaCode required', 400)
      // Upsert by fifaCode
      const existing = await db.select().from(nationalTeams).where(eq(nationalTeams.fifaCode, fifaCode.toUpperCase()))
      if (existing.length > 0) return res.status(200).json({ data: existing[0] })
      const [nt] = await db.insert(nationalTeams).values({
        name, fifaCode: fifaCode.toUpperCase(),
        confederation: confederation ?? null,
        color: color ?? null,
        flagUrl: flagUrl ?? null,
      }).returning()
      return res.status(201).json({ data: nt })
    }

    if (action === 'assign-national-team' && req.method === 'POST') {
      const { groupId, nationalTeamId } = req.body
      if (!groupId || !nationalTeamId) return err(res, 'groupId and nationalTeamId required', 400)
      await db.insert(groupTeams).values({ groupId: Number(groupId), nationalTeamId: Number(nationalTeamId) }).onConflictDoNothing()
      return ok(res, { groupId, nationalTeamId })
    }

    if (action === 'remove-national-team' && req.method === 'DELETE') {
      const groupId = Number(req.query.groupId)
      const nationalTeamId = Number(req.query.nationalTeamId)
      if (!groupId || !nationalTeamId) return err(res, 'groupId and nationalTeamId required', 400)
      await db.delete(groupTeams).where(
        and(eq(groupTeams.groupId, groupId), eq((groupTeams as any).nationalTeamId, nationalTeamId))
      )
      return res.status(204).end()
    }

    // create match event
    if (action === 'create-event' && req.method === 'POST') {
      const { matchId, minute, type, playerId, playerOutId, teamId, isPenalty, isOwnGoal } = req.body
      if (!matchId || !type || !teamId) return err(res, 'Missing fields', 400)
      const [event] = await db.insert(matchEvents).values({
        matchId: Number(matchId),
        minute: minute ? Number(minute) : null,
        type,
        playerId: playerId ? Number(playerId) : null,
        playerOutId: playerOutId ? Number(playerOutId) : null,
        teamId: Number(teamId),
        isPenalty: isPenalty ?? false,
        isOwnGoal: isOwnGoal ?? false,
      }).returning()
      return res.status(201).json({ data: event })
    }

    // update match event
    if (action === 'update-event' && req.method === 'PATCH') {
      const { eventId, minute, playerId } = req.body
      if (!eventId) return err(res, 'eventId required', 400)
      const [updated] = await db.update(matchEvents)
        .set({
          ...(minute !== undefined ? { minute: minute ? Number(minute) : null } : {}),
          ...(playerId !== undefined ? { playerId: playerId ? Number(playerId) : null } : {}),
        })
        .where(eq(matchEvents.id, Number(eventId)))
        .returning()
      return ok(res, updated)
    }

    // delete match event
    if (action === 'delete-event' && req.method === 'DELETE') {
      const eventId = Number(req.query.eventId)
      if (!eventId) return err(res, 'eventId required', 400)
      await db.delete(matchEvents).where(eq(matchEvents.id, eventId))
      return res.status(204).end()
    }

    // create local player
    if (action === 'create-player' && req.method === 'POST') {
      const { firstName, lastName, teamId, tournamentId, position } = req.body
      if (!firstName || !lastName || !teamId || !tournamentId) return err(res, 'Missing fields', 400)
      const [player] = await db.insert(localPlayers).values({
        firstName, lastName, position: position ?? null,
        teamId: Number(teamId),
        tournamentId: Number(tournamentId),
      }).returning()
      return res.status(201).json({ data: player })
    }

    // edit local player
    if (action === 'edit-player' && req.method === 'POST') {
      const { playerId, firstName, lastName, teamId, position } = req.body
      if (!playerId || !firstName || !lastName || !teamId) return err(res, 'Missing fields', 400)
      const [player] = await db.update(localPlayers).set({
        firstName,
        lastName,
        position: position ?? null,
        teamId: Number(teamId),
      }).where(eq(localPlayers.id, Number(playerId))).returning()
      return ok(res, { data: player })
    }

    // set match lineup
    if (action === 'set-lineup' && req.method === 'POST') {
      const { matchId, teamId, players } = req.body
      // players = [{ playerId, isStarter, shirtNumber }]
      if (!matchId || !teamId || !players) return err(res, 'Missing fields', 400)
      // Delete existing lineup for this team in this match
      await db.delete(matchLineups).where(
        and(eq(matchLineups.matchId, Number(matchId)), eq(matchLineups.teamId, Number(teamId)))
      )
      // Insert new lineup
      if (players.length > 0) {
        await db.insert(matchLineups).values(
          players.map((p: any) => ({
            matchId: Number(matchId),
            teamId: Number(teamId),
            playerId: Number(p.playerId),
            isStarter: p.isStarter ?? true,
            shirtNumber: p.shirtNumber ? Number(p.shirtNumber) : null,
          }))
        )
      }
      return ok(res, { matchId, teamId, count: players.length })
    }

    // activate knockout phase
    if (action === 'activate-knockout' && req.method === 'POST') {
      const { tournamentId } = req.body
      if (!tournamentId) return err(res, 'tournamentId required', 400)
      await db.update(tournaments).set({ knockoutStarted: true } as any).where(eq(tournaments.id, Number(tournamentId)))
      return ok(res, { activated: true })
    }

    // update knockout match date
    if (action === 'set-match-date' && req.method === 'PATCH') {
      const { matchId, scheduledAt } = req.body
      if (!matchId) return err(res, 'matchId required', 400)
      const [updated] = await db.update(matches)
        .set({ scheduledAt: scheduledAt ? new Date(scheduledAt) : null, updatedAt: new Date() } as any)
        .where(eq(matches.id, Number(matchId)))
        .returning()
      return ok(res, updated)
    }

    // generate knockout matches from bracket rules + standings
    if (action === 'generate-knockout' && req.method === 'POST') {
      const { tournamentId, round } = req.body
      if (!tournamentId || !round) return err(res, 'tournamentId and round required', 400)
      if (!tournamentId) return err(res, 'tournamentId required', 400)
      const tid = Number(tournamentId)

      // Check if matches already exist
      const existing = await db.select().from(matches).where(
        and(eq(matches.tournamentId, tid), eq(matches.phase, 'knockout'))
      )
      if (existing.length > 0) return err(res, 'Knockout matches already generated', 400)

      // Get bracket rules for this round via raw SQL (includes wildcard_group_ids)
      const rulesRaw = await db.execute(sql`
        SELECT * FROM bracket_rules WHERE tournament_id = ${tid} AND knockout_round = ${round}
      `)
      const rules = ((rulesRaw as any).rows ?? []).map((r: any) => ({
        id: r.id, tournamentId: r.tournament_id, knockoutRound: r.knockout_round,
        bracketPosition: r.bracket_position, homeGroupId: r.home_group_id,
        homePosition: r.home_position, awayGroupId: r.away_group_id,
        awayPosition: r.away_position, homeWinnerOf: r.home_winner_of,
        awayWinnerOf: r.away_winner_of, wildcardGroupIds: r.wildcard_group_ids,
      }))

      // Get tournament and groups
      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tid))
      if (!tournament) return err(res, 'Tournament not found', 404)
      const groupsData = await db.select().from(groups).where(eq(groups.tournamentId, tid))
      const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        let members: any[]
        if (isNational) {
          const rows = await db.select({ teamId: (groupTeams as any).nationalTeamId, team: nationalTeams })
            .from(groupTeams).innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id))
            .where(eq(groupTeams.groupId, group.id))
          members = rows.map((r: any) => ({ teamId: r.teamId, team: { ...r.team, logoUrl: r.team.flagUrl } }))
        } else {
          members = await db.select({ teamId: groupTeams.teamId, team: teams })
            .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id))
            .where(eq(groupTeams.groupId, group.id))
        }
        return { ...group, members }
      }))

      // Get all finished group matches
      const allGroupMatches = await db.select().from(matches).where(
        and(eq(matches.tournamentId, tid), eq(matches.phase, 'group'))
      )

      // Calculate standings per group
      const standingsByGroup: Record<number, any[]> = {}
      for (const group of groupsWithTeams) {
        const gTeamIds = new Set(group.members.map((m: any) => m.teamId))
        const relevant = allGroupMatches.filter((m: any) =>
          m.status === 'finished' && (gTeamIds.has(m.homeTeamId) || gTeamIds.has(m.awayTeamId))
        )
        const stats: Record<number, any> = {}
        for (const gt of group.members) {
          if (!gt.teamId) continue
          stats[gt.teamId] = { teamId: gt.teamId, team: gt.team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
        }
        for (const m of relevant) {
          const hg = m.homeScore ?? 0, ag = m.awayScore ?? 0
          if (m.homeTeamId && gTeamIds.has(m.homeTeamId)) {
            const h = stats[m.homeTeamId]; h.played++; h.goalsFor += hg; h.goalsAgainst += ag
            if (hg > ag) { h.won++; h.points += 3 } else if (hg < ag) h.lost++; else { h.drawn++; h.points++ }
          }
          if (m.awayTeamId && gTeamIds.has(m.awayTeamId)) {
            const a = stats[m.awayTeamId]; a.played++; a.goalsFor += ag; a.goalsAgainst += hg
            if (ag > hg) { a.won++; a.points += 3 } else if (ag < hg) a.lost++; else { a.drawn++; a.points++ }
          }
        }
        standingsByGroup[group.id] = Object.values(stats).sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points
          const da = a.goalsFor - a.goalsAgainst, db2 = b.goalsFor - b.goalsAgainst
          if (db2 !== da) return db2 - da
          return b.goalsFor - a.goalsFor
        })
      }

      // Build global wildcard pool from all groups referenced in wildcardGroupIds
      const qualifiersPerGroup = (tournament as any).qualifiersPerGroup ?? 2
      const wildcardPos = qualifiersPerGroup // 0-indexed position after last auto-qualifier

      const allWcGroupIds = new Set<number>()
      for (const rule of rules) {
        if ((rule as any).wildcardGroupIds) {
          (rule as any).wildcardGroupIds.split(',').map(Number).forEach((id: number) => allWcGroupIds.add(id))
        }
      }

      const wildcardRanked: any[] = []
      if (allWcGroupIds.size > 0) {
        for (const gid of allWcGroupIds) {
          const wildcard = standingsByGroup[gid]?.[wildcardPos]
          if (wildcard) wildcardRanked.push(wildcard)
        }
        wildcardRanked.sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points
          const da = a.goalsFor - a.goalsAgainst, db2 = b.goalsFor - b.goalsAgainst
          if (db2 !== da) return db2 - da
          return b.goalsFor - a.goalsFor
        })
      }
      let wildcardIndex = 0

      const resolveTeam = (groupId: number | null, position: number | null, wcGroupIds?: string | null) => {
        // Wildcard slot: groupId is null and wildcardGroupIds is present
        if (groupId === null && wcGroupIds) {
          const wc = wildcardRanked[wildcardIndex++] ?? null
          return wc?.team ?? null
        }
        if (groupId === null || position === null) return null
        return standingsByGroup[groupId]?.[position - 1]?.team ?? null
      }

      const created = []
      for (const rule of rules.sort((a: any, b: any) => a.bracketPosition - b.bracketPosition)) {
        const homeTeam = resolveTeam(rule.homeGroupId, rule.homePosition, (rule as any).wildcardGroupIds)
        const awayTeam = resolveTeam(rule.awayGroupId, rule.awayPosition, (rule as any).wildcardGroupIds)

        const [match] = await db.insert(matches).values({
          tournamentId: tid,
          phase: 'knockout',
          knockoutRound: round,
          bracketPosition: rule.bracketPosition,
          homeTeamId: homeTeam?.id ?? null,
          awayTeamId: awayTeam?.id ?? null,
          status: 'scheduled',
          scheduledAt: null,
        } as any).returning()
        created.push(match)
      }

      return ok(res, { created: created.length })
    }

    // wildcard slot candidates: teams eligible for a wildcard slot (e.g. "3° B/C/D") of a knockout match
    if (action === 'wildcard-candidates' && req.method === 'GET') {
      const tournamentId = Number(req.query.tournamentId)
      const knockoutRound = req.query.knockoutRound
      const bracketPosition = Number(req.query.bracketPosition)
      const side = req.query.side
      if (!tournamentId || !knockoutRound || !bracketPosition || (side !== 'home' && side !== 'away')) {
        return err(res, 'tournamentId, knockoutRound, bracketPosition and side required', 400)
      }

      const [rule] = await db.select().from(bracketRules).where(and(
        eq(bracketRules.tournamentId, tournamentId),
        eq(bracketRules.knockoutRound, knockoutRound as any),
        eq(bracketRules.bracketPosition, bracketPosition)
      ))
      if (!rule?.wildcardGroupIds) return ok(res, [])

      const position = side === 'home' ? rule.homePosition : rule.awayPosition
      if (!position) return ok(res, [])
      const wcGroupIds = rule.wildcardGroupIds.split(',').map(Number)

      const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
      const isNational = (tournament as any)?.teamType === 'national'

      const groupsData = await db.select().from(groups).where(inArray(groups.id, wcGroupIds))
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        const members = isNational
          ? (await db.select({ teamId: (groupTeams as any).nationalTeamId, team: nationalTeams })
            .from(groupTeams).innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id))
            .where(eq(groupTeams.groupId, group.id))).map((r: any) => ({ ...r, team: { ...r.team, logoUrl: r.team.flagUrl, shortName: r.team.name } }))
          : await db.select({ teamId: groupTeams.teamId, team: teams })
            .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id))
            .where(eq(groupTeams.groupId, group.id))
        return { ...group, members }
      }))

      const allGroupMatches = await db.select().from(matches).where(and(
        eq(matches.tournamentId, tournamentId), eq(matches.phase, 'group'), eq(matches.status, 'finished')
      ))

      const candidates = groupsWithTeams.flatMap((group) => {
        const gTeamIds = new Set(group.members.map((m: any) => m.teamId).filter(Boolean))
        const relevant = allGroupMatches.filter((m: any) => gTeamIds.has(m.homeTeamId) || gTeamIds.has(m.awayTeamId))
        const stats: Record<number, any> = {}
        for (const gt of group.members as any[]) {
          if (!gt.teamId) continue
          stats[gt.teamId] = { teamId: gt.teamId, team: gt.team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
        }
        for (const m of relevant) {
          const hg = m.homeScore ?? 0, ag = m.awayScore ?? 0
          if (m.homeTeamId && gTeamIds.has(m.homeTeamId)) {
            const h = stats[m.homeTeamId]; h.played++; h.goalsFor += hg; h.goalsAgainst += ag
            if (hg > ag) { h.won++; h.points += 3 } else if (hg < ag) h.lost++; else { h.drawn++; h.points++ }
          }
          if (m.awayTeamId && gTeamIds.has(m.awayTeamId)) {
            const a = stats[m.awayTeamId]; a.played++; a.goalsFor += ag; a.goalsAgainst += hg
            if (ag > hg) { a.won++; a.points += 3 } else if (ag < hg) a.lost++; else { a.drawn++; a.points++ }
          }
        }
        const ranked: any[] = Object.values(stats).sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points
          const da = a.goalsFor - a.goalsAgainst, db2 = b.goalsFor - b.goalsAgainst
          if (db2 !== da) return db2 - da
          return b.goalsFor - a.goalsFor
        })
        const candidate = ranked[position - 1]
        return candidate ? [{ ...candidate, groupId: group.id, groupName: group.name }] : []
      })

      candidates.sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points
        const da = a.goalsFor - a.goalsAgainst, db2 = b.goalsFor - b.goalsAgainst
        if (db2 !== da) return db2 - da
        return b.goalsFor - a.goalsFor
      })

      return ok(res, candidates)
    }

    // manually override which team fills a knockout match slot (e.g. wrong wildcard auto-assigned)
    if (action === 'set-match-team' && req.method === 'PATCH') {
      const { matchId, side, teamId } = req.body
      if (!matchId || !teamId || (side !== 'home' && side !== 'away')) {
        return err(res, 'matchId, side and teamId required', 400)
      }
      const setFields = side === 'home'
        ? { homeTeamId: Number(teamId), updatedAt: new Date() }
        : { awayTeamId: Number(teamId), updatedAt: new Date() }
      const [updated] = await db.update(matches).set(setFields as any).where(eq(matches.id, Number(matchId))).returning()
      return ok(res, updated)
    }

    return err(res, 'Unknown action', 400)
  } catch (error) {
    console.error(error)
    return err(res, 'Server error')
  }
}