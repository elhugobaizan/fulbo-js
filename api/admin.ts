import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, tournaments, bracketRules, localPlayers, matchEvents } from './_lib/tournament-schema'
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
      const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
        const members = await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName, logoUrl: teams.logoUrl })
          .from(groupTeams).innerJoin(teams, eq(groupTeams.teamId, teams.id)).where(eq(groupTeams.groupId, group.id))
        return { ...group, teams: members }
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
        const { matchId, homeScore, awayScore, homePenalties, awayPenalties, status } = req.body
        if (!matchId) return err(res, 'matchId required', 400)
        const [updated] = await db.update(matches).set({ homeScore: homeScore ?? null, awayScore: awayScore ?? null, homePenalties: homePenalties ?? null, awayPenalties: awayPenalties ?? null, status: status ?? 'finished', updatedAt: new Date() }).where(eq(matches.id, matchId)).returning()
        return ok(res, updated)
      }
    }

    // bracket-rules CRUD
    if (action === 'bracket-rules') {
      if (req.method === 'GET') {
        const tournamentId = Number(req.query.tournamentId)
        const rules = await db.select().from(bracketRules).where(eq(bracketRules.tournamentId, tournamentId))
        return ok(res, rules)
      }
      if (req.method === 'POST') {
        const { tournamentId, knockoutRound, bracketPosition, homeGroupId, homePosition, awayGroupId, awayPosition, homeWinnerOf, awayWinnerOf } = req.body
        if (!tournamentId || !knockoutRound || !bracketPosition) return err(res, 'Missing fields', 400)
        const [rule] = await db.insert(bracketRules).values({ tournamentId, knockoutRound, bracketPosition, homeGroupId: homeGroupId ?? null, homePosition: homePosition ?? null, awayGroupId: awayGroupId ?? null, awayPosition: awayPosition ?? null, homeWinnerOf: homeWinnerOf ?? null, awayWinnerOf: awayWinnerOf ?? null }).returning()
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
      const { name, shortName, country, season, hasGroups, qualifiersPerGroup, allowCrossGroup } = req.body
      if (!name || !season) return err(res, 'name and season required', 400)
      const [tournament] = await db.insert(tournaments).values({ name, shortName: shortName ?? null, country: country ?? null, season: Number(season), hasGroups: hasGroups ?? true, qualifiersPerGroup: Number(qualifiersPerGroup) || 8, allowCrossGroup: allowCrossGroup ?? false, active: true }).returning()
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

    // teams list
    if (action === 'teams' && req.method === 'GET') {
      const allTeams = await db.select().from(teams).orderBy(teams.name)
      return ok(res, allTeams)
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

    return err(res, 'Unknown action', 400)
  } catch (error) {
    console.error(error)
    return err(res, 'Server error')
  }
}
