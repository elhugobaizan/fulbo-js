import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import axios from 'axios'
import { teams } from '../api/_lib/tournament-schema.js'

const db = drizzle(neon(process.env.DATABASE_URL!))

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

const HEADERS = {
  'User-Agent': 'FutbolAR/1.0 (https://futbol-ar.vercel.app)',
}

const FORCED_IDS: Record<string, string> = {
  'Universidad Central de Venezuela Fútbol Club': 'Q3076549',
  'Coquimbo Unido': 'Q2407595',
  'Cusco FC': 'Q602397',
  'La Guaira': 'Q628860',        // Deportivo La Guaira F.C.
  'Flamengo': 'Q17479',          // Clube de Regatas do Flamengo
}

async function searchWikidata(teamName: string): Promise<string | null> {
  // Try exact name first, then with Argentina
  for (const query of [teamName, teamName + ' Argentina', teamName + ' fútbol']) {
    const res = await axios.get('https://www.wikidata.org/w/api.php', {
      params: {
        action: 'wbsearchentities',
        search: query,
        language: 'es',
        type: 'item',
        format: 'json',
        limit: 8,
      },
      headers: HEADERS,
    })
    const results = res.data.search ?? []
    const best = results.find((r: any) =>
      r.description?.toLowerCase().includes('fútbol') ||
      r.description?.toLowerCase().includes('football') ||
      r.description?.toLowerCase().includes('club') ||
      r.description?.toLowerCase().includes('argentina')
    )
    if (best) return best.id
  }
  return null
}

async function getLogoUrl(entityId: string): Promise<string | null> {
  const res = await axios.get('https://www.wikidata.org/w/api.php', {
    params: {
      action: 'wbgetentities',
      ids: entityId,
      format: 'json',
      props: 'claims',
    },
    headers: HEADERS,
  })
  const claims = res.data.entities?.[entityId]?.claims ?? {}
  const logoFile = claims.P154?.[0]?.mainsnak?.datavalue?.value
    ?? claims.P18?.[0]?.mainsnak?.datavalue?.value
  if (!logoFile) return null
  if (!logoFile) return null

  // Get direct URL from Wikimedia API
  const apiRes = await axios.get('https://commons.wikimedia.org/w/api.php', {
    params: {
      action: 'query',
      titles: `File:${logoFile}`,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: 200,
      format: 'json',
    },
    headers: HEADERS,
  })
  const pages = apiRes.data.query?.pages ?? {}
  const page = Object.values(pages)[0] as any
  return page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url ?? null
}

async function uploadToR2(imageUrl: string, teamName: string): Promise<string | null> {
  try {
    // Try with various headers to avoid 403
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        ...HEADERS,
        'Accept': 'image/*',
      },
    })

    const contentType = String(res.headers['content-type'] ?? 'image/png')
    const ext = contentType.includes('svg') ? 'svg' : contentType.includes('png') ? 'png' : 'jpg'
    const key = `logos/${teamName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${ext}`

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(res.data),
      ContentType: contentType,
    }))

    return `${PUBLIC_URL}/${key}`
  } catch (e: any) {
    console.error(`  Upload error: ${e.message}`)
    return null
  }
}

async function run() {
  const allTeams = await db.select().from(teams)
  const withoutLogo = allTeams.filter(t => !t.logoUrl)
  console.log(`Found ${withoutLogo.length} teams without logo\n`)

  for (const team of withoutLogo) {
    console.log(`Processing: ${team.name}`)
    try {
      const entityId = FORCED_IDS[team.name] ?? await searchWikidata(team.name)
      if (!entityId) { console.log(`  Not found in Wikidata`); continue }
      console.log(`  Wikidata: ${entityId}`)

      const logoUrl = await getLogoUrl(entityId)
      if (!logoUrl) { console.log(`  No logo found`); continue }
      console.log(`  Logo: ${logoUrl}`)

      const r2Url = await uploadToR2(logoUrl, team.name)
      if (!r2Url) continue

      await db.update(teams).set({ logoUrl: r2Url }).where(eq(teams.id, team.id))
      console.log(`  ✓ Saved: ${r2Url}\n`)
    } catch (e: any) {
      console.error(`  Error: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  console.log('Done!')
}

run().catch(console.error)