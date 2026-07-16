import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, sql } from 'drizzle-orm'
import { matches, teams, groups, groupTeams, bracketRules, nationalTeams, tournaments } from '../_lib/tournament-schema'
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

    // Traer todas las reglas del bracket (raw SQL to include wildcard_group_ids added via ALTER TABLE)
    const rulesRaw = await db.execute(sql`SELECT * FROM bracket_rules WHERE tournament_id = ${tournamentId}`)
    const rules = ((rulesRaw as any).rows ?? []).map((r: any) => ({
      ...r,
      tournamentId: r.tournament_id,
      knockoutRound: r.knockout_round,
      bracketPosition: r.bracket_position,
      homeGroupId: r.home_group_id,
      homePosition: r.home_position,
      awayGroupId: r.away_group_id,
      awayPosition: r.away_position,
      homeWinnerOf: r.home_winner_of,
      awayWinnerOf: r.away_winner_of,
      wildcardGroupIds: r.wildcard_group_ids,
    }))

    // Traer todos los grupos con sus equipos
    const groupsData = await db.select().from(groups)
      .where(eq(groups.tournamentId, tournamentId))

    // Check tournament settings
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    const isNational = (tournament as any)?.teamType === 'national' || (tournament as any)?.team_type === 'national'
    const knockoutStarted = !!(tournament as any)?.knockoutStarted

    const groupsWithTeams = await Promise.all(groupsData.map(async (group) => {
      let members: any[]
      if (isNational) {
        const rows = await db.select({ teamId: (groupTeams as any).nationalTeamId, team: nationalTeams })
          .from(groupTeams)
          .innerJoin(nationalTeams, eq((groupTeams as any).nationalTeamId, nationalTeams.id))
          .where(eq(groupTeams.groupId, group.id))
        members = rows.map((r: any) => ({ ...r, team: { ...r.team, logoUrl: r.team.flagUrl, shortName: r.team.name } }))
      } else {
        members = await db.select({ teamId: groupTeams.teamId, team: teams })
          .from(groupTeams)
          .innerJoin(teams, eq(groupTeams.teamId, teams.id))
          .where(eq(groupTeams.groupId, group.id))
      }
      return { ...group, members }
    }))

    // Traer todos los partidos del torneo
    const allMatches = await db.select().from(matches)
      .where(eq(matches.tournamentId, tournamentId))

    // Enriquecer partidos con equipos
    const enrichedMatches = await Promise.all(allMatches.map(async (match) => {
      const teamTable = isNational ? nationalTeams : teams
      const homeTeam = match.homeTeamId
        ? await db.select().from(teamTable).where(eq(teamTable.id, match.homeTeamId)).then(r => {
          const t = r[0] as any
          return t ? { ...t, shortName: t.shortName ?? t.name, logoUrl: t.logoUrl ?? t.flagUrl } : null
        })
        : null
      const awayTeam = match.awayTeamId
        ? await db.select().from(teamTable).where(eq(teamTable.id, match.awayTeamId)).then(r => {
          const t = r[0] as any
          return t ? { ...t, shortName: t.shortName ?? t.name, logoUrl: t.logoUrl ?? t.flagUrl } : null
        })
        : null
      return { ...match, homeTeam, awayTeam }
    }))

    // Calcular standings por grupo
    const standingsByGroup: Record<number, any[]> = {}
    for (const group of groupsWithTeams) {
      const groupTeamIds = new Set(group.members.map((m: any) => m.teamId).filter(Boolean))
      const relevantMatches = enrichedMatches.filter(m =>
        m.phase === 'group' && (groupTeamIds.has(m.homeTeamId) || groupTeamIds.has(m.awayTeamId))
      )
      standingsByGroup[group.id] = calculateStandings(relevantMatches, group.members)
    }

    // Mapear partidos knockout por bracketPosition + knockoutRound
    const knockoutMatches = enrichedMatches.filter(m => m.phase === 'knockout')

    // Mapas para resolución
    const ruleById: Record<number, any> = Object.fromEntries(rules.map((r: any) => [r.id, r]))

    // Para cada regla, buscar el match knockout correspondiente
    // Los matches knockout se linkean por bracketPosition + knockoutRound
    const matchByRulePosition: Record<string, any> = {}
    for (const match of knockoutMatches) {
      const key = `${match.knockoutRound}:${match.bracketPosition}`
      matchByRulePosition[key] = match
    }

    // Helper: rank wildcards from a set of group ids at a given position
    function buildWildcardPool(wcGroupIds: number[], position: number): any[] {
      const candidates = wcGroupIds.flatMap((gid: number) => {
        const standing = standingsByGroup[gid]
        return standing && standing[position - 1] ? [standing[position - 1]] : []
      })
      return candidates.sort((a: any, b: any) => {
        if (b.points !== a.points) return b.points - a.points
        const da = a.goalsFor - a.goalsAgainst, db2 = b.goalsFor - b.goalsAgainst
        if (db2 !== da) return db2 - da
        return b.goalsFor - a.goalsFor
      })
    }

    // Pre-calculate wildcard pools per round (shared pool keyed by wildcardGroupIds string)
    // Each pool is consumed in order of bracketPosition so no team appears twice
    const wildcardPoolByKey: Record<string, any[]> = {}
    const wildcardIndexByKey: Record<string, number> = {}

    // Construir bracket por ronda
    const rounds = KNOCKOUT_ROUNDS.filter((r: string) => rules.some((rule: any) => rule.knockoutRound === r))
    const bracket: Record<string, any[]> = {}

    for (const round of rounds) {
      const roundRules = rules
        .filter((r: any) => r.knockoutRound === round)
        .sort((a: any, b: any) => a.bracketPosition - b.bracketPosition)

      // Build ONE global wildcard pool for this round
      // Collect all unique group ids across all wildcard rules in this round
      const allWcGroupIds = new Set<number>()
      let wcPosition = 3
      for (const rule of roundRules as any[]) {
        const ruleAny = rule as any
        if (ruleAny.wildcardGroupIds) {
          ruleAny.wildcardGroupIds.split(',').map(Number).forEach((id: number) => allWcGroupIds.add(id))
          wcPosition = rule.awayPosition ?? rule.homePosition ?? 3
        }
      }
      const globalWildcardPool = allWcGroupIds.size > 0
        ? buildWildcardPool([...allWcGroupIds], wcPosition)
        : []
      let globalWildcardIndex = 0

      bracket[round] = roundRules.map((rule: any) => {
        const existingMatch = matchByRulePosition[`${round}:${rule.bracketPosition}`]
        const ruleAny = rule as any

        let homeTeam = null
        let awayTeam = null
        let homeLabel = '?'
        let awayLabel = '?'

        if (existingMatch && knockoutStarted) {
          homeTeam = existingMatch.homeTeam
          awayTeam = existingMatch.awayTeam
          homeLabel = homeTeam?.shortName ?? homeTeam?.name ?? '?'
          awayLabel = awayTeam?.shortName ?? awayTeam?.name ?? '?'
        } else if (!knockoutStarted) {
          // Knockout not started: show only position/group labels, no team data
          if (ruleAny.wildcardGroupIds && rule.awayGroupId === null && rule.awayPosition !== null) {
            const wcIds = ruleAny.wildcardGroupIds.split(',').map(Number)
            const wcNames = wcIds.map((id: number) => groupsWithTeams.find((g: any) => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')
            awayLabel = `${rule.awayPosition}° ${wcNames}`
          } else if (rule.awayGroupId !== null && rule.awayPosition !== null) {
            const groupName = groupsWithTeams.find((g: any) => g.id === rule.awayGroupId)?.name ?? '?'
            awayLabel = `${rule.awayPosition}° ${groupName}`
          } else if (rule.awayWinnerOf !== null) {
            const prevRule = ruleById[rule.awayWinnerOf]
            awayLabel = prevRule ? `Ganador cruce ${prevRule.bracketPosition}` : '?'
          }
          if (ruleAny.wildcardGroupIds && rule.homeGroupId === null && rule.homePosition !== null) {
            const wcIds = ruleAny.wildcardGroupIds.split(',').map(Number)
            const wcNames = wcIds.map((id: number) => groupsWithTeams.find((g: any) => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')
            homeLabel = `${rule.homePosition}° ${wcNames}`
          } else if (rule.homeGroupId !== null && rule.homePosition !== null) {
            const groupName = groupsWithTeams.find((g: any) => g.id === rule.homeGroupId)?.name ?? '?'
            homeLabel = `${rule.homePosition}° ${groupName}`
          } else if (rule.homeWinnerOf !== null) {
            const prevRule = ruleById[rule.homeWinnerOf]
            homeLabel = prevRule ? `Ganador cruce ${prevRule.bracketPosition}` : '?'
          }
        } else {
          // Resolver home
          if (ruleAny.wildcardGroupIds && rule.homeGroupId === null && rule.homePosition !== null) {
            const wcIds = ruleAny.wildcardGroupIds.split(',').map(Number)
            const wcNames = wcIds.map((id: number) => groupsWithTeams.find(g => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')
            if (globalWildcardPool[globalWildcardIndex]) {
              homeTeam = globalWildcardPool[globalWildcardIndex].team
              homeLabel = homeTeam?.shortName ?? homeTeam?.name ?? '?'
              globalWildcardIndex++
            } else {
              homeLabel = `${rule.homePosition}° ${wcNames}`
            }
          } else if (rule.homeGroupId !== null && rule.homePosition !== null) {
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

          // Resolver away
          if (ruleAny.wildcardGroupIds && rule.awayGroupId === null && rule.awayPosition !== null) {
            const wcIds = ruleAny.wildcardGroupIds.split(',').map(Number)
            const wcNames = wcIds.map((id: number) => groupsWithTeams.find(g => g.id === id)?.name?.replace('Grupo ', '') ?? '?').join('/')
            if (globalWildcardPool[globalWildcardIndex]) {
              awayTeam = globalWildcardPool[globalWildcardIndex].team
              awayLabel = awayTeam?.shortName ?? awayTeam?.name ?? '?'
              globalWildcardIndex++
            } else {
              awayLabel = `${rule.awayPosition}° ${wcNames}`
            }
          } else if (rule.awayGroupId !== null && rule.awayPosition !== null) {
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
        } // end knockoutStarted else

        return {
          ruleId: rule.id,
          bracketPosition: rule.bracketPosition,
          knockoutRound: round,
          homeTeam,
          awayTeam,
          homeLabel,
          awayLabel,
          match: existingMatch ?? null,
          homeWinnerOf: rule.homeWinnerOf,
          awayWinnerOf: rule.awayWinnerOf,
          homeWinnerOfPosition: rule.homeWinnerOf ? ruleById[rule.homeWinnerOf]?.bracketPosition ?? null : null,
          homeWinnerOfRound: rule.homeWinnerOf ? ruleById[rule.homeWinnerOf]?.knockoutRound ?? null : null,
          awayWinnerOfPosition: rule.awayWinnerOf ? ruleById[rule.awayWinnerOf]?.bracketPosition ?? null : null,
          awayWinnerOfRound: rule.awayWinnerOf ? ruleById[rule.awayWinnerOf]?.knockoutRound ?? null : null,
        }
      })
    }

    // Tercer puesto: no tiene bracket rule (se genera junto con la final, con los
    // perdedores de las semis), asi que el slot se arma directo desde el match.
    const thirdPlaceMatch = enrichedMatches.find((m: any) => m.phase === 'knockout' && m.knockoutRound === 'third_place')
    if (thirdPlaceMatch) {
      bracket['third_place'] = [{
        ruleId: -1,
        bracketPosition: 1,
        knockoutRound: 'third_place',
        homeTeam: thirdPlaceMatch.homeTeam,
        awayTeam: thirdPlaceMatch.awayTeam,
        homeLabel: thirdPlaceMatch.homeTeam?.shortName ?? thirdPlaceMatch.homeTeam?.name ?? '?',
        awayLabel: thirdPlaceMatch.awayTeam?.shortName ?? thirdPlaceMatch.awayTeam?.name ?? '?',
        match: thirdPlaceMatch,
        homeWinnerOf: null,
        awayWinnerOf: null,
        homeWinnerOfPosition: null,
        homeWinnerOfRound: null,
        awayWinnerOfPosition: null,
        awayWinnerOfRound: null,
      }]
    }

    return ok(res, bracket)
  } catch (error) {
    console.error(error)
    return err(res, 'Error fetching bracket')
  }
}