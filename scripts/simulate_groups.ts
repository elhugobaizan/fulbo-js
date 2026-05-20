import dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'

async function main() {
  const db = neon(process.env.DATABASE_URL!)

  console.log('Marking existing matches as finished...')
  await db`UPDATE matches SET status='finished', home_score=2, away_score=1, matchday=1 WHERE id IN (466,468,470,473,475,478,480,482,484,486,488)`
  await db`UPDATE matches SET status='finished', home_score=0, away_score=2, matchday=1 WHERE id IN (467,469,471,474,476,479,481,483,485,487,489)`
  await db`UPDATE matches SET status='finished', home_score=1, away_score=1, matchday=1 WHERE id=472`
  await db`UPDATE matches SET status='finished', home_score=2, away_score=0, matchday=1 WHERE id=477`
  console.log('✓ 24 existing matches updated')

  console.log('Inserting missing matches...')
  const missing = [
    // Grupo A (55): 1v3, 2v4, 1v4, 2v3
    [55, 2, 1, 3, 2, 1], [55, 2, 2, 4, 1, 1], [55, 3, 1, 4, 3, 0], [55, 3, 2, 3, 0, 2],
    // Grupo B (56): 5v7, 6v8, 5v8, 6v7
    [56, 2, 5, 7, 1, 0], [56, 2, 6, 8, 2, 2], [56, 3, 5, 8, 1, 1], [56, 3, 6, 7, 0, 1],
    // Grupo C (57): 9v11, 10v12, 9v12, 10v11
    [57, 2, 9, 11, 3, 0], [57, 2, 10, 12, 1, 1], [57, 3, 9, 12, 2, 0], [57, 3, 10, 11, 1, 2],
    // Grupo D (58): 13v15, 14v16, 13v16, 14v15
    [58, 2, 13, 15, 0, 1], [58, 2, 14, 16, 2, 0], [58, 3, 13, 16, 1, 1], [58, 3, 14, 15, 0, 2],
    // Grupo E (59): 17v19, 18v20, 17v20, 18v19
    [59, 2, 17, 19, 2, 1], [59, 2, 18, 20, 0, 0], [59, 3, 17, 20, 1, 0], [59, 3, 18, 19, 1, 2],
    // Grupo F (60): 21v23, 22v24, 21v24, 22v23
    [60, 2, 21, 23, 1, 1], [60, 2, 22, 24, 3, 1], [60, 3, 21, 24, 2, 0], [60, 3, 22, 23, 1, 0],
    // Grupo G (61): 25v27, 26v28, 25v28, 26v27
    [61, 2, 25, 27, 2, 2], [61, 2, 26, 28, 1, 0], [61, 3, 25, 28, 3, 1], [61, 3, 26, 27, 0, 1],
    // Grupo H (62): 29v31, 30v32, 29v32, 30v31
    [62, 2, 29, 31, 1, 0], [62, 2, 30, 32, 2, 1], [62, 3, 29, 32, 0, 0], [62, 3, 30, 31, 1, 2],
    // Grupo I (63): 33v35, 34v36, 33v36, 34v35
    [63, 2, 33, 35, 2, 0], [63, 2, 34, 36, 1, 1], [63, 3, 33, 36, 1, 0], [63, 3, 34, 35, 2, 1],
    // Grupo J (64): 37v39, 38v40, 37v40, 38v39
    [64, 2, 37, 39, 3, 1], [64, 2, 38, 40, 0, 1], [64, 3, 37, 40, 2, 2], [64, 3, 38, 39, 1, 0],
    // Grupo K (65): 41v43, 42v44, 41v44, 42v43
    [65, 2, 41, 43, 1, 1], [65, 2, 42, 44, 2, 0], [65, 3, 41, 44, 3, 0], [65, 3, 42, 43, 1, 2],
    // Grupo L (66): 45v47, 46v48, 45v48, 46v47
    [66, 2, 45, 47, 2, 1], [66, 2, 46, 48, 1, 0], [66, 3, 45, 48, 1, 1], [66, 3, 46, 47, 0, 2],
  ]

  for (const [gid, md, home, away, hs, as_] of missing) {
    await db`
      INSERT INTO matches (tournament_id, phase, status, group_id, matchday, home_team_id, away_team_id, home_score, away_score, scheduled_at, created_at, updated_at)
      VALUES (10, 'group', 'finished', ${gid}, ${md}, ${home}, ${away}, ${hs}, ${as_}, NOW(), NOW(), NOW())
    `
  }
  console.log(`✓ ${missing.length} new matches inserted`)
  console.log('\nDone! All groups have 6 finished matches.')
  console.log('To revert: restore your Neon snapshot.')
}

main().catch(console.error)
