import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { VisitBadge, BillingBadge, VISIT_STATUS_LABELS, BILLING_STATUS_LABELS } from '@/components/ui'
import { ArrowLeft, Upload, Trash2, FileSpreadsheet, MapPin, Loader2, FileText, ExternalLink, Save, Link as LinkIcon } from 'lucide-react'
import { generateAbancaReport } from '@/lib/reportGenerator'
import { useDropzone } from 'react-dropzone'
import { formatCurrency, formatDate } from '@/lib/utils'
import { geocodeAddress } from '@/lib/geocode'
import toast from 'react-hot-toast'

declare global { interface Window { L: any } }

const TABS = ['info','location','map','construction','market_chars','photos','comps','prev','notes','billing'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  info: 'Identificação', location: 'Localização', map: 'Mapa',
  construction: 'Construção', market_chars: 'Localiz./Mercado',
  photos: 'Fotos', comps: 'Comparáveis', prev: 'Aval. anterior',
  notes: 'Notas', billing: 'Faturação'
}

function useLeaflet(active: boolean, cb: () => void) {
  useEffect(() => {
    if (!active) return
    if (window.L) { cb(); return }
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css)
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = cb; document.head.appendChild(s)
  }, [active])
}

function F({ label, value, field, type = 'text', onSave, opts }: {
  label: string; value: any; field: string; type?: string
  onSave: (p: any) => void; opts?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  useEffect(() => setVal(value ?? ''), [value])

  function save() {
    const v = type === 'number' ? (val ? parseFloat(val) : null) : (val || null)
    onSave({ [field]: v })
    setEditing(false)
    toast.success('Guardado')
  }

  function setToday() {
    const today = new Date().toISOString().slice(0, 10)
    setVal(today)
    onSave({ [field]: today })
    setEditing(false)
    toast.success('Guardado')
  }

  if (opts) return (
    <div>
      <label className="label">{label}</label>
      <select className="input text-sm" value={value || ''} onChange={e => { onSave({ [field]: e.target.value || null }); toast.success('Guardado') }}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <label className="label">{label}</label>
      {editing ? (
        <div className="flex gap-1 items-center">
          <input type={type} className="input flex-1 py-1 text-sm" value={val}
            onChange={e => setVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
          {type === 'date' && (
            <button className="btn text-xs py-1 px-2 whitespace-nowrap text-brand-600 border-brand-200 hover:bg-brand-50"
              onClick={setToday}>Hoje</button>
          )}
          <button className="btn btn-primary py-1 px-2" onClick={save}><Save size={13} /></button>
          <button className="btn py-1 px-2" onClick={() => { setVal(value ?? ''); setEditing(false) }}>✕</button>
        </div>
      ) : (
        <div className="cursor-pointer px-2 py-1 rounded hover:bg-gray-100 min-h-[30px] flex items-center" onClick={() => setEditing(true)}>
          <span className={`text-sm ${val ? 'text-gray-900' : 'text-gray-300 italic'}`}>{val || 'Clica para editar'}</span>
        </div>
      )}
    </div>
  )
}

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function PropertyDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')
  const [uploading, setUploading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [generating, setGenerating] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const [pR, phR, cR] = await Promise.all([
        supabase.from('properties').select('*, portfolios(name, clients(name))').eq('id', id as string).single(),
        supabase.from('property_photos').select('*').eq('property_id', id as string).order('slot').order('sort_order'),
        supabase.from('market_comps').select('*').eq('property_id', id as string).order('created_at', { ascending: false }),
      ])
      return { property: pR.data as any, photos: (phR.data || []) as any[], comps: (cR.data || []) as any[] }
    }
  })

  const property = data?.property
  const photos = data?.photos || []
  const comps = data?.comps || []

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from('properties').update(patch).eq('id', id as string)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['property', id] }),
    onError: (e: any) => toast.error(e.message)
  })
  function save(patch: any) { update.mutate(patch) }

  async function handleGeocode() {
    if (!property) return
    setGeocoding(true)
    const addr = [property.street, property.number, property.address].filter(Boolean).join(' ')
    const result = await geocodeAddress(addr, property.postal_code, property.municipality, property.district)
    setGeocoding(false)
    if (!result) { toast.error('Morada não encontrada.'); return }
    update.mutate({ latitude: result.lat, longitude: result.lon })
    toast.success('Coordenadas guardadas')
  }

  useLeaflet(tab === 'map', () => setMapReady(true))
  useEffect(() => {
    if (!mapReady || !mapRef.current || tab !== 'map' || !property) return
    setTimeout(() => {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
      const L = window.L
      const lat = property.latitude || 39.5, lon = property.longitude || -8.0
      mapInst.current = L.map(mapRef.current).setView([lat, lon], property.latitude ? 16 : 7)
      const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar', maxZoom: 19 })
      const street    = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 })
      satellite.addTo(mapInst.current)
      L.control.layers({ 'Satélite': satellite, 'Mapa': street }, {}, { position: 'topright' }).addTo(mapInst.current)
      if (property.latitude) {
        L.marker([property.latitude, property.longitude], {
          draggable: true,
          icon: L.divIcon({ className: '', html: `<div style="width:16px;height:16px;border-radius:50%;background:#1D9E75;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
        }).addTo(mapInst.current).bindPopup(`<b>${property.external_ref || property.ref}</b>`).openPopup()
      }
    }, 150)
  }, [mapReady, tab, property?.latitude, property?.longitude])

  const onDrop = useCallback(async (files: File[]) => {
    if (!property) return
    setUploading(true)
    for (const file of files) {
      try {
        const path = `${property.id}/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('photos').upload(path, file)
        if (error) throw error
        const used = photos.map((p: any) => p.slot).filter(Boolean)
        const slot = SLOTS.find(s => !used.includes(s)) || null
        await supabase.from('property_photos').insert({ property_id: property.id, storage_path: path, original_name: file.name, size_bytes: file.size, sort_order: photos.length, slot })
      } catch (e: any) { toast.error(e.message) }
    }
    qc.invalidateQueries({ queryKey: ['property', id] })
    setUploading(false); toast.success('Fotos guardadas')
  }, [property, photos, id, qc])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxSize: 5_000_000 })

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const photo = photos.find((p: any) => p.id === photoId)
      if (photo) await supabase.storage.from('photos').remove([photo.storage_path])
      const { error } = await supabase.from('property_photos').delete().eq('id', photoId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['property', id] }); toast.success('Foto eliminada') }
  })

  async function generateReport() {
    if (!property) return
    setGenerating(true)
    try {
      const templateUrl = import.meta.env.VITE_REPORT_TEMPLATE_URL
      if (!templateUrl) throw new Error('VITE_REPORT_TEMPLATE_URL não está configurada. Carrega o template para o Supabase Storage e define a variável.')

      // Re-fetch photos frescos da BD para garantir que temos todos
      const { data: freshPhotos } = await supabase
        .from('property_photos')
        .select('*')
        .eq('property_id', property.id)
        .order('slot')
        .order('sort_order')

      const photoUrls = (freshPhotos || []).map((ph: any) => {
        const { data } = supabase.storage.from('photos').getPublicUrl(ph.storage_path)
        return { ...ph, url: data.publicUrl }
      }).filter((ph: any) => ph.url)

      await generateAbancaReport(property, photoUrls, comps, templateUrl)
      toast.success('Relatório gerado com sucesso')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  if (isLoading) return <div className="p-8 text-gray-400">A carregar…</div>
  if (!property) return <div className="p-8 text-gray-400">Imóvel não encontrado.</div>

  const tabLabels = { ...TAB_LABELS, photos: `Fotos (${photos.length})`, comps: `Comparáveis (${comps.length})` }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-white">
        <Link to="/properties" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold">{property.external_ref || property.ref}</h1>
            <VisitBadge status={property.visit_status} />
            <BillingBadge status={property.billing_status} />
            {property.latitude && <span className="text-xs text-emerald-600 flex items-center gap-1"><MapPin size={11} />Georreferenciado</span>}
          </div>
          <p className="text-sm text-gray-500">{[property.street, property.number, property.municipality, property.district].filter(Boolean).join(', ') || property.address || ''}</p>
          {property.perito_avaliador && <p className="text-xs text-gray-400 mt-0.5">Perito: {property.perito_avaliador}</p>}
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={generateReport} disabled={generating}>
          {generating ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          {generating ? 'A gerar…' : 'Gerar relatório'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-brand-400 text-brand-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {(tabLabels as any)[t]}
          </button>
        ))}
      </div>

      <div className="p-6">

        {/* TAB: Identificação */}
        {tab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Dados do processo</h3>
              <F label="Nº Relatório"        field="nr_relatorio"        value={property.nr_relatorio}        onSave={save} />
              <F label="Referência externa"  field="external_ref"        value={property.external_ref}        onSave={save} />
              <F label="Data do relatório"   field="data_relatorio"      value={property.data_relatorio}      type="date" onSave={save} />
              <F label="Tipo de serviço"     field="tipo_servico"        value={property.tipo_servico}        onSave={save}
                opts={['Avaliação','Vistoria','Portabilidade','Reavaliação','Outros']} />
              <F label="Finalidade"          field="finalidade"          value={property.finalidade}          onSave={save}
                opts={['Adjudicado sem visita interior','Adjudicado com visita interior','Garantia hipotecária','Informativo','Normas de informação financeira','Outros']} />
              <F label="Perito Avaliador"    field="perito_avaliador"    value={property.perito_avaliador}    onSave={save} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Tipo e uso</h3>
              <F label="Tipo de Bem"     field="property_type"    value={property.property_type}    onSave={save} />
              <F label="Subtipo de Bem"  field="property_subtype" value={property.property_subtype} onSave={save} />
              <F label="Uso do Bem"      field="use_type"         value={property.use_type}         onSave={save} />
              <F label="Subuso do Bem"   field="use_subtype"      value={property.use_subtype}      onSave={save} />
              <F label="Tipologia"       field="typology"         value={property.typology}         onSave={save} />
              <F label="Tipo de Prédio"  field="tipo_predio"      value={property.tipo_predio}      onSave={save}
                opts={['Urbano','Rústico','Urbano e Rustico','Prédio urbano em PH','Prédio urbano em PT','Prédio misto','Fração autonóma','Prédio rústico']} />
              <F label="Destino"         field="destino"          value={property.destino}          onSave={save}
                opts={['N/A','Arrendamento','Uso Próprio','Promoção para venda','Outros']} />
              <F label="Composição"      field="composicao_imovel" value={property.composicao_imovel} onSave={save} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Áreas</h3>
              <F label="m² (col. N — adoptada)"  field="area_m2"          value={property.area_m2}          type="number" onSave={save} />
              <F label="m² Considerada"           field="area_considerada" value={property.area_considerada} type="number" onSave={save} />
              <F label="m² Garagem"               field="area_garage_m2"   value={property.area_garage_m2}   type="number" onSave={save} />
              <F label="m² Anexo"                 field="area_annex_m2"    value={property.area_annex_m2}    type="number" onSave={save} />
              <F label="Área bruta"               field="gross_area"       value={property.gross_area}       type="number" onSave={save} />
              <F label="Área útil"                field="useful_area"      value={property.useful_area}      type="number" onSave={save} />
              <F label="Área terreno"             field="land_area"        value={property.land_area}        type="number" onSave={save} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Registo predial</h3>
              <F label="ID Registo Predial"   field="id_registo_predial"   value={property.id_registo_predial}   onSave={save} />
              <F label="ID Registo Matricial" field="id_registo_matricial" value={property.id_registo_matricial} onSave={save} />
              <F label="Fracção"              field="fracao"               value={property.fracao}               onSave={save} />
              <F label="Tipo via"             field="tipo_via"            value={property.tipo_via}            onSave={save} />
            </div>
          </div>
        )}

        {/* TAB: Localização */}
        {tab === 'location' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Endereço</h3>
              <F label="Tipo de via"   field="tipo_via"     value={property.tipo_via}    onSave={save} />
              <F label="Rua"           field="street"       value={property.street}      onSave={save} />
              <F label="Número"        field="number"       value={property.number}      onSave={save} />
              <F label="Bloco"         field="block"        value={property.block}       onSave={save} />
              <F label="Escada"        field="escada"       value={property.escada}      onSave={save} />
              <F label="Piso / Letra"  field="floor_letter" value={property.floor_letter} onSave={save} />
              <F label="Fracção"       field="fracao"       value={property.fracao}      onSave={save} />
              <F label="Lugar"         field="lugar"        value={property.lugar}       onSave={save} />
              <F label="Código Postal" field="postal_code"  value={property.postal_code} onSave={save} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Divisão administrativa</h3>
              <F label="Freguesia"  field="parish"       value={property.parish}       onSave={save} />
              <F label="Concelho"   field="municipality" value={property.municipality} onSave={save} />
              <F label="Distrito"   field="district"     value={property.district}     onSave={save} />
            </div>
          </div>
        )}

        {/* TAB: Mapa */}
        {tab === 'map' && (
          <div className="space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div><label className="label">Latitude</label>
                <input type="number" step="0.000001" className="input w-40" defaultValue={property.latitude || ''} key={`lat-${property.latitude}`}
                  onBlur={e => e.target.value && update.mutate({ latitude: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Longitude</label>
                <input type="number" step="0.000001" className="input w-40" defaultValue={property.longitude || ''} key={`lon-${property.longitude}`}
                  onBlur={e => e.target.value && update.mutate({ longitude: parseFloat(e.target.value) })} /></div>
              <button className="btn btn-primary" onClick={handleGeocode} disabled={geocoding}>
                {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                {geocoding ? 'A geocodificar…' : 'Obter coordenadas'}
              </button>
            </div>
            <div ref={mapRef} style={{ height: '460px', borderRadius: '12px', border: '0.5px solid #e5e7eb' }} />
          </div>
        )}

        {/* TAB: Fotos */}
        {tab === 'photos' && (
          <div className="space-y-5">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
              <input {...getInputProps()} />
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">{uploading ? 'A processar fotos…' : 'Arrasta fotos aqui ou clica para seleccionar'}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {SLOTS.map(slot => {
                const photo = photos.find((p: any) => p.slot === slot) || (photos[slot - 1] || null)
                if (photo) {
                  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
                  return (
                    <div key={slot} className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-[4/3] bg-gray-50">
                      <img src={publicUrl} alt={`Foto ${slot}`} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{slot}</span>
                      <button className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { if (confirm('Eliminar esta foto permanentemente?')) deletePhoto.mutate(photo.id) }}><Trash2 size={11} /></button>
                    </div>
                  )
                }
                return (
                  <div key={slot} className="rounded-xl border-2 border-dashed border-gray-200 aspect-[4/3] flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-300">
                    <span className="text-2xl font-light">{slot}</span>
                    <span className="text-xs">Foto {slot}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: Construção */}
        {tab === 'construction' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Estado e ocupação</h3>
              <F label="Estado de construção" field="estado_construcao" value={property.estado_construcao} onSave={save}
                opts={['Em construção','Em projeto','Em reabilitação','Terminado','Urbanização em curso','Urbanização terminada','N/A']} />
              <F label="Estado de conservação" field="estado_conservacao" value={property.estado_conservacao} onSave={save}
                opts={['Bom','Regular','Mau','Excelente estado','Bom estado','Necessita de manutenção/reparação','Liquidação']} />
              <F label="Estado de ocupação" field="estado_ocupacao" value={property.estado_ocupacao} onSave={save}
                opts={['Devoluto','Ocupado pelo proprietário','Arrendado','Ocupado por terceiros']} />
              <F label="Ano de construção"    field="year_built"   value={property.year_built}   type="number" onSave={save} />
              <F label="Nº Licença utilização" field="ano_licenca_utilizacao" value={property.ano_licenca_utilizacao} onSave={save} />
              <F label="Data prevista conclusão" field="data_prevista_conclusao" value={property.data_prevista_conclusao} type="date" onSave={save} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Características</h3>
              <F label="Nº quartos"             field="nr_quartos"          value={property.nr_quartos}          type="number" onSave={save} />
              <F label="Nº instalações sanitárias" field="nr_inst_sanitarias" value={property.nr_inst_sanitarias} type="number" onSave={save} />
              <F label="Nº pisos"               field="nr_pisos"            value={property.nr_pisos}            type="number" onSave={save} />
              <F label="Qualidade de construção" field="qualidade_construcao" value={property.qualidade_construcao} onSave={save}
                opts={['Muito alta','Alta','Média','Baixa','Luxo','Bons','Correntes','Maus','Modestos']} />
              <F label="Orientação solar"        field="orientacao_solar"    value={property.orientacao_solar}    onSave={save}
                opts={['Não influi no valor','Aumenta o valor','Diminui o valor']} />
              <F label="Classe energética"       field="classe_energetica"   value={property.classe_energetica}  onSave={save}
                opts={['A+','A','B','B-','C','D','E','F','G']} />
              <F label="Nº certificado energético" field="nr_certificado_energ" value={property.nr_certificado_energ} onSave={save} />
              <F label="Data emissão certificado" field="data_emissao_cert"   value={property.data_emissao_cert}  type="date" onSave={save} />
              <F label="Data validade certificado" field="data_validade_cert"  value={property.data_validade_cert} type="date" onSave={save} />
            </div>
            <div className="card md:col-span-2 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Materiais de construção</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <F label="Estrutura"         field="estrutura"      value={property.estrutura}      onSave={save} />
                <F label="Cobertura"         field="cobertura"      value={property.cobertura}      onSave={save} />
                <F label="Paredes exteriores" field="paredes_ext"   value={property.paredes_ext}    onSave={save} />
                <F label="Paredes interiores" field="paredes_int"   value={property.paredes_int}    onSave={save} />
                <F label="Pavim. zonas secas" field="pavim_secas"   value={property.pavim_secas}    onSave={save} />
                <F label="Pavim. zonas húmidas" field="pavim_humidas" value={property.pavim_humidas} onSave={save} />
                <F label="Caixilharias"       field="caixilharias"  value={property.caixilharias}   onSave={save} />
                <F label="Nível acabamento"   field="nivel_acabamento" value={property.nivel_acabamento} onSave={save}
                  opts={['Luxo','Bons','Correntes','Maus','Modestos']} />
              </div>
            </div>
          </div>
        )}

        {/* TAB: Localização/Mercado */}
        {tab === 'market_chars' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Características da localização</h3>
              <F label="Características do mercado" field="caract_mercado" value={property.caract_mercado} onSave={save}
                opts={['Residencial de 1ª Habitação','Residencial de 2ª Habitação','Rural','Mista','Industrial','Serviços']} />
              <F label="Tipo de expectativa de mercado" field="tipo_expectativa_mercado" value={property.tipo_expectativa_mercado} onSave={save}
                opts={['Positiva. Prevê-se uma valorização superior a 10% nos próximos 12 meses','Neutra. Não se prevê uma valorização/desvalorização superior a 10% nos próximos 12 meses','Negativa. Prevê-se uma desvalorização superior a 10% nos próximos 12 meses']} />
              <F label="Ocupação laboral predominante" field="ocupacao_laboral" value={property.ocupacao_laboral} onSave={save}
                opts={['Agricultura','Comércio','Industria','Serviços','Pesca','Turismo']} />
              <F label="População do concelho" field="populacao_concelho" value={property.populacao_concelho} onSave={save}
                opts={['Crescente','Decrescente','Estável']} />
              <F label="Evolução do mercado" field="evolucao_mercado" value={property.evolucao_mercado} onSave={save}
                opts={['Tendencialmente positiva','Crescente','Decrescente','Estável']} />
              <F label="Infraestruturas urbanísticas" field="infraestruturas" value={property.infraestruturas} onSave={save}
                opts={['Executadas','Em curso','Inexistentes']} />
              <F label="Enquadramento paisagístico" field="enquadramento_paisagist" value={property.enquadramento_paisagist} onSave={save}
                opts={['Frente à praia','Vistas panorâmicas','Centro da cidade','Deteriorado','Sem relevância']} />
              <F label="Zona" field="zona" value={property.zona} onSave={save}
                opts={['Residencial de 1ª Habitação','Residencial de 2ª Habitação','Rural','Mista','Industrial','Serviços']} />
            </div>
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Datas do processo</h3>
              <F label="Data do pedido"           field="data_pedido_relatorio" value={property.data_pedido_relatorio} type="date" onSave={save} />
              <F label="Data da visita"           field="data_visita"           value={property.data_visita}           type="date" onSave={save} />
              <F label="Data conclusão/entrega"   field="data_conclusao"        value={property.data_conclusao}        type="date" onSave={save} />
              <F label="Data relatório"           field="data_relatorio"        value={property.data_relatorio}        type="date" onSave={save} />
            </div>
            <div className="card space-y-3 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700">Conclusão — Valores finais</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <F label="Valor de Mercado (€)"             field="valor_mercado"            value={property.valor_mercado}            type="number" onSave={save} />
                <F label="V.V.R. — Valor Venda Rápida (€)"  field="valor_venda_rapida"       value={property.valor_venda_rapida}       type="number" onSave={save} />
                <F label="Valor de Seguro (€)"              field="valor_seguro"             value={property.valor_seguro}             type="number" onSave={save} />
                <F label="% Obra"                           field="pct_obra"                 value={property.pct_obra}                 type="number" onSave={save} />
                <F label="Valor de Mercado actual (€)"      field="valor_mercado_atual"      value={property.valor_mercado_atual}      type="number" onSave={save} />
                <F label="V.V.R. actual (€)"                field="valor_venda_rapida_atual" value={property.valor_venda_rapida_atual} type="number" onSave={save} />
              </div>
            </div>
          </div>
        )}

        {/* TAB: Avaliação anterior */}
        {tab === 'prev' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Dados da avaliação anterior</h3>
              <F label="Data avaliação anterior" field="prev_valuation_date"       value={property.prev_valuation_date}       type="date"   onSave={save} />
              <F label="Valor de mercado (€)"    field="prev_valuation_value"      value={property.prev_valuation_value}      type="number" onSave={save} />
              <F label="VVI (€)"                 field="prev_valuation_vvi"        value={property.prev_valuation_vvi}        type="number" onSave={save} />
              <F label="Método"                  field="prev_valuation_method"     value={property.prev_valuation_method}                   onSave={save} />
              <F label="Perito"                  field="prev_valuation_expert"     value={property.prev_valuation_expert}                   onSave={save} />
              <F label="Entidade"                field="prev_valuation_entity"     value={property.prev_valuation_entity}                   onSave={save} />
              <F label="Condicionalismos"        field="prev_valuation_conditions" value={property.prev_valuation_conditions}               onSave={save} />
            </div>
            {property.datatape_data && Object.keys(property.datatape_data).length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados originais da data-tape</h3>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {Object.entries(property.datatape_data as any).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-50">
                      <span className="text-gray-400 font-mono truncate max-w-[45%]">{k}</span>
                      <span className="text-gray-700 truncate max-w-[50%] text-right">{String(v ?? '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Comparáveis */}
        {tab === 'comps' && (
          <div className="space-y-4">
            <CompForm propertyId={property.id} onSaved={() => qc.invalidateQueries({ queryKey: ['property', id] })} />
            {comps.length > 0 && (
              <div className="card overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Comparáveis registados</h3>
                  {comps.length > 1 && (
                    <span className="text-sm text-gray-600">
                      Média €/m²: <strong className="text-brand-600">
                        € {mean(comps.map((c: any) => c.price && c.area_m2 ? c.price / c.area_m2 : null).filter(Boolean))}
                      </strong>
                    </span>
                  )}
                </div>
                <table className="table-base">
                  <thead><tr>
                    <th>Portal</th><th>Ref.</th><th>Link</th><th>Tipologia</th>
                    <th>Área</th><th>Preço</th><th>€/m²</th><th>Notas</th><th></th>
                  </tr></thead>
                  <tbody>
                    {comps.map((c: any) => (
                      <tr key={c.id}>
                        <td>{c.portal}</td>
                        <td className="text-gray-500">{c.listing_ref || '—'}</td>
                        <td>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={11} /> Abrir</a> : '—'}</td>
                        <td>{c.typology || '—'}</td>
                        <td>{c.area_m2 ? `${c.area_m2} m²` : '—'}</td>
                        <td>{c.price ? formatCurrency(c.price) : '—'}</td>
                        <td className="font-medium text-brand-600">
                          {c.price && c.area_m2 ? `€ ${(c.price / c.area_m2).toFixed(2).replace('.', ',')}` : '—'}
                        </td>
                        <td className="text-gray-500 text-xs max-w-[140px] truncate">{c.notes || '—'}</td>
                        <td>
                          <button className="text-red-400 hover:text-red-600" onClick={async () => {
                            if (confirm('Eliminar este comparável?')) await supabase.from('market_comps').delete().eq('id', c.id)
                            qc.invalidateQueries({ queryKey: ['property', id] })
                          }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Faturação */}
        {tab === 'billing' && (
          <div className="card space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-gray-700">Estado financeiro</h3>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={property.billing_status || ''} onChange={e => { save({ billing_status: e.target.value }); toast.success('Guardado') }}>
                <option value="">—</option>
                {Object.entries(BILLING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </div>
            <F label="Honorário (€)"  field="fee_amount"     value={property.fee_amount}     type="number" onSave={save} />
            <F label="Número PO"      field="po_number"      value={property.po_number}                    onSave={save} />
            <F label="Data PO"        field="po_date"        value={property.po_date}        type="date"   onSave={save} />
            <F label="Nº fatura"      field="invoice_number" value={property.invoice_number}              onSave={save} />
            <F label="Data fatura"    field="invoice_date"   value={property.invoice_date}   type="date"   onSave={save} />
            <F label="Data pagamento" field="payment_date"   value={property.payment_date}   type="date"   onSave={save} />
          </div>
        )}

        {/* TAB: Notas */}
        {tab === 'notes' && (
          <div className="space-y-4 max-w-2xl">
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Notas da visita</h3>
              <textarea className="input min-h-[120px] resize-y text-sm" placeholder="Observações da visita…"
                defaultValue={property.visit_notes || ''} key={`vn-${property.id}`}
                onBlur={e => update.mutate({ visit_notes: e.target.value })} />
            </div>
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Notas internas</h3>
              <textarea className="input min-h-[200px] resize-y text-sm" placeholder="Notas livres, follow-ups…"
                defaultValue={property.notes_free || ''} key={`nf-${property.id}`}
                onBlur={e => update.mutate({ notes_free: e.target.value })} />
              <p className="text-xs text-gray-400">Guardado automaticamente ao sair do campo</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function CompForm({ propertyId, onSaved }: { propertyId: string; onSaved: () => void }) {
  const [f, setF] = useState({ portal: 'Idealista', listing_ref: '', url: '', typology: '', area_m2: '', price: '', notes: '' })
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('market_comps').insert({
        property_id: propertyId, portal: f.portal,
        listing_ref: f.listing_ref || null, url: f.url || null,
        typology: f.typology || null,
        area_m2: f.area_m2 ? parseFloat(f.area_m2) : null,
        price: f.price ? parseFloat(f.price) : null,
        notes: f.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => { onSaved(); toast.success('Comparável adicionado'); setF({ portal: 'Idealista', listing_ref: '', url: '', typology: '', area_m2: '', price: '', notes: '' }) },
    onError: (e: any) => toast.error(e.message)
  })
  return (
    <div className="card">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Adicionar comparável</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="label">Portal</label>
          <select className="input" value={f.portal} onChange={e => setF(p => ({ ...p, portal: e.target.value }))}>
            {['Idealista', 'Imovirtual', 'Casa Sapo', 'ERA', 'Remax', 'Outro'].map(v => <option key={v}>{v}</option>)}
          </select></div>
        <div><label className="label">Ref. anúncio</label><input className="input" value={f.listing_ref} onChange={e => setF(p => ({ ...p, listing_ref: e.target.value }))} /></div>
        <div className="md:col-span-2"><label className="label flex items-center gap-1"><LinkIcon size={11} /> Link</label>
          <input className="input" placeholder="https://…" value={f.url} onChange={e => setF(p => ({ ...p, url: e.target.value }))} /></div>
        <div><label className="label">Tipologia</label><input className="input" placeholder="T2" value={f.typology} onChange={e => setF(p => ({ ...p, typology: e.target.value }))} /></div>
        <div><label className="label">Área (m²)</label><input type="number" className="input" value={f.area_m2} onChange={e => setF(p => ({ ...p, area_m2: e.target.value }))} /></div>
        <div><label className="label">Preço (€)</label><input type="number" className="input" value={f.price} onChange={e => setF(p => ({ ...p, price: e.target.value }))} /></div>
        <div className="md:col-span-3"><label className="label">Notas</label><input className="input" placeholder="Observações…" value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full" onClick={() => save.mutate()} disabled={!f.price || save.isPending}>
            {save.isPending ? 'A guardar…' : '+ Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function mean(arr: number[]) {
  if (!arr.length) return '—'
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return avg.toFixed(2).replace('.', ',')
}
