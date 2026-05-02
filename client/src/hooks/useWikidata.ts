import { useQuery } from '@tanstack/react-query'

export interface WikidataTeamInfo {
  founded: string | null
  stadiumName: string | null
  stadiumCapacity: number | null
  website: string | null
  imageUrl: string | null
  wikidataUrl: string | null
}

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

async function searchWikidata(teamName: string): Promise<string | null> {
  const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(teamName)}&language=es&type=item&format=json&origin=*&limit=5`
  const res = await fetch(url)
  const data = await res.json()
  const results = data.search ?? []
  // Prefer results that mention "fútbol" or "football" in description
  const best = results.find((r: any) =>
    r.description?.toLowerCase().includes('fútbol') ||
    r.description?.toLowerCase().includes('football') ||
    r.description?.toLowerCase().includes('club')
  ) ?? results[0]
  return best?.id ?? null
}

async function fetchEntityData(entityId: string): Promise<WikidataTeamInfo> {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${entityId}&format=json&origin=*&props=claims`
  const res = await fetch(url)
  const data = await res.json()
  const claims = data.entities?.[entityId]?.claims ?? {}

  // P571 = inception (fundación)
  const foundedRaw = claims.P571?.[0]?.mainsnak?.datavalue?.value?.time
  const founded = foundedRaw ? foundedRaw.replace(/^\+/, '').substring(0, 4) : null

  // P115 = home venue (estadio) - need to fetch label
  const stadiumId = claims.P115?.[0]?.mainsnak?.datavalue?.value?.id ?? null
  let stadiumName: string | null = null
  let stadiumCapacity: number | null = null

  if (stadiumId) {
    const sRes = await fetch(`${WIKIDATA_API}?action=wbgetentities&ids=${stadiumId}&format=json&origin=*&props=labels|claims&languages=es`)
    const sData = await sRes.json()
    const sEntity = sData.entities?.[stadiumId]
    stadiumName = sEntity?.labels?.es?.value ?? sEntity?.labels?.en?.value ?? null
    // P1083 = maximum capacity
    const cap = sEntity?.claims?.P1083?.[0]?.mainsnak?.datavalue?.value?.amount
    stadiumCapacity = cap ? parseInt(cap.replace('+', '')) : null
  }

  // P856 = official website
  const website = claims.P856?.[0]?.mainsnak?.datavalue?.value ?? null

  // P18 = image
  const imageFile = claims.P18?.[0]?.mainsnak?.datavalue?.value
  const imageUrl = imageFile
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=200`
    : null

  return {
    founded,
    stadiumName,
    stadiumCapacity,
    website,
    imageUrl,
    wikidataUrl: `https://www.wikidata.org/wiki/${entityId}`,
  }
}

async function fetchWikidataTeamInfo(teamName: string): Promise<WikidataTeamInfo | null> {
  try {
    const entityId = await searchWikidata(teamName)
    if (!entityId) return null
    return await fetchEntityData(entityId)
  } catch {
    return null
  }
}

export function useWikidata(teamName: string | null) {
  return useQuery({
    queryKey: ['wikidata', teamName],
    queryFn: () => fetchWikidataTeamInfo(teamName!),
    enabled: !!teamName,
    staleTime: 1000 * 60 * 60 * 24, // 24h — datos estables
    retry: false,
  })
}
