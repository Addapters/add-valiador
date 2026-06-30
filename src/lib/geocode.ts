const NOMINATIM = 'https://nominatim.openstreetmap.org'

export interface GeoResult { lat: number; lon: number; display_name: string }

// Bounding box aproximado de Portugal continental + ilhas
// Usado para validar se o resultado faz sentido geograficamente
const PT_BOUNDS = { minLat: 32.0, maxLat: 42.5, minLon: -31.5, maxLon: -6.0 }

function isWithinPortugal(lat: number, lon: number): boolean {
  return lat >= PT_BOUNDS.minLat && lat <= PT_BOUNDS.maxLat &&
         lon >= PT_BOUNDS.minLon && lon <= PT_BOUNDS.maxLon
}

async function tryFetch(q: string): Promise<GeoResult | null> {
  if (!q || q.trim() === '') return null
  try {
    const res = await fetch(
      `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pt`,
      { headers: { 'Accept-Language': 'pt-PT' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.length) return null
    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (isNaN(lat) || isNaN(lon)) return null
    // Valida que o resultado está dentro de Portugal — evita falsos positivos
    if (!isWithinPortugal(lat, lon)) return null
    return { lat, lon, display_name: data[0].display_name }
  } catch {
    return null
  }
}

export async function geocodeAddress(
  address?: string, postalCode?: string, municipality?: string, district?: string
): Promise<GeoResult | null> {
  // Limpa e normaliza as partes — remove valores vazios/nulos
  const clean = (s?: string) => (s && s.trim() && s.trim() !== '-' ? s.trim() : undefined)
  const addr = clean(address)
  const cp   = clean(postalCode)
  const mun  = clean(municipality)
  const dist = clean(district)

  // Tentativas progressivamente menos específicas, da mais precisa à mais genérica
  // Cada tentativa é validada geograficamente antes de ser aceite
  const attempts: string[] = []

  if (addr && cp && mun) attempts.push(`${addr}, ${cp} ${mun}, Portugal`)
  if (addr && mun)       attempts.push(`${addr}, ${mun}, Portugal`)
  if (cp && mun)         attempts.push(`${cp} ${mun}, Portugal`)
  if (addr && dist)      attempts.push(`${addr}, ${dist}, Portugal`)
  if (mun && dist)       attempts.push(`${mun}, ${dist}, Portugal`)
  if (cp)                attempts.push(`${cp}, Portugal`)
  if (mun)               attempts.push(`${mun}, Portugal`)

  for (const q of attempts) {
    const result = await tryFetch(q)
    if (result) return result
    // Pequeno delay para respeitar rate-limit do Nominatim (1 req/seg)
    await new Promise(r => setTimeout(r, 1100))
  }

  return null
}
