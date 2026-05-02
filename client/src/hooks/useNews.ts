import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface NewsArticle {
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string
  source: { name: string }
}

async function fetchNews(query: string, pageSize: number): Promise<NewsArticle[]> {
  const { data } = await apiClient.get('/news', { params: { q: query, pageSize } })
  return data.data ?? []
}

export function useNews(query = 'fútbol argentino', pageSize = 6) {
  return useQuery({
    queryKey: ['news', query, pageSize],
    queryFn: () => fetchNews(query, pageSize),
    staleTime: 1000 * 60 * 15, // 15 minutos
  })
}
