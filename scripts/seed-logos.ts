import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import axios from 'axios'
import { teams } from '../api/_lib/tournament-schema.js'

const db = drizzle(neon(process.env.DATABASE_URL!))
const api = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: { 'x-apisports-key': process.env.FOOTBALL_API_KEY! },
})

async function searchTeam(name: string) {
  const res = await api.get('/teams', { params: { search: name } })
  const results = res.data.response ?? []
  return results[0]?.team ?? null
}

async function downloadAndUpload(url: string, teamName: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(res.data)
    const filename = `logos/${teamName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    })
    return blob.url
  } catch (e) {
    console.error(`  Error uploading ${teamName}:`, e)
    return null
  }
}

async function run() {
  // Get all teams without logos
  const allTeams = await db.select().from(teams)
  const withoutLogo = allTeams.filter(t => !t.logoUrl)

  console.log(`Found ${withoutLogo.length} teams without logo`)

  for (const team of withoutLogo) {
    console.log(`\nProcessing: ${team.name}`)

    // Search in API-Football
    const apiTeam = await searchTeam(team.name)
    if (!apiTeam?.logo) {
      console.log(`  Not found in API-Football`)
      continue
    }

    console.log(`  Found: ${apiTeam.name} - ${apiTeam.logo}`)

    // Upload to Vercel Blob
    const blobUrl = await downloadAndUpload(apiTeam.logo, team.name)
    if (!blobUrl) continue

    // Save URL to Neon
    await db.update(teams).set({ logoUrl: blobUrl }).where(eq(teams.id, team.id))
    console.log(`  ✓ Saved: ${blobUrl}`)

    // Rate limit - API-Football free plan allows 10 req/min
    await new Promise(r => setTimeout(r, 6500))
  }

  console.log('\nDone!')
}

run().catch(console.error)
