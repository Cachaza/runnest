import { municipalities, type Municipality } from './data/municipalities.js'

export type MunicipalitySuggestion = {
  id: string
  label: string
  latitude: number
  longitude: number
  municipality: string
  province: string
  slug: string
  subtitle: string
}

const MAX_SUGGESTIONS = 6
const MIN_QUERY_LENGTH = 2

export function normalizeLocationSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toSuggestion(municipality: Municipality): MunicipalitySuggestion {
  return {
    id: `muni-${municipality.slug}`,
    label: municipality.name,
    latitude: municipality.lat,
    longitude: municipality.lng,
    municipality: municipality.name,
    province: municipality.province,
    slug: municipality.slug,
    subtitle: municipality.province,
  }
}

export function searchMunicipalities(query: string, limit = MAX_SUGGESTIONS) {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return []
  }

  const normalizedQuery = normalizeLocationSearch(trimmedQuery)
  const startsWith: MunicipalitySuggestion[] = []
  const includes: MunicipalitySuggestion[] = []
  const maxResults = Math.max(1, Math.min(limit, 12))

  for (const municipality of municipalities) {
    if (startsWith.length + includes.length >= maxResults * 2) {
      break
    }

    if (municipality.search.startsWith(normalizedQuery)) {
      startsWith.push(toSuggestion(municipality))
    } else if (municipality.search.includes(normalizedQuery)) {
      includes.push(toSuggestion(municipality))
    }
  }

  return [...startsWith, ...includes].slice(0, maxResults)
}

export function findMunicipalityBySlug(slug: string) {
  return municipalities.find((municipality) => municipality.slug === slug) ?? null
}
