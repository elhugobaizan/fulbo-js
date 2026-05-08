import {
  pgTable, serial, varchar, integer, timestamp,
  pgEnum, unique, boolean
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const matchPhaseEnum = pgEnum('match_phase', ['group', 'knockout'])

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled', // programado
  'live',       // en juego
  'finished',   // finalizado
  'postponed',  // postergado
  'cancelled',  // cancelado
])

export const knockoutRoundEnum = pgEnum('knockout_round', [
  'round_of_16',   // octavos
  'quarterfinal',  // cuartos
  'semifinal',     // semifinal
  'third_place',   // tercer puesto (opcional)
  'final',         // final
])

// ─── Tournaments ─────────────────────────────────────────────────────────────

export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),        // "Copa de la Liga 2025"
  shortName: varchar('short_name', { length: 30 }),        // "CdL 2025"
  country: varchar('country', { length: 50 }),             // "Argentina"
  season: integer('season').notNull(),                     // 2025
  logoUrl: varchar('logo_url', { length: 500 }),
  hasGroups: boolean('has_groups').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  qualifiersPerGroup: integer('qualifiers_per_group').notNull().default(8),
  allowCrossGroup: boolean('allow_cross_group').default(false).notNull(),
  knockoutStarted: boolean('knockout_started').default(false).notNull(),
})

// ─── Teams ───────────────────────────────────────────────────────────────────
// Reutilizables entre torneos

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  shortName: varchar('short_name', { length: 20 }),        // "Boca", "River"
  logoUrl: varchar('logo_url', { length: 500 }),
  country: varchar('country', { length: 50 }),
  externalId: integer('external_id'),
  color: varchar('color', { length: 6 }),
  alternateColor: varchar('alternate_color', { length: 6 }),
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Groups ──────────────────────────────────────────────────────────────────

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  name: varchar('name', { length: 50 }).notNull(),         // "Grupo A", "Grupo B"
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.tournamentId, t.name),
}))

// ─── Group Teams ─────────────────────────────────────────────────────────────
// Qué equipos participan en cada grupo

export const groupTeams = pgTable('group_teams', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').notNull().references(() => groups.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
}, (t) => ({
  uniq: unique().on(t.groupId, t.teamId),
}))

// ─── Matches ─────────────────────────────────────────────────────────────────
// Todos los partidos: fase de grupos Y eliminatoria

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  phase: matchPhaseEnum('phase').notNull(),
  status: matchStatusEnum('status').notNull().default('scheduled'),

  // Fase de grupos
  groupId: integer('group_id').references(() => groups.id), // null si es eliminatoria
  matchday: integer('matchday'),                             // fecha 1, 2, 3...

  // Eliminatoria
  knockoutRound: knockoutRoundEnum('knockout_round'),        // null si es fase de grupos
  bracketPosition: integer('bracket_position'),             // 1-8 para octavos, etc.

  // Equipos y resultado
  homeTeamId: integer('home_team_id').references(() => teams.id),
  awayTeamId: integer('away_team_id').references(() => teams.id),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),

  // Penales (si aplica en eliminatoria)
  homePenalties: integer('home_penalties'),
  awayPenalties: integer('away_penalties'),

  espnMatchId: integer('espn_match_id'), // ID de partido en API de ESPN (opcional)

  // Fecha y hora
  scheduledAt: timestamp('scheduled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type Tournament = typeof tournaments.$inferSelect
export type NewTournament = typeof tournaments.$inferInsert
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type Group = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert
export type GroupTeam = typeof groupTeams.$inferSelect
export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert

// ─── Bracket Rules ───────────────────────────────────────────────────────────
// Configuración de cruces eliminatorios por torneo

export const bracketRules = pgTable('bracket_rules', {
  id: serial('id').primaryKey(),
  tournamentId: integer('tournament_id').notNull().references(() => tournaments.id),
  knockoutRound: knockoutRoundEnum('knockout_round').notNull(),
  bracketPosition: integer('bracket_position').notNull(), // orden del cruce: 1, 2, 3...

  // Origen desde fase de grupos (octavos)
  homeGroupId: integer('home_group_id').references(() => groups.id),
  homePosition: integer('home_position'), // 1° del grupo, 2°, etc.
  awayGroupId: integer('away_group_id').references(() => groups.id),
  awayPosition: integer('away_position'),

  // Origen desde ronda anterior (cuartos, semi, final)
  homeWinnerOf: integer('home_winner_of'), // references bracket_rules.id
  awayWinnerOf: integer('away_winner_of'), // references bracket_rules.id

  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  uniq: unique().on(t.tournamentId, t.knockoutRound, t.bracketPosition),
}))

export type BracketRule = typeof bracketRules.$inferSelect
export type NewBracketRule = typeof bracketRules.$inferInsert

export const localPlayers = pgTable('local_players', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  teamId: integer('team_id').references(() => teams.id).notNull(),
  tournamentId: integer('tournament_id').references(() => tournaments.id).notNull(),
  position: varchar('position', { length: 20 }),
  externalId: integer('external_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const matchEvents = pgTable('match_events', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  minute: integer('minute'),
  type: varchar('type', { length: 20 }).notNull(),
  playerId: integer('player_id').references(() => localPlayers.id),
  playerOutId: integer('player_out_id').references(() => localPlayers.id),
  teamId: integer('team_id').references(() => teams.id).notNull(),
  isPenalty: boolean('is_penalty').default(false),
  isOwnGoal: boolean('is_own_goal').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const matchLineups = pgTable('match_lineups', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  teamId: integer('team_id').references(() => teams.id).notNull(),
  playerId: integer('player_id').references(() => localPlayers.id).notNull(),
  isStarter: boolean('is_starter').default(true).notNull(),
  shirtNumber: integer('shirt_number'),
  createdAt: timestamp('created_at').defaultNow(),
})