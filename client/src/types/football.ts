// ─── Standings ───────────────────────────────────────────────────────────────

export interface StandingTeam {
  id: number
  name: string
  logo: string
}

export interface StandingGoals {
  for: number
  against: number
}

export interface StandingAll {
  played: number
  win: number
  draw: number
  lose: number
  goals: StandingGoals
}

export interface Standing {
  rank: number
  team: StandingTeam
  points: number
  goalsDiff: number
  group: string
  form: string
  status: string
  description: string | null
  all: StandingAll
  home: StandingAll
  away: StandingAll
  update: string
}

export interface StandingsLeague {
  id: number
  name: string
  country: string
  logo: string
  flag: string
  season: number
  standings: Standing[][]
}

export interface StandingsResponse {
  league: StandingsLeague
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export interface FixtureTeam {
  id: number
  name: string
  logo: string
  winner: boolean | null
}

export interface FixtureGoals {
  home: number | null
  away: number | null
}

export interface FixtureStatus {
  long: string
  short: string
  elapsed: number | null
}

export interface FixtureInfo {
  id: number
  date: string
  timestamp: number
  venue: { id: number; name: string; city: string } | null
  status: FixtureStatus
}

export interface Fixture {
  fixture: FixtureInfo
  league: { id: number; name: string; logo: string; round: string }
  teams: { home: FixtureTeam; away: FixtureTeam }
  goals: FixtureGoals
  score: {
    halftime: FixtureGoals
    fulltime: FixtureGoals
    extratime: FixtureGoals
    penalty: FixtureGoals
  }
}

// ─── Players ─────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  id: number
  name: string
  firstname: string
  lastname: string
  age: number
  nationality: string
  photo: string
  height: string | null
  weight: string | null
  injured: boolean
  birth: { date: string; place: string; country: string }
}

export interface PlayerStatistics {
  team: { id: number; name: string; logo: string }
  league: { id: number; name: string; logo: string; season: number }
  games: {
    appearences: number | null
    lineups: number | null
    minutes: number | null
    position: string
    rating: string | null
    captain: boolean
  }
  substitutes: { in: number | null; out: number | null; bench: number | null }
  shots: { total: number | null; on: number | null }
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null }
  passes: { total: number | null; key: number | null; accuracy: number | null }
  tackles: { total: number | null; blocks: number | null; interceptions: number | null }
  duels: { total: number | null; won: number | null }
  dribbles: { attempts: number | null; success: number | null }
  fouls: { drawn: number | null; committed: number | null }
  cards: { yellow: number | null; yellowred: number | null; red: number | null }
  penalty: { won: number | null; scored: number | null; missed: number | null; saved: number | null }
}

export interface Player {
  player: PlayerInfo
  statistics: PlayerStatistics[]
}
