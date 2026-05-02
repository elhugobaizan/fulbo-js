import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { ok, err } from '../_lib/helpers'

export interface NewsArticle {
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string
  source: { name: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405)

  const query = (req.query.q as string) || 'fútbol argentino'
  const pageSize = Number(req.query.pageSize) || 6

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        language: 'es',
        sortBy: 'publishedAt',
        pageSize,
        apiKey: process.env.NEWS_API_KEY,
      },
    })

    const articles: NewsArticle[] = response.data.articles
      .filter((a: NewsArticle) => a.title !== '[Removed]' && a.urlToImage)

    return ok(res, articles)
  } catch (error) {
    return err(res, 'Error fetching news')
  }
}
