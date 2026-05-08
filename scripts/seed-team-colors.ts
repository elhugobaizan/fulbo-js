import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, isNotNull } from 'drizzle-orm'
import axios from 'axios'
import { teams } from '../api/_lib/tournament-schema.js'

const db = drizzle(neon(process.env.DATABASE_URL!))

const LEAGUES = ['arg.1', 'conmebol.libertadores']

async function fetchTeamColors(espnId: string, league: string): Promise<{ color: string; alternateColor: string } | null> {
  try {
    const res = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${espnId}`,
      { headers: { 'User-Agent': 'FutbolAR/1.0' } }
    )
    const team = res.data.team
    if (!team?.color) return null
    return {
      color: team.color,
      alternateColor: team.alternateColor ?? team.color,
    }
  } catch {
    return null
  }
}

async function run() {
  // Get all teams with externalId
  const allTeams = await db.select().from(teams).where(isNotNull(teams.externalId))
  console.log(`Found ${allTeams.length} teams with externalId\n`)

  for (const team of allTeams) {
    console.log(`Processing: ${team.name} (ESPN ID: ${team.externalId})`)

    let colors = null
    for (const league of LEAGUES) {
      colors = await fetchTeamColors(String(team.externalId), league)
      if (colors) break
      await new Promise(r => setTimeout(r, 300))
    }

    if (!colors) {
      console.log(`  No colors found`)
      continue
    }

    console.log(`  Colors: #${colors.color} / #${colors.alternateColor}`)
    await db.update(teams).set({
      color: colors.color,
      alternateColor: colors.alternateColor,
    } as any).where(eq(teams.id, team.id))
    console.log(`  ✓ Saved`)

    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\nDone!')
}

run().catch(console.error)
