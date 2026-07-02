import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'

declare global {
  interface Window { L: any }
}

function useLeaflet(cb: () => void) {
  useEffect(() => {
    if (window.L) { cb(); return }
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = cb
    document.head.appendChild(script)
  }, [])
}

export default function PropertyMap() {
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapInst  = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)
  const [clientId, setClientId]     = useState('')
  const [portfolioId, setPortfolioId] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name')
      return (data || []) as any[]
    }
  })

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('id, name, client_id').order('name')
      return (data || []) as any[]
    }
  })

  const filteredPortfolios = clientId
    ? portfolios.filter((p: any) => p.client_id === clientId)
    : portfolios

  const { data: properties = [], isFetching: propertiesFetching } = useQuery({
    queryKey: ['properties-map', portfolioId, clientId],
    queryFn: async () => {
      let q = supabase
        .from('properties')
        .select('id, ref, external_ref, address, municipality, property_type, typology, latitude, longitude, visit_status, portfolio_id, client_id')
        .not('latitude', 'is', null)
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      else if (clientId) q = q.eq('client_id', clientId)
      const { data } = await q
      return (data || []) as any[]
    }
  })

  useLeaflet(() => setReady(true))

  useEffect(() => {
    if (!ready || !mapRef.current || mapInst.current) return
    const L = window.L
    mapInst.current = L.map(mapRef.current).setView([39.5, -8.0], 7)

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 19 }
    )
    const street = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap', maxZoom: 19 }
    )
    satellite.addTo(mapInst.current)
    L.control.layers({ 'Satélite': satellite, 'Mapa': street }, {}, { position: 'topright' }).addTo(mapInst.current)
  }, [ready])

  useEffect(() => {
    if (!ready || !mapInst.current) return
    const L = window.L

    // remove existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const colorMap: any = { pending: '#9ca3af', scheduled: '#3b82f6', visited: '#f59e0b', report_done: '#10b981' }

    properties.forEach((p: any) => {
      if (!p.latitude || !p.longitude) return
      const color = colorMap[p.visit_status] || '#9ca3af'
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6]
      })
      const marker = L.marker([p.latitude, p.longitude], { icon })
        .addTo(mapInst.current)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <p style="font-weight:600;margin:0 0 4px">${p.external_ref || '—'}</p>
            <p style="color:#6b7280;margin:0 0 2px;font-size:12px">${p.address || p.municipality || ''}</p>
            <p style="color:#6b7280;margin:0 0 6px;font-size:12px">${[p.property_type, p.typology].filter(Boolean).join(' ')}</p>
            <a href="/properties/${p.id}" style="color:#1D9E75;font-size:12px">Abrir ficha →</a>
          </div>
        `)
      markersRef.current.push(marker)
    })

    if (properties.length > 0) {
      const coords = properties.filter((p: any) => p.latitude).map((p: any) => [p.latitude, p.longitude])
      if (coords.length) mapInst.current.fitBounds(coords, { padding: [40, 40] })
    }
  }, [ready, properties])

  return (
    <div>
      <PageHeader title="Mapa" subtitle={`${properties.length} imóveis georreferenciados`} />
      <div className="p-6 space-y-4">
        {/* Filtros em cascata */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Cliente</label>
            <select className="input text-sm py-1.5 min-w-[180px]" value={clientId}
              onChange={e => { setClientId(e.target.value); setPortfolioId('') }}>
              <option value="">Todos os clientes</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Projeto</label>
            <select className="input text-sm py-1.5 min-w-[200px]" value={portfolioId}
              onChange={e => setPortfolioId(e.target.value)}>
              <option value="">Todos os projetos</option>
              {filteredPortfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-xs text-gray-500">
          {[['#9ca3af','Por visitar'],['#3b82f6','Agendado'],['#f59e0b','Visitado'],['#10b981','Report OK']].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span style={{ background: c }} className="inline-block w-3 h-3 rounded-full border-2 border-white shadow" />
              {l}
            </span>
          ))}
        </div>

        {propertiesFetching ? (
          <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            A carregar imóveis…
          </div>
        ) : properties.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            Nenhum imóvel georreferenciado para esta selecção. Abre a ficha de um imóvel e usa o botão "Obter coordenadas" para geocodificar automaticamente.
          </div>
        ) : null}
        <div ref={mapRef} style={{ height: '520px', borderRadius: '12px', border: '0.5px solid #e5e7eb' }} />
      </div>
    </div>
  )
}
