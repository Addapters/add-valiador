const NOMINATIM = 'https://nominatim.openstreetmap.org'

export interface GeoResult { lat: number; lon: number; display_name: string }

export async function geocodeAddress(
  address?: string, postalCode?: string, municipality?: string, district?: string
): Promise<GeoResult | null> {
  const parts = [address, postalCode, municipality, district, 'Portugal'].filter(Boolean)
  const tryFetch = async (q: string) => {
    try {
      const res = await fetch(
        `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pt`,
        { headers: { 'Accept-Language': 'pt-PT', 'User-Agent': 'AddValiador/1.0' } }
      )
      const data = await res.json()
      if (data.length) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name }
    } catch {}
    return null
  }
  return (await tryFetch(parts.join(', '))) || (postalCode ? await tryFetch(`${postalCode}, Portugal`) : null)
}
