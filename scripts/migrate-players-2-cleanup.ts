// Migracion de identidad de jugadores — PASO 2 de 2 (DESTRUCTIVO)
// Correr con: npx tsx scripts/migrate-players-2-cleanup.ts
//
// SOLO correr esto despues de:
//   1. Haber corrido scripts/migrate-players-1-backfill.ts
//   2. Haber confirmado en la app que los jugadores existentes se siguen viendo bien
//      (nombre, equipo, stats) — porque este paso borra las columnas viejas.
//
// Que hace:
//   - Pone local_players.person_id como NOT NULL (falla si quedo algun NULL —
//     señal de que el paso 1 no termino bien, no correr este script en ese caso)
//   - Elimina local_players.first_name, last_name, external_id (esos datos
//     ahora viven en la tabla players)

import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'

const db = drizzle(neon(process.env.DATABASE_URL!))

async function cleanup() {
  const pending = await db.execute(sql`SELECT count(*) as count FROM local_players WHERE person_id IS NULL`)
  const remaining = Number((pending as any).rows?.[0]?.count ?? 0)
  if (remaining > 0) {
    console.error(`❌ Todavia hay ${remaining} filas de local_players sin person_id. Corre migrate-players-1-backfill.ts primero.`)
    process.exit(1)
  }

  console.log('Poniendo local_players.person_id como NOT NULL...')
  await db.execute(sql`ALTER TABLE local_players ALTER COLUMN person_id SET NOT NULL`)

  console.log('Eliminando columnas viejas (first_name, last_name, external_id)...')
  await db.execute(sql`ALTER TABLE local_players DROP COLUMN IF EXISTS first_name`)
  await db.execute(sql`ALTER TABLE local_players DROP COLUMN IF EXISTS last_name`)
  await db.execute(sql`ALTER TABLE local_players DROP COLUMN IF EXISTS external_id`)

  console.log('\n✅ Listo. local_players ahora es puramente la tabla de vinculo (person_id + team_id/national_team_id + tournament_id + position).')
}

cleanup().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
