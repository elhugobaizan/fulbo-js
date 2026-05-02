// Seed: Reglas de bracket para Liga Profesional 2026
// Correr con: npx tsx scripts/seed-bracket-rules.ts
// IMPORTANTE: Correr DESPUÉS de seed-lpf2026.ts
// Necesitás los IDs del torneo y grupos del seed anterior

import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { bracketRules } from '../api/_lib/tournament-schema.js'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

// ⚠️ Actualizá estos IDs con los que te imprimió el seed anterior
const TOURNAMENT_ID = 1
const GROUP_A_ID = 1
const GROUP_B_ID = 2

async function seedBracketRules() {
  console.log('🌱 Seeding bracket rules para LPF 2026...')

  // ─── Octavos (round_of_16) ───────────────────────────────────────────────
  // Cruces desde fase de grupos

  const octavos = await db.insert(bracketRules).values([
    // Cruce 1: 1° Grupo A vs 8° Grupo B
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 1, homeGroupId: GROUP_A_ID, homePosition: 1, awayGroupId: GROUP_B_ID, awayPosition: 8 },
    // Cruce 2: 1° Grupo B vs 8° Grupo A
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 2, homeGroupId: GROUP_B_ID, homePosition: 1, awayGroupId: GROUP_A_ID, awayPosition: 8 },
    // Cruce 3: 2° Grupo A vs 7° Grupo B
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 3, homeGroupId: GROUP_A_ID, homePosition: 2, awayGroupId: GROUP_B_ID, awayPosition: 7 },
    // Cruce 4: 2° Grupo B vs 7° Grupo A
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 4, homeGroupId: GROUP_B_ID, homePosition: 2, awayGroupId: GROUP_A_ID, awayPosition: 7 },
    // Cruce 5: 3° Grupo A vs 6° Grupo B
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 5, homeGroupId: GROUP_A_ID, homePosition: 3, awayGroupId: GROUP_B_ID, awayPosition: 6 },
    // Cruce 6: 3° Grupo B vs 6° Grupo A
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 6, homeGroupId: GROUP_B_ID, homePosition: 3, awayGroupId: GROUP_A_ID, awayPosition: 6 },
    // Cruce 7: 4° Grupo A vs 5° Grupo B
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 7, homeGroupId: GROUP_A_ID, homePosition: 4, awayGroupId: GROUP_B_ID, awayPosition: 5 },
    // Cruce 8: 4° Grupo B vs 5° Grupo A
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'round_of_16', bracketPosition: 8, homeGroupId: GROUP_B_ID, homePosition: 4, awayGroupId: GROUP_A_ID, awayPosition: 5 },
  ]).returning()

  console.log(`✅ ${octavos.length} cruces de octavos creados`)

  // Mapeamos posición → id para referencias
  const r16 = Object.fromEntries(octavos.map((r) => [r.bracketPosition, r.id]))

  // ─── Cuartos (quarterfinal) ──────────────────────────────────────────────
  // Cruces desde ganadores de octavos

  const cuartos = await db.insert(bracketRules).values([
    // Cuarto 1: Ganador cruce 1 vs Ganador cruce 8
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'quarterfinal', bracketPosition: 1, homeWinnerOf: r16[1], awayWinnerOf: r16[8] },
    // Cuarto 2: Ganador cruce 4 vs Ganador cruce 5
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'quarterfinal', bracketPosition: 2, homeWinnerOf: r16[4], awayWinnerOf: r16[5] },
    // Cuarto 3: Ganador cruce 2 vs Ganador cruce 7
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'quarterfinal', bracketPosition: 3, homeWinnerOf: r16[2], awayWinnerOf: r16[7] },
    // Cuarto 4: Ganador cruce 3 vs Ganador cruce 6
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'quarterfinal', bracketPosition: 4, homeWinnerOf: r16[3], awayWinnerOf: r16[6] },
  ]).returning()

  console.log(`✅ ${cuartos.length} cruces de cuartos creados`)

  const qf = Object.fromEntries(cuartos.map((r) => [r.bracketPosition, r.id]))

  // ─── Semis (semifinal) ────────────────────────────────────────────────────

  const semis = await db.insert(bracketRules).values([
    // Semi 1: Ganador cuarto 1 vs Ganador cuarto 2
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'semifinal', bracketPosition: 1, homeWinnerOf: qf[1], awayWinnerOf: qf[2] },
    // Semi 2: Ganador cuarto 3 vs Ganador cuarto 4
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'semifinal', bracketPosition: 2, homeWinnerOf: qf[3], awayWinnerOf: qf[4] },
  ]).returning()

  console.log(`✅ ${semis.length} semfinales creadas`)

  const sf = Object.fromEntries(semis.map((r) => [r.bracketPosition, r.id]))

  // ─── Final ────────────────────────────────────────────────────────────────

  const final = await db.insert(bracketRules).values([
    { tournamentId: TOURNAMENT_ID, knockoutRound: 'final', bracketPosition: 1, homeWinnerOf: sf[1], awayWinnerOf: sf[2] },
  ]).returning()

  console.log(`✅ Final creada`)

  console.log('\n🎉 Bracket rules seeded!')
  console.log('   IDs de octavos:', r16)
  console.log('   IDs de cuartos:', qf)
  console.log('   IDs de semis:', sf)
  console.log('   ID de final:', final[0].id)
}

seedBracketRules().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
