import axios from 'axios'

export function getFootballApi() {
  const key = process.env.FOOTBALL_API_KEY ?? ''
  return axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: {
      'x-apisports-key': key,
    },
  })
}

export const LIGA_PROFESIONAL_ID = 128
export const CURRENT_SEASON = 2024