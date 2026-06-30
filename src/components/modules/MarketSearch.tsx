import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { ExternalLink, Info, Plus, Trash2, Link as LinkIcon, CheckCircle, Circle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const PORTALS = [
  { name: 'Idealista',   url: 'https://www.idealista.pt',          color: 'bg-blue-50   text-blue-700   border-blue-200' },
  { name: 'Imovirtual',  url: 'https://www.imovirtual.com',         color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Casa Sapo',   url: 'https://casa.sapo.pt',               color: 'bg-green-50  text-green-700  border-green-200' },
  { name: 'ERA',         url: 'https://www.era.pt',                  color: 'bg-red-50    text-red-700    border-red-200' },
  { name: 'Remax',       url: 'https://www.remax.pt',                color: 'bg-amber-50  text-amber-700  border-amber-200' },
  { name: 'BPI Expresso',url: 'https://www.bpiexpressoimovel.com',   color: 'bg-gray-50   text-gray-700   border-gray-200' },
]

export default function MarketSearch() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedProperty, setSelectedProperty] = useState('')
  const [form, setForm] = useState({
    portal: 'Idealista', listing_ref: '', url: '',
    typology: '', area_m2: '', price: '', notes: ''
  })

  // Lista de imóveis com contagem de comparáveis já existentes
  const { data: properties = [] } = useQuery({
    queryKey: ['properties-simple-with-comps'],
    queryFn: async () => {
      const { data: props } = await supabase
        .from('properties')
        .select('id, external_ref, id_bien, address, municipality, property_type')
        .order('external_ref')
      const { data: compsCount } = await supabase
        .from('market_comps')
        .select('property_id')
      const countMap: Record<string, number> = {}
      ;(compsCount || []).forEach((c: any) => {
        countMap[c.property_id] = (countMap[c.property_id] || 0) + 1
      })
      return (props || []).map((p: any) => ({ ...p, comps_count: countMap[p.id] || 0 }))
    }
  })

  const filteredProperties = properties.filter((p: any) => {
    if (!search) return true
    const s = search.toLowerCase().trim()
    return [p.external_ref, p.id_bien, p.address, p.municipality]
      .some((v: any) => v !== null && v !== undefined && String(v).toLowerCase().includes(s))
  })

  const { data: comps = [] } = useQuery({
    queryKey: ['all-comps', selectedProperty],
    enabled: !!selectedProperty,
    queryFn: async () => {
      const { data } = await supabase.from('market_comps').select('*').eq('property_id', selectedProperty).order('created_at', { ascending: false })
      return (data||[]) as any[]
    }
  })

  const addComp = useMutation({
    mutationFn: async () => {
      if (!selectedProperty) throw new Error('Selecciona um imóvel')
      const { error } = await supabase.from('market_comps').insert({
        property_id:  selectedProperty,
        portal:       form.portal,
        listing_ref:  form.listing_ref || null,
        url:          form.url         || null,
        typology:     form.typology    || null,
        area_m2:      form.area_m2     ? parseFloat(form.area_m2)  : null,
        price:        form.price       ? parseFloat(form.price)    : null,
        notes:        form.notes       || null,
      })
      if (error) throw error
      // Marca o imóvel como tendo comparáveis
      await supabase.from('properties').update({ tem_comparaveis: true }).eq('id', selectedProperty)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-comps', selectedProperty] })
      qc.invalidateQueries({ queryKey: ['properties-simple-with-comps'] })
      toast.success('Comparável adicionado')
      setForm({ portal:'Idealista', listing_ref:'', url:'', typology:'', area_m2:'', price:'', notes:'' })
    },
    onError: (e: any) => toast.error(e.message)
  })

  const delComp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('market_comps').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-comps', selectedProperty] })
      qc.invalidateQueries({ queryKey: ['properties-simple-with-comps'] })
    }
  })

  const medianPricePerM2 = (() => {
    const vals = comps
      .map((c: any) => c.price && c.area_m2 ? parseFloat(c.price) / parseFloat(c.area_m2) : null)
      .filter((v: any): v is number => v !== null)
    if (!vals.length) return null
    const s = [...vals].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 !== 0 ? Math.round(s[m]) : Math.round((s[m-1] + s[m]) / 2)
  })()

  const selectedProp = properties.find((p: any) => p.id === selectedProperty)

  return (
    <div>
      <PageHeader title="Prospeção de mercado" subtitle="Registo de comparáveis por imóvel"/>
      <div className="p-6 space-y-6">

        {/* Portal shortcuts */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Acesso rápido aos portais</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {PORTALS.map(p => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-opacity hover:opacity-80 ${p.color}`}>
                {p.name}<ExternalLink size={11}/>
              </a>
            ))}
          </div>
          <div className="flex gap-2 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700">
            <Info size={13} className="flex-shrink-0 mt-0.5"/>
            Os portais bloqueiam scraping automático. Pesquisa manualmente e regista os comparáveis abaixo.
          </div>
        </div>

        {/* Add comp */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Adicionar comparável</h2>

          <div>
            <label className="label">Imóvel em avaliação *</label>
            <div className="relative max-w-md">
              <input
                className="input w-full"
                placeholder="Pesquisar por referência ou ID do bem…"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedProperty('') }}
              />
              {search && !selectedProperty && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredProperties.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-amber-600">Nenhum imóvel encontrado para "{search}".</p>
                  ) : (
                    filteredProperties.slice(0, 30).map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        onClick={() => { setSelectedProperty(p.id); setSearch(`${p.external_ref || ''} ${p.id_bien ? '· ID ' + p.id_bien : ''}`.trim()) }}
                      >
                        <span className="font-medium">{p.external_ref || '—'}</span>
                        {p.id_bien && <span className="text-gray-400"> · ID {p.id_bien}</span>}
                        <span className={`ml-2 text-xs ${p.comps_count > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {p.comps_count > 0 ? `· ${p.comps_count} comparáveis` : '· sem comparáveis'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedProperty && (
              <button className="text-xs text-gray-400 hover:text-gray-600 mt-1" onClick={() => { setSelectedProperty(''); setSearch('') }}>
                ✕ Limpar selecção
              </button>
            )}
            {selectedProp && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {selectedProp.comps_count > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={13}/> {selectedProp.comps_count} comparáveis já carregados para este imóvel</span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400"><Circle size={13}/> Ainda sem comparáveis — adiciona o primeiro abaixo</span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Portal</label>
              <select className="input" value={form.portal} onChange={e => setForm(f => ({...f, portal:e.target.value}))}>
                {['Idealista','Imovirtual','Casa Sapo','ERA','Remax','Outro'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ref. anúncio</label>
              <input className="input" placeholder="ex: 12345678" value={form.listing_ref} onChange={e => setForm(f => ({...f, listing_ref:e.target.value}))}/>
            </div>
            <div className="md:col-span-2">
              <label className="label flex items-center gap-1"><LinkIcon size={11}/> Link do anúncio</label>
              <input className="input" placeholder="https://www.idealista.pt/imovel/…" value={form.url} onChange={e => setForm(f => ({...f, url:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Tipologia</label>
              <input className="input" placeholder="T2" value={form.typology} onChange={e => setForm(f => ({...f, typology:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Área (m²)</label>
              <input type="number" className="input" value={form.area_m2} onChange={e => setForm(f => ({...f, area_m2:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Preço (€)</label>
              <input type="number" className="input" value={form.price} onChange={e => setForm(f => ({...f, price:e.target.value}))}/>
            </div>
            <div className="md:col-span-3">
              <label className="label">Notas</label>
              <input className="input" placeholder="Observações, estado de conservação…" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))}/>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" onClick={() => addComp.mutate()} disabled={!form.price || !selectedProperty || addComp.isPending}>
                {addComp.isPending ? 'A guardar…' : <><Plus size={14}/> Adicionar</>}
              </button>
            </div>
          </div>
        </div>

        {/* Comps table */}
        {selectedProperty && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Comparáveis — {selectedProp?.external_ref} {selectedProp?.id_bien ? `· ID ${selectedProp.id_bien}` : ''} {selectedProp?.municipality ? `· ${selectedProp.municipality}` : ''}
              </h2>
              {medianPricePerM2 && (
                <span className="text-sm text-gray-600">Mediana: <strong className="text-brand-600">€ {medianPricePerM2}/m²</strong></span>
              )}
            </div>
            {comps.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sem comparáveis registados para este imóvel.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Portal</th><th>Ref.</th><th>Link</th><th>Tipologia</th>
                      <th>Área</th><th>Preço</th><th>€/m²</th><th>Notas</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map((c: any) => {
                      const epm2 = c.price && c.area_m2 ? Math.round(parseFloat(c.price) / parseFloat(c.area_m2)) : null
                      return (
                        <tr key={c.id}>
                          <td className="font-medium">{c.portal}</td>
                          <td className="text-gray-500 text-xs">{c.listing_ref || '—'}</td>
                          <td>
                            {c.url ? (
                              <a href={c.url} target="_blank" rel="noopener noreferrer"
                                className="text-brand-600 hover:underline flex items-center gap-1 text-xs">
                                <ExternalLink size={11}/> Abrir
                              </a>
                            ) : '—'}
                          </td>
                          <td>{c.typology || '—'}</td>
                          <td>{c.area_m2 ? `${c.area_m2} m²` : '—'}</td>
                          <td>{c.price ? formatCurrency(c.price) : '—'}</td>
                          <td className="font-medium text-brand-600">{epm2 ? `€ ${epm2}` : '—'}</td>
                          <td className="text-gray-500 text-xs max-w-[140px] truncate">{c.notes || '—'}</td>
                          <td>
                            <button className="text-red-400 hover:text-red-600" onClick={() => delComp.mutate(c.id)}>
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
