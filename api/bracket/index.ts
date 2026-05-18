import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, bracketRules } from '../_lib/tournament-schema'
import { ok, err } from '../_lib/helpers'
import { KNOCKOUT_ROUNDS } from '../_lib/tournament-schema'

function getDb() {
  return drizzle(neon(process.env.DATABASE_URL!))
}

// ─── Calcular standings de un grupo ──────────────────────────────────────────

function calculateStandings(allGroupMatches: any[], groupTeamsList: any[]) {
  const stats: Record<number, {
    teamId: number; team: any
    played: number; won: number; drawn: number; lost: number
    goalsFor: number; goalsAgainst: number; points: number
  }> = {}

  for (const gt of groupTeamsList) {
    stats[gt.teamId] = {
      teamId: gt.teamId, team: gt.team,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    }
  }

  const groupTeamIds = new Set(groupTeamsList.map((gt: any) => gt.teamId))

  for (const match of allGroupMatches) {
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

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const diffA = a.goalsFor - a.goalsAgainst
    const diffB = b.goalsFor - b.goalsAgainst
    if (diffB !== diffA) return diffB - diffA
    return b.goalsFor - a.goalsFor
  })
}

// ─── Resolver qué equipo va en cada slot del bracket ─────────────────────────

function resolveTeam(
  rule: any,
  standingsByGroup: Record<number, any[]>,
  matchByRuleId: Record<number, any>,
  ruleById: Record<number, any>,
  depth = 0
): { team: any; label: string } | null {
  if (depth > 10) return null // evitar loops infinitos

  // Viene de fase de grupos
  if (rule.homeGroupId !== null) return null // se resuelve por separado

  // Viene de ronda anterior
  if (rule.homeWinnerOf !== null) {
    const prevRule = ruleById[rule.homeWinnerOf]
    if (!prevRule) return null
    const prevMatch = matchByRuleId[prevRule.id]
    if (!prevMatch || prevMatch.status !== 'finished') return null
    return getWinner(prevMatch)
  }

  return null
}

