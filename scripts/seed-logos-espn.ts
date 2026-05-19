import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, isNotNull } from 'drizzle-orm'
import axios from 'axios'
import { teams } from '../api/_lib/tournament-schema.js'

const db = drizzle(neon(process.env.DATABASE_URL!))

const LEAGUES = ['arg.1', 'conmebol.libertadores', 'conmebol.sudamericana', 'uefa.champions']

async function fetchLogo(espnId: string, league: string): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${espnId}`,
      { headers: { 'User-Agent': 'FutbolAR/1.0' }, timeout: 8000 }
    )
    const logos: any[] = res.data?.team?.logos ?? []
    const defaultLogo = logos.find(l => l.rel?.includes('default'))
    return defaultLogo?.href ?? logos[0]?.href ?? null
  } catch {
    return null
  }
}

async function run() {
  // Get all teams with externalId but no logoUrl (or --all flag to update all)
  const allTeams = await db.select().from(teams).where(isNotNull(teams.externalId))
  const updateAll = process.argv.includes('--all')
  const toProcess = updateAll ? allTeams : allTeams.filter(t => !t.logoUrl)

  console.log(`Found ${toProcess.length} teams to process (${allTeams.length} total with externalId)\n`)

  let updated = 0
  let skipped = 0

  for (const team of toProcess) {
    process.stdout.write(`${team.name} (ESPN ID: ${team.externalId})... `)

    let logoUrl: string | null = null
    for (const league of LEAGUES) {
      logoUrl = await fetchLogo(String(team.externalId), league)
      if (logoUrl) break
      await new Promise(r => setTimeout(r, 300))
    }

    if (!logoUrl) {
      console.log('❌ not found')
      skipped++
      continue
    }

    await db.update(teams).set({ logoUrl }).where(eq(teams.id, team.id))
    console.log(`✓ ${logoUrl}`)
    updated++

    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`)
}

run().catch(console.error)
