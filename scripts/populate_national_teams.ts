import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'

// ESPN IDs from fifa.world teams API
const ESPN_NATIONAL_IDS: Record<string, number> = {
  ALG: 624, ARG: 202, AUS: 628, AUT: 474, BEL: 459,
  BIH: 452, BRA: 205, CAN: 206, CPV: 2597, COL: 208,
  CON: 2850, CRO: 477, CUW: 11678, CZE: 450, ECU: 209,
  EGY: 2620, ENG: 448, FRA: 478, GER: 481, GHA: 4469,
  HAI: 2654, IRN: 469, IRQ: 4375, CIV: 4789, JPN: 627,
  JOR: 2917, MEX: 203, MAR: 2869, NED: 449, NZL: 2666,
  NOR: 464, PAN: 2659, PAR: 210, POR: 482, QAT: 4398,
  KSA: 655, SCO: 580, SEN: 654, RSA: 467, KOR: 451,
  ESP: 164, SWE: 466, SUI: 475, TUN: 659, TUR: 465,
  USA: 660, URU: 212, UZB: 2570,
}

async function fetchESPN(espnId: number) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/teams/${espnId}`)
    if (!res.ok) return null
    const json = await res.json() as any
    const t = json.team
    return {
      externalId: espnId,
      color: t.color ?? null,
      alternateColor: t.alternateColor ?? null,
      flagUrl: t.logos?.[0]?.href ?? null,
    }
  } catch (e: any) {
    console.error(`ESPN fetch failed for id ${espnId}:`, e.message)
    return null
  }
}

async function main() {
  const db = neon(process.env.DATABASE_URL!)
  const teams = await db`SELECT id, name, fifa_code, flag_url, external_id FROM national_teams` as any[]
  console.log(`Found ${teams.length} national teams`)

  let updated = 0, skipped = 0, notFound = 0

  for (const team of teams) {
    const code = team.fifa_code
    const espnId = ESPN_NATIONAL_IDS[code]

    if (!espnId) {
      console.log(`⚠️  No ESPN ID for ${code} (${team.name})`)
      notFound++
      continue
    }

    if (team.flag_url && team.external_id) {
      console.log(`✓  ${code} already populated`)
      skipped++
      continue
    }

    console.log(`Fetching ${code} (ESPN id: ${espnId})...`)
    const data = await fetchESPN(espnId)

    if (!data) {
      console.log(`✗  Failed to fetch ${code}`)
      notFound++
      continue
    }

    await db`
      UPDATE national_teams SET
        external_id = ${data.externalId},
        flag_url = COALESCE(NULLIF(flag_url, ''), ${data.flagUrl}),
        color = COALESCE(NULLIF(color, '000000'), ${data.color}),
        alternate_color = COALESCE(NULLIF(alternate_color, ''), ${data.alternateColor})
      WHERE id = ${team.id}
    `
    console.log(`✓  Updated ${code} → color: ${data.color}, flag: ${data.flagUrl?.slice(0, 50)}`)
    updated++

    await new Promise(r => setTimeout(r, 80))
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`)
}

main().catch(console.error)