function getWinner(match: any): { team: any; label: string } | null {
  if (!match || match.status !== 'finished') return null
  const homeWon = match.homePenalties !== null
    ? match.homePenalties > (match.awayPenalties ?? 0)
    : (match.homeScore ?? 0) > (match.awayScore ?? 0)
  return homeWon
    ? { team: match.homeTeam, label: match.homeTeam?.shortName ?? match.homeTeam?.name ?? '?' }
    : { team: match.awayTeam, label: match.awayTeam?.shortName ?? match.awayTeam?.name ?? '?' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)

  const tournamentId = Number(req.query.tournamentId)
  if (!tournamentId) return err(res, 'tournamentId required', 400)

  try {
    const db = getDb()

    // Traer todas las reglas del bracket
    const rules = await db.select().from(bracketRules)
      .where(eq(bracketRules.tournamentId, tournamentId))

    // Traer todos los grupos con sus equipos
    const groupsData = await db.select().from(groups)
      .where(eq(groups.tournamentId, tournamentId))

    const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
      const members = await db
        .select({ teamId: groupTeams.teamId, team: teams })
        .from(groupTeams)
        .innerJoin(teams, eq(groupTeams.teamId, teams.id))
        .where(eq(groupTeams.groupId, group.id))
      return { ...group, members }
    }))

    // Traer todos los partidos del torneo
    const allMatches = await db.select().from(matches)
      .where(eq(matches.tournamentId, tournamentId))

    // Enriquecer partidos con equipos
    const enrichedMatches = await Promise.all(allMatches.map(async (match) => {
      const homeTeam = match.homeTeamId
        ? await db.select().from(teams).where(eq(teams.id, match.homeTeamId)).then(r => r[0])
        : null
      const awayTeam = match.awayTeamId
        ? await db.select().from(teams).where(eq(teams.id, match.awayTeamId)).then(r => r[0])
        : null
      return { ...match, homeTeam, awayTeam }
    }))

    // Calcular standings por grupo
    const standingsByGroup: Record<number, any[]> = {}
    for (const group of groupsWithTeams) {
      const groupTeamIds = new Set(group.members.map((m: any) => m.teamId))
      const relevantMatches = enrichedMatches.filter(m =>
        m.phase === 'group' && (groupTeamIds.has(m.homeTeamId) || groupTeamIds.has(m.awayTeamId))
      )
      standingsByGroup[group.id] = calculateStandings(relevantMatches, group.members)
    }

    for (const [groupId, standings] of Object.entries(standingsByGroup)) {
      console.log(`Group ${groupId}:`, (standings as any[]).slice(0, 3).map((s: any) => `${s.team.name}: ${s.points}pts`))
    }

    // Mapear partidos knockout por bracketPosition + knockoutRound
    const knockoutMatches = enrichedMatches.filter(m => m.phase === 'knockout')

    // Mapas para resolución
    const ruleById: Record<number, any> = Object.fromEntries(rules.map(r => [r.id, r]))

    // Para cada regla, buscar el match knockout correspondiente
    // Los matches knockout se linkean por bracketPosition + knockoutRound
    const matchByRulePosition: Record<string, any> = {}
    for (const match of knockoutMatches) {
      const key = `${match.knockoutRound}:${match.bracketPosition}`
      matchByRulePosition[key] = match
    }

    // Construir bracket por ronda
    const rounds = KNOCKOUT_ROUNDS.filter(r => rules.some(rule => rule.knockoutRound === r))
    const bracket: Record<string, any[]> = {}

    for (const round of rounds) {
      const roundRules = rules
        .filter(r => r.knockoutRound === round)
        .sort((a, b) => a.bracketPosition - b.bracketPosition)

      bracket[round] = roundRules.map(rule => {
        const existingMatch = matchByRulePosition[`${round}:${rule.bracketPosition}`]

        // Resolver equipos
        let homeTeam = null
        let awayTeam = null
        let homeLabel = '?'
        let awayLabel = '?'

        if (existingMatch) {
          // Ya hay partido jugado o programado
          homeTeam = existingMatch.homeTeam
          awayTeam = existingMatch.awayTeam
          homeLabel = homeTeam?.shortName ?? homeTeam?.name ?? '?'
          awayLabel = awayTeam?.shortName ?? awayTeam?.name ?? '?'
        } else {
          // Resolver desde reglas
          if (rule.homeGroupId !== null && rule.homePosition !== null) {
            const standing = standingsByGroup[rule.homeGroupId]?.[rule.homePosition - 1]
            if (standing) {
              homeTeam = standing.team
              homeLabel = standing.team?.shortName ?? standing.team?.name ?? '?'
            } else {
              const groupName = groupsWithTeams.find(g => g.id === rule.homeGroupId)?.name ?? '?'
              homeLabel = `${rule.homePosition}° ${groupName}`
            }
          } else if (rule.homeWinnerOf !== null) {
            const prevRule = ruleById[rule.homeWinnerOf]
            if (prevRule) {
              const prevMatch = matchByRulePosition[`${prevRule.knockoutRound}:${prevRule.bracketPosition}`]
              if (prevMatch && prevMatch.status === 'finished') {
                const winner = getWinner(prevMatch)
                homeTeam = winner?.team
                homeLabel = winner?.label ?? '?'
              } else {
                homeLabel = `Ganador cruce ${prevRule.bracketPosition}`
              }
            }
          }

          if (rule.awayGroupId !== null && rule.awayPosition !== null) {
            const standing = standingsByGroup[rule.awayGroupId]?.[rule.awayPosition - 1]
            if (standing) {
              awayTeam = standing.team
              awayLabel = standing.team?.shortName ?? standing.team?.name ?? '?'
            } else {
              const groupName = groupsWithTeams.find(g => g.id === rule.awayGroupId)?.name ?? '?'
              awayLabel = `${rule.awayPosition}° ${groupName}`
            }
          } else if (rule.awayWinnerOf !== null) {
            const prevRule = ruleById[rule.awayWinnerOf]
            if (prevRule) {
              const prevMatch = matchByRulePosition[`${prevRule.knockoutRound}:${prevRule.bracketPosition}`]
              if (prevMatch && prevMatch.status === 'finished') {
                const winner = getWinner(prevMatch)
                awayTeam = winner?.team
                awayLabel = winner?.label ?? '?'
              } else {
                awayLabel = `Ganador cruce ${prevRule.bracketPosition}`
              }
            }
          }
        }

        return {
          ruleId: rule.id,
          bracketPosition: rule.bracketPosition,
          knockoutRound: round,
          homeTeam,
          awayTeam,
          homeLabel,
          awayLabel,
          match: existingMatch ?? null,
        }
      })
    }

    return ok(res, bracket)
  } catch (error) {
    console.error(error)
    return err(res, 'Error fetching bracket')
  }
}