// Seed: Liga Profesional de Fútbol 2026
// Correr con: npx tsx scripts/seed-lpf2026.ts

import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { tournaments, teams, groups, groupTeams } from '../api/_lib/tournament-schema.js'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

const GROUP_A_TEAMS = [
  'Estudiantes de La Plata',
  'Boca Juniors',
  'Vélez Sarsfield',
  'Talleres',
  'Lanús',
  'San Lorenzo',
  'Independiente',
  'Unión',
  'Defensa y Justicia',
  'Instituto',
  'Platense',
  'Gimnasia y Esgrima de Mendoza',
  'Central Córdoba',
  "Newell's Old Boys",
  'Deportivo Riestra',
]

const GROUP_B_TEAMS = [
  'Independiente Rivadavia',
  'River Plate',
  'Argentinos Juniors',
  'Rosario Central',
  'Belgrano',
  'Gimnasia y Esgrima de La Plata',
  'Huracán',
  'Barracas Central',
  'Racing',
  'Tigre',
  'Sarmiento',
  'Banfield',
  'Atlético Tucumán',
  'Aldosivi',
  'Estudiantes de Río Cuarto',
]

// Short names para mostrar en el bracket
const SHORT_NAMES: Record<string, string> = {
  'Estudiantes de La Plata': 'Estudiantes',
  'Boca Juniors': 'Boca',
  'Vélez Sarsfield': 'Vélez',
  'Talleres': 'Talleres',
  'Lanús': 'Lanús',
  'San Lorenzo': 'San Lorenzo',
  'Independiente': 'Independiente',
  'Unión': 'Unión',
  'Defensa y Justicia': 'Defensa',
  'Instituto': 'Instituto',
  'Platense': 'Platense',
  'Gimnasia y Esgrima de Mendoza': 'Gimnasia Mendoza',
  'Central Córdoba': 'Central Cba.',
  "Newell's Old Boys": "Newell's",
  'Deportivo Riestra': 'Riestra',
  'Independiente Rivadavia': 'Ind. Rivadavia',
  'River Plate': 'River',
  'Argentinos Juniors': 'Argentinos',
  'Rosario Central': 'R. Central',
  'Belgrano': 'Belgrano',
  'Gimnasia y Esgrima de La Plata': 'Gimnasia LP',
  'Huracán': 'Huracán',
  'Barracas Central': 'Barracas',
  'Racing': 'Racing',
  'Tigre': 'Tigre',
  'Sarmiento': 'Sarmiento',
  'Banfield': 'Banfield',
  'Atlético Tucumán': 'Atl. Tucumán',
  'Aldosivi': 'Aldosivi',
  'Estudiantes de Río Cuarto': 'Estudiantes RC',
}

async function seed() {
  console.log('🌱 Seeding Liga Profesional 2026...')

  // 1. Crear torneo
  const [tournament] = await db.insert(tournaments).values({
    name: 'Liga Profesional de Fútbol 2026',
    shortName: 'LPF 2026',
    country: 'Argentina',
    season: 2026,
    hasGroups: true,
    active: true,
  }).returning()
  console.log(`✅ Torneo creado: ${tournament.name} (id: ${tournament.id})`)

  // 2. Crear todos los equipos
  const allTeamNames = [...GROUP_A_TEAMS, ...GROUP_B_TEAMS]
  const insertedTeams = await db.insert(teams).values(
    allTeamNames.map((name) => ({
      name,
      shortName: SHORT_NAMES[name] ?? name,
      country: 'Argentina',
    }))
  ).returning()
  console.log(`✅ ${insertedTeams.length} equipos creados`)

  const teamByName = Object.fromEntries(insertedTeams.map((t) => [t.name, t]))

  // 3. Crear grupos
  const [groupA] = await db.insert(groups).values({
    tournamentId: tournament.id,
    name: 'Grupo A',
  }).returning()

  const [groupB] = await db.insert(groups).values({
    tournamentId: tournament.id,
    name: 'Grupo B',
  }).returning()
  console.log(`✅ Grupos creados: Grupo A (id: ${groupA.id}), Grupo B (id: ${groupB.id})`)

  // 4. Asignar equipos a grupos
  await db.insert(groupTeams).values(
    GROUP_A_TEAMS.map((name) => ({
      groupId: groupA.id,
      teamId: teamByName[name].id,
    }))
  )

  await db.insert(groupTeams).values(
    GROUP_B_TEAMS.map((name) => ({
      groupId: groupB.id,
      teamId: teamByName[name].id,
    }))
  )
  console.log(`✅ Equipos asignados a grupos`)

  console.log('\n🎉 Seed completado!')
  console.log(`   Tournament ID: ${tournament.id}`)
  console.log(`   Grupo A ID: ${groupA.id}`)
  console.log(`   Grupo B ID: ${groupB.id}`)
  console.log('\n   Guardá estos IDs para el admin panel.')
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err)
  process.exit(1)
})
