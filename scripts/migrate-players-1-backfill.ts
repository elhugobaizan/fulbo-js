// Migracion de identidad de jugadores — PASO 1 de 2 (seguro, no destructivo)
// Correr con: npx tsx scripts/migrate-players-1-backfill.ts
//
// Que hace:
//   1. Crea la tabla `players` (la persona real, independiente de club/seleccion/torneo)
//   2. Agrega columnas nuevas a `local_players`: person_id, national_team_id
//   3. Afloja team_id a nullable (ahora puede ser team_id O national_team_id)
//   4. Por cada fila existente de local_players, crea su `players` correspondiente
//      y completa local_players.person_id
//
// Es idempotente: se puede correr mas de una vez sin duplicar nada (solo
// migra las filas que todavia no tienen person_id).
//
// Despues de correr esto y confirmar que el panel admin sigue mostrando bien
// los jugadores existentes, correr scripts/migrate-players-2-cleanup.ts para
// sacar las columnas viejas (first_name/last_name/external_id de local_players)
// y dejar person_id como NOT NULL.

import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import { players } from '../api/_lib/tournament-schema.js'

const db = drizzle(neon(process.env.DATABASE_URL!))

async function migrate() {
  console.log('1/3 — creando tabla players (si no existe)...')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS players (
      id serial PRIMARY KEY,
      first_name varchar(100) NOT NULL,
      last_name varchar(100) NOT NULL,
      external_id integer,
      created_at timestamp DEFAULT now()
    )
  `)

  console.log('2/3 — agregando columnas nuevas a local_players (si no existen)...')
  await db.execute(sql`ALTER TABLE local_players ADD COLUMN IF NOT EXISTS person_id integer REFERENCES players(id)`)
  await db.execute(sql`ALTER TABLE local_players ADD COLUMN IF NOT EXISTS national_team_id integer REFERENCES national_teams(id)`)
  await db.execute(sql`ALTER TABLE local_players ALTER COLUMN team_id DROP NOT NULL`)

  console.log('3/3 — migrando jugadores existentes a la tabla players...')
  const pending = await db.execute(sql`
    SELECT id, first_name, last_name, external_id FROM local_players WHERE person_id IS NULL
  `)
  const rows = (pending as any).rows ?? []
  console.log(`   Encontrados ${rows.length} jugadores sin migrar`)

  let migrated = 0
  for (const r of rows) {
    const [p] = await db.insert(players).values({
      firstName: r.first_name,
      lastName: r.last_name,
      externalId: r.external_id,
    }).returning()
    await db.execute(sql`UPDATE local_players SET person_id = ${p.id} WHERE id = ${r.id}`)
    migrated++
  }

  console.log(`\n✅ Listo. ${migrated} jugadores migrados a la tabla players.`)
  console.log('   Confirma que el panel admin y las paginas de jugadores siguen mostrando todo bien.')
  console.log('   Cuando estes conforme, corre: npx tsx scripts/migrate-players-2-cleanup.ts')
}

migrate().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
