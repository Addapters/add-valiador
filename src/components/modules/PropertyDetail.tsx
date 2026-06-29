import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { VisitBadge, BillingBadge, VISIT_STATUS_LABELS, BILLING_STATUS_LABELS } from '@/components/ui'
import { ArrowLeft, Upload, Trash2, FileSpreadsheet, MapPin, Loader2, FileText, ExternalLink, Save, Link as LinkIcon, File } from 'lucide-react'
import { generateAbancaReport } from '@/lib/reportGenerator'
import { useDropzone } from 'react-dropzone'
import { formatCurrency, formatDate } from '@/lib/utils'
import { geocodeAddress } from '@/lib/geocode'
import toast from 'react-hot-toast'

declare global { interface Window { L: any } }

const TABS = [
  'sec1','sec2','sec3','sec4','sec5','sec6','sec7','residual','obras','sec8',
  'sec9','sec10','sec11',
  'sec13','sec14','sec15','sec16','sec17','sec18'
] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  sec1:'Identificação', sec2:'Morada', sec3:'Descrição',
  sec4:'Localização', sec5:'Construção', sec6:'Áreas',
  sec7:'Métodos', residual:'Método Residual', obras:'Obras de Beneficiação',
  sec8:'Documentos', sec9:'Condicionalismos',
  sec10:'Advertências', sec11:'Conclusão',
  sec13:'Certificação', sec14:'Faturação',
  sec15:'Fotos', sec16:'Comparáveis', sec17:'Aval. anterior', sec18:'Notas',
}

function useLeaflet(active: boolean, cb: () => void) {
  useEffect(() => {
    if (!active) return
    if (window.L) { cb(); return }
    const css = document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css)
    const s = document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload=cb; document.head.appendChild(s)
  }, [active])
}

// ── Auto-save field component ──────────────────────────────────────────────
function F({ label, value, field, type='text', onSave, opts, span, textarea, half }: {
  label:string; value:any; field:string; type?:string
  onSave:(p:any)=>void; opts?:string[]; span?:boolean; textarea?:boolean; half?:boolean
}) {
  const [val, setVal] = useState(value ?? '')
  const [dirty, setDirty] = useState(false)
  const timerRef = useRef<any>(null)
  useEffect(() => { setVal(value ?? ''); setDirty(false) }, [value])

  function handleChange(newVal: string) {
    setVal(newVal); setDirty(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const v = type === 'number' ? (newVal ? parseFloat(newVal) : null) : (newVal || null)
      onSave({ [field]: v })
      setDirty(false)
    }, 800)
  }

  function saveNow() {
    if (timerRef.current) clearTimeout(timerRef.current)
    const v = type === 'number' ? (val ? parseFloat(val) : null) : (val || null)
    onSave({ [field]: v }); setDirty(false)
  }

  function setToday() {
    const today = new Date().toISOString().slice(0,10)
    handleChange(today)
    if (timerRef.current) clearTimeout(timerRef.current)
    onSave({ [field]: today }); setDirty(false)
  }

  const cls = `col-span-${span ? 2 : half ? 1 : 1}`

  if (opts) return (
    <div className={cls}>
      <label className="label">{label}</label>
      <select className="input text-sm w-full" value={value||''} onChange={e => { onSave({[field]:e.target.value||null}) }}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className={cls}>
      <div className="flex items-center justify-between mb-0.5">
        <label className="label mb-0">{label}</label>
        <div className="flex items-center gap-1">
          {type==='date' && <button className="text-[10px] text-brand-500 hover:text-brand-700 px-1" onClick={setToday}>Hoje</button>}
          {dirty && <button className="text-[10px] text-emerald-500 hover:text-emerald-700 px-1" onClick={saveNow}><Save size={10}/></button>}
        </div>
      </div>
      {textarea
        ? <textarea className="input text-sm w-full min-h-[80px]" value={val} onChange={e => handleChange(e.target.value)}/>
        : <input type={type} className="input text-sm w-full" value={val} onChange={e => handleChange(e.target.value)}
            onBlur={saveNow}/>
      }
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">{children}</div>
    </div>
  )
}

// Traduz chaves da datatape de espanhol/inglês para português
function translateDatatapeKey(key: string): string {
  const map: Record<string, string> = {
    'ID_BIEN':                    'ID do Bem',
    'NUC_RIESGO':                 'NUC Risco',
    'TIPO_BIEN':                  'Tipo de Bem',
    'SUBTIPO_BIEN':               'Subtipo de Bem',
    'USO_BIEN':                   'Uso do Bem',
    'SUBUSO_BIEN':                'Subuso do Bem',
    'ESTADO_BIEN':                'Estado do Bem',
    'TIPO_REEVALUACION':          'Tipo de Reavaliação',
    'SUPERFICIE_ADOPTADA_FINCA':  'Área Adoptada (Finca)',
    'SUPERFICIE_ADOPTADA_GARAJE': 'Área Adoptada (Garagem)',
    'SUPERFICIE_ADOPTADA_TRASTERO':'Área Adoptada (Arrumos)',
    'TIPO_VIA':                   'Tipo de Via',
    'CALLE':                      'Rua',
    'NUMERO':                     'Número',
    'BLOQUE':                     'Bloco',
    'ESCALERA':                   'Escada',
    'PISO':                       'Piso',
    'PUERTA':                     'Porta',
    'CODIGO_POSTAL':              'Código Postal',
    'NOMBRE_MUNICIPIO':           'Município',
    'NOMBRE_PROVINCIA':           'Província',
    'NOMBRE_DISTRITO':            'Distrito',
    'NOMBRE_CONCELHO':            'Concelho',
    'REFERENCIA':                 'Referência',
    'FECHA_SOLICITUD':            'Data do Pedido',
    'FECHA_TASACION':             'Data da Avaliação',
    'TASACION':                   'Valor da Avaliação',
    'EMPRESA_TASADORA':           'Empresa Avaliadora',
    'AVALIADORA':                 'Perito Avaliador',
    'FRACCION_FISCAL':            'Fracção Fiscal',
    'NUMERO_REGISTRO_PREDIAL':    'Nº Registo Predial',
    'ARTIGO_MATRICIAL_FISCAL':    'Artigo Matricial',
    'AÑO_CONSTRUCCION':           'Ano de Construção',
    'ESTADO_CONSERVACION':        'Estado de Conservação',
    'NOMBRE_LOCALIDAD':           'Localidade',
    'NOMBRE_PAIS':                'País',
    'LATITUD':                    'Latitude',
    'LONGITUD':                   'Longitude',
  }
  return map[key.toUpperCase()] || key
}

const SLOTS = [1,2,3,4,5,6,7,8]

export default function PropertyDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('sec1')
  const [uploading, setUploading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [generating, setGenerating] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const [pR, phR, cR, docR] = await Promise.all([
        supabase.from('properties').select('*, portfolios(name, clients(name))').eq('id', id as string).single(),
        supabase.from('property_photos').select('*').eq('property_id', id as string).order('slot').order('sort_order'),
        supabase.from('market_comps').select('*, selected, chauvenet_rejected, uso, tipologia, ano_estado').eq('property_id', id as string).order('created_at', { ascending: false }),
        supabase.from('property_documents').select('*').eq('property_id', id as string).order('created_at', { ascending: false }),
      ])
      return {
        property: pR.data as any,
        photos: (phR.data||[]) as any[],
        comps: (cR.data||[]) as any[],
        documents: (docR.data||[]) as any[],
      }
    }
  })

  const property = data?.property
  const photos = data?.photos || []
  const comps = data?.comps || []
  const documents = data?.documents || []

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

  // Carrega Leaflet sempre (necessário para captura do mapa no relatório)
  useLeaflet(true, () => setMapReady(true))
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!mapReady || !mapRef.current || !property) return

    if (mapInst.current) {
      if (tab === 'sec2') setTimeout(() => mapInst.current?.invalidateSize(), 100)
      // Actualiza marcador se coordenadas mudaram
      if (property.latitude && mapInst.current) {
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = window.L.circleMarker(
          [property.latitude, property.longitude],
          { radius: 8, fillColor: '#1D9E75', color: 'white', weight: 2, opacity: 1, fillOpacity: 1 }
        ).addTo(mapInst.current)
        mapInst.current.setView([property.latitude, property.longitude], 16)
      }
      return
    }

    setTimeout(() => {
      const L = window.L
      const lat = property.latitude||39.5, lon = property.longitude||-8.0
      mapInst.current = L.map(mapRef.current).setView([lat,lon], property.latitude?16:7)
      const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution:'© Esri', maxZoom:19 })
      const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:19 })
      satellite.addTo(mapInst.current)
      L.control.layers({'Satélite':satellite,'Mapa':street},{},{position:'topright'}).addTo(mapInst.current)
      if (property.latitude) {
        markerRef.current = L.circleMarker([property.latitude, property.longitude], {
          radius: 8, fillColor: '#1D9E75', color: 'white', weight: 2, opacity: 1, fillOpacity: 1,
        }).addTo(mapInst.current)
      }
    }, 150)
  }, [mapReady, property?.id, property?.latitude, property?.longitude, tab])

  const onDrop = useCallback(async (files: globalThis.File[]) => {
    if (!property) return
    setUploading(true)
    for (const file of files) {
      try {
        const path = `${property.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, file)
        if (upErr) throw upErr
        // Re-fetch used slots fresh from DB to avoid duplicates
        const { data: existingPhotos } = await supabase
          .from('property_photos').select('slot').eq('property_id', property.id)
        const used = (existingPhotos||[]).map((p: any) => p.slot).filter(Boolean)
        const slot = SLOTS.find(s => !used.includes(s)) || null
        const { error: insErr } = await supabase.from('property_photos').insert({
          property_id: property.id, storage_path: path,
          original_name: file.name, size_bytes: file.size,
          sort_order: used.length, slot
        })
        if (insErr) throw insErr
      } catch (e: any) { toast.error(e.message) }
    }
    qc.invalidateQueries({ queryKey: ['property', id] })
    setUploading(false); toast.success('Fotos guardadas')
  }, [property, id, qc])
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

  async function uploadDocument(file: globalThis.File) {
    if (!property) return
    setUploadingDoc(true)
    try {
      const path = `${property.id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('prev-reports').upload(path, file)
      if (error) throw error
      await supabase.from('property_documents').insert({
        property_id: property.id,
        storage_path: path,
        name: file.name,
        size_bytes: file.size,
      })
      qc.invalidateQueries({ queryKey: ['property', id] })
      toast.success('Documento carregado')
    } catch (e: any) { toast.error(e.message) }
    setUploadingDoc(false)
  }

  async function deleteDocument(doc: any) {
    if (!confirm(`Eliminar "${doc.name}"?`)) return
    await supabase.storage.from('prev-reports').remove([doc.storage_path])
    await supabase.from('property_documents').delete().eq('id', doc.id)
    qc.invalidateQueries({ queryKey: ['property', id] })
    toast.success('Documento eliminado')
  }

  async function generateReport() {
    if (!property) return
    setGenerating(true)
    try {
      // Vai buscar irmãos primeiro para decidir qual template usar
      let siblings: any[] = []
      if (property.external_ref) {
        const { data: siblingsData } = await supabase
          .from('properties')
          .select('*')
          .eq('external_ref', property.external_ref)
          .neq('id', property.id)
          .order('id_bien')
        siblings = siblingsData || []
      }

      const totalBens = 1 + siblings.length

      // Selecciona template: multi para 4+ bens, standard para 1-3
      const standardUrl = import.meta.env.VITE_REPORT_TEMPLATE_URL
      const multiUrl    = import.meta.env.VITE_REPORT_TEMPLATE_MULTI_URL || standardUrl
      const templateUrl = totalBens >= 4 ? multiUrl : standardUrl

      if (!templateUrl) throw new Error('VITE_REPORT_TEMPLATE_URL não está configurada.')

      let mapImageBlob: Blob | null = null
      if (property.latitude && property.longitude) {
        try {
          const lat = property.latitude
          const lon = property.longitude

          const canvas = document.createElement('canvas')
          canvas.width = 800
          canvas.height = 400
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Fundo tipo mapa (cinzento claro)
            ctx.fillStyle = '#f2efe9'
            ctx.fillRect(0, 0, 800, 400)
            // Grid subtil
            ctx.strokeStyle = '#e0ddd6'
            ctx.lineWidth = 1
            for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,400); ctx.stroke() }
            for (let y = 0; y < 400; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(800,y); ctx.stroke() }
            // Marcador no centro
            const cx = 400, cy = 200
            ctx.shadowColor = 'rgba(0,0,0,0.35)'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.arc(cx, cy, 18, 0, 2 * Math.PI)
            ctx.fillStyle = 'white'
            ctx.fill()
            ctx.shadowBlur = 0
            ctx.beginPath()
            ctx.arc(cx, cy, 13, 0, 2 * Math.PI)
            ctx.fillStyle = '#1D9E75'
            ctx.fill()
          }
          mapImageBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
        } catch { /* continua sem mapa */ }
      }

      const { data: freshPhotos } = await supabase.from('property_photos').select('*').eq('property_id', property.id).order('slot').order('sort_order')
      const photoUrls = (freshPhotos||[]).map((ph: any) => {
        const { data } = supabase.storage.from('photos').getPublicUrl(ph.storage_path)
        return { ...ph, url: data.publicUrl }
      }).filter((ph: any) => ph.url)

      // siblings já foi buscado acima para selecção do template
      // Para 4+ bens usa todos; para 1-3 usa os primeiros 2
      const siblingsToUse = totalBens >= 4 ? siblings : siblings.slice(0, 2)

      await generateAbancaReport(property, photoUrls, comps, templateUrl, mapImageBlob, siblingsToUse)
      toast.success('Relatório gerado — verifica o teu computador e a tab 13. Certificação para o link online')
      qc.invalidateQueries({ queryKey: ['property', id] })
    } catch (e: any) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  // Datatape fields to show in Aval. Anterior tab
  const datatapeFields: [string, string][] = useMemo(() => {
    if (!property?.datatape_data) return []
    const skip = new Set(['__rowNum__','datatape_data'])
    return Object.entries(property.datatape_data)
      .filter(([k,v]) => !skip.has(k) && v !== null && v !== undefined && String(v).trim() !== '')
      .map(([k,v]) => [k, String(v)]) as [string,string][]
  }, [property?.datatape_data])

  if (isLoading) return <div className="p-8 text-gray-400">A carregar…</div>
  if (!property) return <div className="p-8 text-gray-400">Imóvel não encontrado.</div>

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Header fixo ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 z-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/properties" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold">{property.external_ref||property.ref}</h1>
                {property.id_bien && <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">ID: {property.id_bien}</span>}
                <VisitBadge status={property.visit_status}/>
                {(property.data_relatorio || property.nr_relatorio || property.perito_avaliador || property.valor_mercado || property.metodo_avaliacao)
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Em edição</span>
                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">Por iniciar</span>
                }
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs text-gray-400 truncate">{[property.property_type, property.municipality, property.district].filter(Boolean).join(' · ')}</p>
                <button className="btn btn-primary flex items-center gap-1.5 whitespace-nowrap text-xs py-1" onClick={generateReport} disabled={generating}>
                  {generating ? <Loader2 size={12} className="animate-spin"/> : <FileSpreadsheet size={12}/>}
                  Gerar relatório
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs — scroll horizontal */}
        <div className="flex gap-0 mt-3 overflow-x-auto pb-px border-b border-gray-100">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                ${tab===t ? 'border-brand-400 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo com scroll próprio ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full">

        {/* SEC 1 ── Identificação do Pedido */}
        {tab==='sec1' && (<>
          <Section title="Identificação do Pedido">
            <F label="Data do Relatório"          field="data_relatorio"           value={property.data_relatorio}           type="date"   onSave={save}/>
            <F label="Relatório válido até"        field="data_validade_relatorio"  value={property.data_validade_relatorio}  type="date"   onSave={save}/>
            <F label="Relatório n.º"              field="nr_relatorio"             value={property.nr_relatorio}                           onSave={save}/>
            <F label="Banco / Entidade"           field="banco"                    value={property.banco}                                  onSave={save}/>
            <F label="Tipo de Relatório"          field="tipo_relatorio"           value={property.tipo_relatorio}
              opts={['Avaliação','Reavaliação','Vistoria','Portabilidade','Correção de erros']} onSave={save}/>
            <F label="Finalidade"                 field="finalidade"               value={property.finalidade}
              opts={['Adjudicado com visita interior','Adjudicado sem visita interior','Garantia hipotecária','Outros fins']} onSave={save}/>
            <F label="Ref. Avaliador"             field="external_ref"             value={property.external_ref}                           onSave={save}/>
            <F label="ID do Bem"                  field="id_bien"                  value={property.id_bien}                                onSave={save}/>
            <F label="Tipo de Serviço"            field="tipo_servico"             value={property.tipo_servico}
              opts={['Avaliação','Vistoria','Portabilidade','Reavaliação']} onSave={save}/>
            <F label="NUC Risco"                  field="nuc_risco"                value={property.nuc_risco}                              onSave={save}/>
          </Section>
        </>)}

        {/* Mapa — div sempre no DOM para captura pelo relatório */}
        <div style={{ display: tab === 'sec2' ? 'block' : 'none' }}>
          <Section title="Morada">
            <F label="Tipo de Via"     field="tipo_via"     value={property.tipo_via}
              opts={['Rua','Avenida','Praça','Largo','Estrada','Travessa','Beco','Calçada','Caminho','Alameda','Outro']} onSave={save}/>
            <F label="Nome da Via"     field="street"       value={property.street}       span  onSave={save}/>
            <F label="Portal / N.º"   field="number"       value={property.number}             onSave={save}/>
            <F label="Bloco"           field="block"        value={property.block}              onSave={save}/>
            <F label="Escada"          field="escada"       value={property.escada}             onSave={save}/>
            <F label="Andar / Piso"   field="floor_letter" value={property.floor_letter}        onSave={save}/>
            <F label="Porta / Fração" field="fracao"       value={property.fracao}             onSave={save}/>
            <F label="Complemento"    field="lugar"        value={property.lugar}              onSave={save}/>
            <F label="Código Postal"  field="postal_code"  value={property.postal_code}        onSave={save}/>
            <F label="Freguesia"      field="parish"       value={property.parish}             onSave={save}/>
            <F label="Concelho"       field="municipality" value={property.municipality}        onSave={save}/>
            <F label="Distrito"       field="district"     value={property.district}           onSave={save}/>
          </Section>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Localização no Mapa</h3>
              <div className="flex items-center gap-3">
                <div className="flex gap-3">
                  <F label="Latitude"  field="latitude"  value={property.latitude}  type="number" onSave={save}/>
                  <F label="Longitude" field="longitude" value={property.longitude} type="number" onSave={save}/>
                </div>
                <button className="btn flex items-center gap-1.5 text-xs whitespace-nowrap" onClick={handleGeocode} disabled={geocoding}>
                  {geocoding ? <Loader2 size={12} className="animate-spin"/> : <MapPin size={12}/>}
                  Obter coordenadas
                </button>
              </div>
            </div>
            <div ref={mapRef} style={{ height:'300px', borderRadius:'10px', border:'0.5px solid #e5e7eb' }}/>
          </div>
        </div>

        {/* SEC 3 ── Descrição do Imóvel */}
        {tab==='sec3' && (<>
          <Section title="Tipo e Estado">
            <F label="Tipo de Bem"           field="property_type"      value={property.property_type}
              opts={['Apartamento','Moradia','Moradias unifamiliares','Moradias em banda','Habitação','Loja','Comércio','Escritórios','Armazém','Naves industriais','Garagem','Arrumos','Outros Anexos','Terreno rústico','Terreno urbano','Edifício']} onSave={save}/>
            <F label="Subtipo de Bem"        field="property_subtype"   value={property.property_subtype}   onSave={save}/>
            <F label="Uso"                   field="use_type"           value={property.use_type}
              opts={['Residencial','Comercial','Industrial','Serviços','Misto','Rústico']} onSave={save}/>
            <F label="Subuso"                field="use_subtype"        value={property.use_subtype}        onSave={save}/>
            <F label="Destino"               field="destino"            value={property.destino}
              opts={['1ª residência','2ª residência','VPO / Livre','Arrendamento']} onSave={save}/>
            <F label="Tipo de Prédio"        field="tipo_predio"        value={property.tipo_predio}
              opts={['Prédio urbano','Prédio rústico','Prédio misto']} onSave={save}/>
            <F label="Estado de Construção"  field="estado_construcao"  value={property.estado_construcao}
              opts={['Em projecto','Em construção','Em reabilitação','Terminado','Hipótese terminado']} onSave={save}/>
            <F label="Estado de Conservação" field="estado_conservacao" value={property.estado_conservacao}
              opts={['Muito Bom','Bom','Normal','Deficiente','Muito Deficiente','Ruinoso']} onSave={save}/>
            <F label="Estado de Ocupação"    field="estado_ocupacao"    value={property.estado_ocupacao}
              opts={['Livre','Ocupado pelo proprietário','Arrendado','Ocupado por terceiros']} onSave={save}/>
            <F label="% Obra Executada"      field="pct_obra"           value={property.pct_obra}           type="number" onSave={save}/>
            <F label="Tipologia"             field="typology"           value={property.typology}           onSave={save}/>
            <F label="Imóvel Singular"       field="imovel_singular"    value={property.imovel_singular}
              opts={['Sim','Não']} onSave={save}/>
          </Section>

          <div className="mb-4">
            <label className="label">Composição / Descrição do Imóvel</label>
            <F label="" field="composicao_imovel" value={property.composicao_imovel} textarea span onSave={save}/>
          </div>

          <Section title="Conservatória de Registo Predial">
            <F label="N.º Conservatória"     field="nr_conservatoria"     value={property.nr_conservatoria}                onSave={save}/>
            <F label="Nome da Conservatória" field="nome_conservatoria"   value={property.nome_conservatoria}              onSave={save}/>
            <F label="N.º Registo Predial"   field="id_registo_predial"   value={property.id_registo_predial}              onSave={save}/>
            <F label="Freguesia"             field="parish"               value={property.parish}                          onSave={save}/>
            <F label="Nome do Proprietário"  field="nome_proprietario"    value={property.nome_proprietario}               onSave={save}/>
          </Section>

          <Section title="Caderneta Predial das Finanças">
            <F label="N.º Artigo"            field="id_registo_matricial" value={property.id_registo_matricial}            onSave={save}/>
            <F label="Fracção"               field="fracao"               value={property.fracao}                          onSave={save}/>
            <F label="Tipo"                  field="tipo_caderneta"       value={property.tipo_caderneta}                  onSave={save}/>
            <F label="Secção"                field="seccao_caderneta"     value={property.seccao_caderneta}                onSave={save}/>
            <F label="Ano Matriz"            field="ano_matriz"           value={property.ano_matriz}           type="number" onSave={save}/>
            <F label="Valor Patrimonial (€)" field="valor_patrimonial"    value={property.valor_patrimonial}    type="number" onSave={save}/>
            <F label="Cod-Freg."             field="cod_freg"             value={property.cod_freg}                        onSave={save}/>
            <F label="Freguesia das Finanças" field="freguesia_financas"  value={property.freguesia_financas}              onSave={save}/>
          </Section>
        </>)}

        {/* SEC 4 ── Características da Localização */}
        {tab==='sec4' && (<>
          <div className="mb-4">
            <label className="label">Características do Mercado</label>
            <F label="" field="caract_mercado" value={property.caract_mercado} textarea span onSave={save}/>
          </div>
          <Section title="Enquadramento no Mercado">
            <F label="Tipo de expectativa de mercado"    field="tipo_expectativa_mercado" value={property.tipo_expectativa_mercado}
              opts={['Muito positiva','Positiva','Estável','Negativa','Muito negativa']} onSave={save}/>
            <F label="Ocupação laboral predominante"     field="ocupacao_laboral"         value={property.ocupacao_laboral}
              opts={['Muito alta','Alta','Média','Baixa','Muito baixa']} onSave={save}/>
            <F label="População do Concelho"             field="populacao_concelho"       value={property.populacao_concelho}       onSave={save}/>
            <F label="Evolução do Mercado"               field="evolucao_mercado"         value={property.evolucao_mercado}
              opts={['Tendencialmente positiva','Estável','Tendencialmente negativa']} onSave={save}/>
          </Section>
        </>)}

        {/* SEC 5 ── Características da Construção */}
        {tab==='sec5' && (<>
          <Section title="Construção">
            <F label="N.º Quartos"                field="nr_quartos"              value={property.nr_quartos}              type="number" onSave={save}/>
            <F label="N.º Casas de Banho"         field="nr_inst_sanitarias"      value={property.nr_inst_sanitarias}      type="number" onSave={save}/>
            <F label="N.º Pisos"                  field="nr_pisos"                value={property.nr_pisos}                type="number" onSave={save}/>
            <F label="Qualidade de Construção"    field="qualidade_construcao"    value={property.qualidade_construcao}
              opts={['Muito boa','Boa','Média','Baixa','Muito baixa']} onSave={save}/>
            <F label="Orientação Solar"           field="orientacao_solar"        value={property.orientacao_solar}
              opts={['Norte','Sul','Este','Oeste','Norte/Sul','Este/Oeste','Não influi no valor']} onSave={save}/>
            <F label="Categorização"              field="categorizacao"           value={property.categorizacao}           onSave={save}/>
            <F label="Tipo de Reparação"          field="tipo_reparacao"          value={property.tipo_reparacao}
              opts={['Conservação','Reabilitação','Remodelação','Ampliação','Construção nova']} onSave={save}/>
          </Section>
          <Section title="Certificado Energético">
            <F label="N.º Certificado Energético" field="nr_certificado_energ"   value={property.nr_certificado_energ}              onSave={save}/>
            <F label="Classe Energética"           field="classe_energetica"      value={property.classe_energetica}
              opts={['A+','A','B','B-','C','D','E','F','Isento','Em curso']} onSave={save}/>
            <F label="Data Emissão"                field="data_emissao_cert"      value={property.data_emissao_cert}      type="date" onSave={save}/>
            <F label="Data Validade"               field="data_validade_cert"     value={property.data_validade_cert}     type="date" onSave={save}/>
            <F label="Nome PQ"                     field="nome_pq"                value={property.nome_pq}                           onSave={save}/>
            <F label="N.º PQ"                      field="nr_pq"                  value={property.nr_pq}                             onSave={save}/>
          </Section>
          <Section title="Licença e Construção">
            <F label="N.º Licença de Utilização"  field="nr_licenca_utilizacao"  value={property.nr_licenca_utilizacao}             onSave={save}/>
            <F label="Data Emissão"                field="data_licenca_construcao" value={property.data_licenca_construcao} type="date" onSave={save}/>
            <F label="Ano Construção"              field="year_built"             value={property.year_built}             type="number" onSave={save}/>
            <F label="Data Prevista Conclusão"     field="data_conclusao_obras"   value={property.data_conclusao_obras}   type="date" onSave={save}/>
            <F label="Obra Parada"                 field="obra_parada"            value={property.obra_parada}
              opts={['Sim','Não']} onSave={save}/>
          </Section>
        </>)}

        {/* SEC 6 ── Áreas do Imóvel */}
        {tab==='sec6' && (<>
          <Section title="Áreas">
            <F label="Área Considerada (m²)"              field="area_considerada" value={property.area_considerada} type="number" onSave={save}/>
            <F label="Área do Terreno (m²)"               field="land_area"        value={property.land_area}        type="number" onSave={save}/>
            <F label="ABP — Área Bruta Privativa (m²)"    field="gross_area"       value={property.gross_area}       type="number" onSave={save}/>
            <F label="ABD — Área Bruta Dependente (m²)"   field="area_annex_m2"    value={property.area_annex_m2}    type="number" onSave={save}/>
          </Section>
          <div className="mb-4">
            <label className="label">Observações sobre áreas</label>
            <F label="" field="observacoes_areas" value={property.observacoes_areas} textarea span onSave={save}/>
          </div>
        </>)}

        {/* SEC 7 ── Métodos de Avaliação */}
        {tab==='sec7' && (<>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">Método Comparativo de Mercado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Descrição"                        field="metodo_comp_descricao"   value={property.metodo_comp_descricao}   onSave={save}/>
              <F label="Área (m²)"                       field="metodo_comp_area"        value={property.metodo_comp_area}        type="number" onSave={save}/>
              <F label="Valor (€/m²)"                    field="metodo_comp_valor_m2"    value={property.metodo_comp_valor_m2}    type="number" onSave={save}/>
              <F label="Valor Total (€)"                 field="metodo_comp_valor_total" value={property.metodo_comp_valor_total} type="number" onSave={save}/>
              <F label="Valor Comparativo Ajustado (€)"  field="valor_comparativo"       value={property.valor_comparativo}       type="number" onSave={save}/>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">Valor de Renda Efetiva</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Descrição"           field="renda_ef_descricao"   value={property.renda_ef_descricao}              onSave={save}/>
              <F label="Área (m²)"           field="renda_ef_area"        value={property.renda_ef_area}        type="number" onSave={save}/>
              <F label="Renda (€/m²)"        field="renda_ef_valor_m2"    value={property.renda_ef_valor_m2}    type="number" onSave={save}/>
              <F label="Renda Mensal (€)"    field="renda_ef_mensal"      value={property.renda_ef_mensal}      type="number" onSave={save}/>
              <F label="Taxa Capit. (%)"     field="renda_ef_taxa"        value={property.renda_ef_taxa}        type="number" onSave={save}/>
              <F label="Valor Total (€)"     field="renda_ef_total"       value={property.renda_ef_total}       type="number" onSave={save}/>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">Valor de Renda Potencial</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Descrição"           field="renda_pot_descricao"  value={property.renda_pot_descricao}              onSave={save}/>
              <F label="Área (m²)"           field="renda_pot_area"       value={property.renda_pot_area}       type="number" onSave={save}/>
              <F label="Renda (€/m²)"        field="renda_pot_valor_m2"   value={property.renda_pot_valor_m2}   type="number" onSave={save}/>
              <F label="Renda Mensal (€)"    field="renda_pot_mensal"     value={property.renda_pot_mensal}     type="number" onSave={save}/>
              <F label="Taxa Capit. (%)"     field="renda_pot_taxa"       value={property.renda_pot_taxa}       type="number" onSave={save}/>
              <F label="Valor Total (€)"     field="renda_pot_total"      value={property.renda_pot_total}      type="number" onSave={save}/>
            </div>
          </div>
          <div className="mb-6">
            <label className="label">Justificação da escolha dos Métodos de Avaliação</label>
            <F label="" field="justificacao_metodo" value={property.justificacao_metodo} textarea span onSave={save}/>
          </div>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">9. Método do Custo de Construção ou Reposição — Estado Terminado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Custo do Terreno (€/m²)"         field="custo_terreno_m2"       value={property.custo_terreno_m2}       type="number" onSave={save}/>
              <F label="Custo de Construção (€/m²)"      field="custo_construcao_m2"    value={property.custo_construcao_m2}    type="number" onSave={save}/>
              <F label="Custos Indirectos (%)"           field="custos_indiretos_pct"   value={property.custos_indiretos_pct}   type="number" onSave={save}/>
              <F label="Margem do Promotor (%)"          field="margem_promotor_pct"    value={property.margem_promotor_pct}    type="number" onSave={save}/>
              <F label="Depreciação (%)"                 field="depreciacao_pct"        value={property.depreciacao_pct}        type="number" onSave={save}/>
              <F label="Área (m²)"                       field="custo_area"             value={property.custo_area}             type="number" onSave={save}/>
              <F label="C. Terreno (€)"                  field="custo_terreno_total"    value={property.custo_terreno_total}    type="number" onSave={save}/>
              <F label="C. Const. CC (€)"                field="custo_construcao_total" value={property.custo_construcao_total} type="number" onSave={save}/>
              <F label="C. Repos. Bruto (€)"             field="custo_repos_bruto"      value={property.custo_repos_bruto}      type="number" onSave={save}/>
              <F label="Depreciação (€)"                 field="depreciacao_valor"      value={property.depreciacao_valor}      type="number" onSave={save}/>
              <F label="C. Repos. Líquido (€)"           field="custo_repos_liquido"    value={property.custo_repos_liquido}    type="number" onSave={save}/>
              <F label="Valor de Seguro CC+CI (€)"       field="valor_seguro_cc_ci"     value={property.valor_seguro_cc_ci}     type="number" onSave={save}/>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">9. Método do Custo — Estado Em Projecto / Em Construção</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Custo do Terreno (€/m²)"         field="hec_custo_terreno_m2"       value={property.hec_custo_terreno_m2}       type="number" onSave={save}/>
              <F label="Custo de Construção (€/m²)"      field="hec_custo_construcao_m2"    value={property.hec_custo_construcao_m2}    type="number" onSave={save}/>
              <F label="Custos Indirectos (%)"           field="hec_custos_indiretos_pct"   value={property.hec_custos_indiretos_pct}   type="number" onSave={save}/>
              <F label="Margem do Promotor (%)"          field="hec_margem_promotor_pct"    value={property.hec_margem_promotor_pct}    type="number" onSave={save}/>
              <F label="% Obra"                          field="pct_obra"                   value={property.pct_obra}                   type="number" onSave={save}/>
              <F label="C. Repos. Bruto HEC (€)"        field="hec_custo_repos_bruto"      value={property.hec_custo_repos_bruto}      type="number" onSave={save}/>
              <F label="Valor Seguro HEC (€)"            field="hec_valor_seguro"           value={property.hec_valor_seguro}           type="number" onSave={save}/>
              <F label="C. Repos. Bruto Actual (€)"     field="hec_custo_repos_actual"     value={property.hec_custo_repos_actual}     type="number" onSave={save}/>
              <F label="Valor Investimento Pendente (€)" field="hec_invest_pendente"        value={property.hec_invest_pendente}        type="number" onSave={save}/>
            </div>
            <div className="mt-3">
              <label className="label">Justificação da depreciação e outros parâmetros</label>
              <F label="" field="justificacao_depreciacao" value={property.justificacao_depreciacao} textarea span onSave={save}/>
            </div>
          </div>
        </>)}

        {/* SEC 8 ── Documentos Entregues */}
        {tab==='sec8' && (<>
          <Section title="Documentos para Avaliação">
            {['Caderneta Predial','Certidão da CRP','Contrato de Arrendamento','Alvará de Loteamento','Planta de Loteamento','Licença de Construção/Obras','Licença de Utilização','Orçamento de obras','Memória Descritiva','Ficha Técnica Habitação','Projeto Aprovado','Projeto Não Aprovado','Certificado Energético','Outro'].map(doc => {
              const field = 'doc_' + doc.toLowerCase().replace(/[^a-z0-9]/g,'_')
              return <F key={field} label={doc} field={field} value={(property as any)[field]}
                opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            })}
          </Section>
        </>)}

        {/* SEC 9 ── Condicionalismos */}
        {tab==='sec9' && (
          <div className="space-y-4">
            <F label="Condicionalismos" field="prev_valuation_conditions" value={property.prev_valuation_conditions} textarea span onSave={save}/>
            <F label="Observações"      field="cond_observacoes"          value={property.cond_observacoes}          textarea span onSave={save}/>
          </div>
        )}

        {/* SEC 10 ── Advertências */}
        {tab==='sec10' && (
          <div className="space-y-4">
            <F label="Advertências e Considerações Gerais" field="advertencias" value={property.advertencias} textarea span onSave={save}/>
          </div>
        )}

        {/* SEC 11 ── Conclusão */}
        {tab==='sec11' && (<>
          <Section title="Valor Terminado / Valor Hipótese Terminado">
            <F label="Valor de Mercado (€)"              field="valor_mercado"        value={property.valor_mercado}        type="number" onSave={save}/>
            <F label="V.V.R. — Valor de Venda Rápida (€)" field="valor_venda_rapida"  value={property.valor_venda_rapida}  type="number" onSave={save}/>
            <F label="Valor de Seguro (€)"               field="valor_seguro"         value={property.valor_seguro}         type="number" onSave={save}/>
            <F label="% Obra"                            field="pct_obra"             value={property.pct_obra}             type="number" onSave={save}/>
          </Section>
          <Section title="Valor Actual">
            <F label="Valor de Mercado Actual (€)"       field="valor_mercado_atual"      value={property.valor_mercado_atual}      type="number" onSave={save}/>
            <F label="V.V.R. Actual (€)"                 field="valor_venda_rapida_atual" value={property.valor_venda_rapida_atual} type="number" onSave={save}/>
            <F label="Valor de Seguro Actual (€)"        field="valor_seguro_atual"       value={property.valor_seguro_atual}       type="number" onSave={save}/>
            <F label="% Obra Actual"                     field="pct_obra_atual"           value={property.pct_obra_atual}           type="number" onSave={save}/>
          </Section>
        </>)}

        {/* Obras de Beneficiação */}
        {tab==='obras' && (
          <div className="space-y-4">
            <Section title="Obras de Beneficiação">
              <F label="Valor do Orçamento apresentado c/ IVA (€)"   field="obras_orcamento_apres"    value={property.obras_orcamento_apres}    type="number" onSave={save}/>
              <F label="Valor do Orçamento estimado c/ IVA (€)"      field="obras_orcamento_est"      value={property.obras_orcamento_est}      type="number" onSave={save}/>
              <F label="Valorização após execução das obras (€)"      field="obras_valorizacao"        value={property.obras_valorizacao}        type="number" onSave={save}/>
              <F label="Necessitam de licença camarária"              field="obras_licenca_camara"     value={property.obras_licenca_camara}
                opts={['Sim','Não']} onSave={save}/>
              <F label="Valor de Mercado antes das obras (€)"         field="obras_valor_antes"        value={property.obras_valor_antes}        type="number" onSave={save}/>
              <F label="Valor de Mercado após conclusão das obras (€)" field="obras_valor_apos"        value={property.obras_valor_apos}         type="number" onSave={save}/>
              <F label="% Obra realizada do orçamento"                field="obras_pct_realizada"      value={property.obras_pct_realizada}      type="number" onSave={save}/>
              <F label="Valor de Mercado actual c/ % obra realizada (€)" field="obras_valor_atual"    value={property.obras_valor_atual}         type="number" onSave={save}/>
            </Section>
            <div>
              <label className="label">Descrição das obras a realizar</label>
              <F label="" field="obras_descricao" value={property.obras_descricao} textarea span onSave={save}/>
            </div>
          </div>
        )}

        {/* Método Residual */}
        {tab==='residual' && (<>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">Método Residual Estático</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Descrição"      field="resid_est_descricao"  value={property.resid_est_descricao}              onSave={save}/>
              <F label="Área (m²)"     field="resid_est_area"       value={property.resid_est_area}       type="number" onSave={save}/>
              <F label="Valor (€/m²)"  field="resid_est_valor_m2"   value={property.resid_est_valor_m2}   type="number" onSave={save}/>
              <F label="Valor Total (€)" field="resid_est_total"    value={property.resid_est_total}      type="number" onSave={save}/>
            </div>
            <div className="mt-3">
              <label className="label">Observações</label>
              <F label="" field="resid_est_obs" value={property.resid_est_obs} textarea span onSave={save}/>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-100">Método Residual Dinâmico</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <F label="Descrição"      field="resid_din_descricao"  value={property.resid_din_descricao}              onSave={save}/>
              <F label="Área (m²)"     field="resid_din_area"       value={property.resid_din_area}       type="number" onSave={save}/>
              <F label="Valor (€/m²)"  field="resid_din_valor_m2"   value={property.resid_din_valor_m2}   type="number" onSave={save}/>
              <F label="Valor Total (€)" field="resid_din_total"    value={property.resid_din_total}      type="number" onSave={save}/>
            </div>
            <div className="mt-3">
              <label className="label">Observações</label>
              <F label="" field="resid_din_obs" value={property.resid_din_obs} textarea span onSave={save}/>
            </div>
          </div>
        </>)}

        {/* SEC 13 ── Certificação */}
        {tab==='sec13' && (<>
          <Section title="Empresa de Avaliação">
            <F label="Nome"           field="empresa_nome"            value={property.empresa_nome}                          onSave={save}/>
            <F label="NIF Empresa"    field="empresa_nif"             value={property.empresa_nif}                           onSave={save}/>
            <F label="N.º CMVM"       field="empresa_cmvm"            value={property.empresa_cmvm}                          onSave={save}/>
            <F label="Apólice N.º"    field="empresa_apolice"         value={property.empresa_apolice}                       onSave={save}/>
            <F label="Data Validade"  field="empresa_data_validade"   value={property.empresa_data_validade}   type="date"   onSave={save}/>
            <F label="Seguradora"     field="empresa_seguradora"      value={property.empresa_seguradora}                    onSave={save}/>
            <F label="Assinatura"     field="empresa_assinatura"      value={property.empresa_assinatura}                    onSave={save}/>
          </Section>
          <Section title="Perito Avaliador Certificado">
            <F label="Nome"           field="pac_nome"                value={property.pac_nome}                              onSave={save}/>
            <F label="Ordem/Ass."     field="pac_ordem"               value={property.pac_ordem}                             onSave={save}/>
            <F label="N.º CMVM"       field="pac_cmvm"                value={property.pac_cmvm}                              onSave={save}/>
            <F label="Apólice n.º"    field="pac_apolice"             value={property.pac_apolice}                           onSave={save}/>
            <F label="Data Validade"  field="pac_data_validade"       value={property.pac_data_validade}       type="date"   onSave={save}/>
            <F label="Seguradora"     field="pac_seguradora"          value={property.pac_seguradora}                        onSave={save}/>
            <F label="Assinatura"     field="pac_assinatura"          value={property.pac_assinatura}                        onSave={save}/>
          </Section>
          <Section title="Perito Avaliador">
            <F label="Nome"           field="perito_avaliador"        value={property.perito_avaliador}                      onSave={save}/>
            <F label="Ordem/Ass."     field="perito_ordem"            value={property.perito_ordem}                          onSave={save}/>
            <F label="N.º CMVM"       field="perito_cmvm"             value={property.perito_cmvm}                           onSave={save}/>
            <F label="Apólice N.º"    field="nr_apolice"              value={property.nr_apolice}                            onSave={save}/>
            <F label="Data Validade"  field="data_validade_seguro"    value={property.data_validade_seguro}    type="date"   onSave={save}/>
            <F label="Seguradora"     field="seguradora"              value={property.seguradora}                            onSave={save}/>
            <F label="Assinatura"     field="perito_assinatura"       value={property.perito_assinatura}                     onSave={save}/>
          </Section>
          {property.report_url && (
            <div className="mt-3 p-3 bg-brand-50 rounded-lg border border-brand-100">
              <p className="text-xs text-gray-500 mb-1">Relatório disponível online:</p>
              <a href={property.report_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline break-all flex items-center gap-1">
                <ExternalLink size={11}/> {property.report_url}
              </a>
            </div>
          )}
        </> )}

        {/* SEC 14 ── Faturação */}
        {tab==='sec14' && (<>
          <Section title="Estado Financeiro">
            <div>
              <label className="label">Estado de Faturação</label>
              <select className="input text-sm w-full" value={property.billing_status||''} onChange={e => { save({ billing_status: e.target.value }) }}>
                <option value="">—</option>
                {Object.entries(BILLING_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </div>
            <F label="Honorário (€)"    field="fee_amount"     value={property.fee_amount}     type="number" onSave={save}/>
            <F label="Número PO"        field="po_number"      value={property.po_number}                    onSave={save}/>
            <F label="Data PO"          field="po_date"        value={property.po_date}         type="date"  onSave={save}/>
            <F label="N.º Fatura"       field="invoice_number" value={property.invoice_number}              onSave={save}/>
            <F label="Data Fatura"      field="invoice_date"   value={property.invoice_date}    type="date"  onSave={save}/>
            <F label="Data Pagamento"   field="payment_date"   value={property.payment_date}    type="date"  onSave={save}/>
          </Section>
          <Section title="Detalhe da Fatura">
            <F label="Recetor — Nome"           field="fatura_recetor_nome" value={property.fatura_recetor_nome}              onSave={save}/>
            <F label="Recetor — NIF"            field="fatura_recetor_nif"  value={property.fatura_recetor_nif}               onSave={save}/>
            <F label="Emissor — Nome"           field="fatura_emissor_nome" value={property.fatura_emissor_nome}              onSave={save}/>
            <F label="Emissor — NIF"            field="fatura_emissor_nif"  value={property.fatura_emissor_nif}               onSave={save}/>
            <F label="Base Tributável (€)"      field="fatura_base"         value={property.fatura_base}         type="number" onSave={save}/>
            <F label="IVA (%)"                  field="fatura_iva"          value={property.fatura_iva}          type="number" onSave={save}/>
            <F label="Valor Total Fatura (€)"   field="fatura_total"        value={property.fatura_total}        type="number" onSave={save}/>
          </Section>
        </>)}

        {/* SEC 15 ── Fotos */}
        {tab==='sec15' && (
          <div className="space-y-4">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${isDragActive?'border-brand-400 bg-brand-50':'border-gray-200 hover:border-gray-300'}`}>
              <input {...getInputProps()}/>
              {uploading ? <Loader2 size={20} className="animate-spin mx-auto text-brand-400"/> : <>
                <Upload size={18} className="mx-auto text-gray-300 mb-1.5"/>
                <p className="text-sm text-gray-400">Arrasta fotos ou clica para seleccionar</p>
                <p className="text-xs text-gray-300 mt-0.5">Máx. 5MB · até 8 fotos</p>
              </>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SLOTS.map(slot => {
                const photo = photos.find((p: any) => p.slot===slot)
                if (!photo) return (
                  <div key={slot} className="aspect-video bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-300">Foto {slot}</span>
                  </div>
                )
                const { data:{ publicUrl } } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
                return (
                  <div key={slot} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-100">
                    <img src={publicUrl} alt={`Foto ${slot}`} className="w-full h-full object-cover"/>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn bg-white/90 text-xs py-1 px-2"><ExternalLink size={11}/></a>
                      <button className="btn bg-red-500/90 text-white text-xs py-1 px-2"
                        onClick={() => { if (confirm('Eliminar esta foto?')) deletePhoto.mutate(photo.id) }}><Trash2 size={11}/></button>
                    </div>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Foto {slot}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SEC 16 ── Comparáveis */}
        {tab==='sec16' && (
          <CompsSection
            propertyId={property.id}
            comps={comps}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['property', id] })}
          />
        )}

        {/* SEC 17 ── Avaliação Anterior */}
        {tab==='sec17' && (
          <div className="space-y-6">

            {/* Documentos de avaliações anteriores */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Documentos de Avaliação Anterior</h3>
                <label className="btn text-xs cursor-pointer flex items-center gap-1.5">
                  {uploadingDoc ? <Loader2 size={11} className="animate-spin"/> : <Upload size={11}/>}
                  Carregar documento
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xlsx,.xls"
                    onChange={e => { if (e.target.files?.[0]) uploadDocument(e.target.files[0]) }}/>
                </label>
              </div>
              {documents.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhum documento carregado.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => {
                    const { data:{ publicUrl } } = supabase.storage.from('prev-reports').getPublicUrl(doc.storage_path)
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <File size={14} className="text-gray-400 flex-shrink-0"/>
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-brand-600 hover:underline truncate">{doc.name}</a>
                          {doc.size_bytes && <span className="text-xs text-gray-400 flex-shrink-0">{(doc.size_bytes/1024).toFixed(0)} KB</span>}
                        </div>
                        <button className="text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => deleteDocument(doc)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Dados originais da datatape traduzidos */}
            {datatapeFields.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dados Originais da Data-tape</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {datatapeFields.map(([k,v]) => (
                    <div key={k} className="flex gap-2 px-2.5 py-1.5 bg-gray-50 rounded text-xs">
                      <span className="text-gray-400 font-mono min-w-[180px] flex-shrink-0">{translateDatatapeKey(k)}</span>
                      <span className="text-gray-700 truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEC 18 ── Notas */}
        {tab==='sec18' && (
          <div className="space-y-4">
            <F label="Notas de Visita"  field="notas_visita"   value={property.notas_visita}   textarea span onSave={save}/>
            <F label="Notas Internas"   field="notas_internas" value={property.notas_internas} textarea span onSave={save}/>
            <div>
              <label className="label">Estado de Visita</label>
              <select className="input text-sm max-w-xs" value={property.visit_status||''} onChange={e => { save({ visit_status: e.target.value }) }}>
                <option value="">—</option>
                {Object.entries(VISIT_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Critério de Chauvenet ──────────────────────────────────────────────────
function chauvenet(values: number[]): boolean[] {
  const n = values.length
  if (n < 3) return values.map(() => false)
  const mean = values.reduce((a, b) => a + b, 0) / n
  const std  = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n)
  if (std === 0) return values.map(() => false)

  // Função de distribuição normal cumulativa — implementação precisa (algoritmo de Hart)
  function normCDF(x: number): number {
    const a1 =  0.254829592
    const a2 = -0.284496736
    const a3 =  1.421413741
    const a4 = -1.453152027
    const a5 =  1.061405429
    const p  =  0.3275911
    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.SQRT2
    const t = 1 / (1 + p * x)
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
    return 0.5 * (1 + sign * y)
  }

  // Probabilidade de estar fora do intervalo [mean-d, mean+d]
  function probOutside(d: number): number {
    return 2 * (1 - normCDF(d))
  }

  return values.map(v => {
    const d    = Math.abs(v - mean) / std
    const prob = probOutside(d)
    // Critério de Chauvenet: rejeitar se n × prob < 0.5
    return n * prob < 0.5
  })
}

// ── Inline editable cell ───────────────────────────────────────────────────
function EditCell({ value, type='text', onSave, className='' }: {
  value: any; type?: string; onSave: (v: any) => void; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  useEffect(() => setVal(value ?? ''), [value])

  function save() {
    const v = type === 'number' ? (val ? parseFloat(val) : null) : (val || null)
    onSave(v); setEditing(false)
  }

  if (!editing) return (
    <div className={`cursor-pointer hover:bg-brand-50 rounded px-1 py-0.5 min-h-[22px] ${className}`}
      onClick={() => setEditing(true)}>
      {value ?? <span className="text-gray-300 italic">—</span>}
    </div>
  )
  return (
    <input autoFocus type={type}
      className="border border-brand-300 rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-400"
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value??''); setEditing(false) } }}
    />
  )
}

// ── Comparáveis com Chauvenet e selecção ──────────────────────────────────
function CompsSection({ propertyId, comps, onRefresh }: {
  propertyId: string; comps: any[]; onRefresh: () => void
}) {
  const [applying, setApplying] = useState(false)

  const compsWithEpm2 = [...comps]
    .map((c: any) => ({
      ...c,
      epm2: c.price && c.area_m2 ? parseFloat(c.price) / parseFloat(c.area_m2) : null
    }))
    .sort((a, b) => {
      if (a.epm2 === null) return 1
      if (b.epm2 === null) return -1
      return a.epm2 - b.epm2
    })

  const selected      = compsWithEpm2.filter(c => c.selected)
  const selectedCount = selected.length
  const avgSelected   = selected.length
    ? selected.reduce((s: number, c: any) => s + (c.epm2 || 0), 0) / selected.filter((c:any) => c.epm2).length
    : null

  function fmtPrice(val: any): string {
    if (!val) return '—'
    const n = parseFloat(val)
    if (isNaN(n)) return '—'
    return n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
  }

  async function updateComp(compId: string, patch: any) {
    await supabase.from('market_comps').update(patch).eq('id', compId)
    onRefresh()
  }

  async function applyChauvenet() {
    setApplying(true)
    const withEpm2 = compsWithEpm2.filter(c => c.epm2 !== null)
    if (withEpm2.length < 3) {
      toast.error('Precisas de pelo menos 3 comparáveis com área e preço.')
      setApplying(false); return
    }
    const values   = withEpm2.map(c => c.epm2!)
    const rejected = chauvenet(values)

    // Apenas marca outliers — NÃO altera a selecção
    for (let i = 0; i < withEpm2.length; i++) {
      await supabase.from('market_comps')
        .update({ chauvenet_rejected: rejected[i] })
        .eq('id', withEpm2[i].id)
    }
    onRefresh()
    setApplying(false)
    const rejCount = rejected.filter(Boolean).length
    if (rejCount > 0) {
      toast.success(`${rejCount} outlier(s) identificado(s) e marcado(s) a vermelho`)
    } else {
      toast.success('Nenhum outlier detectado — todos os comparáveis passam o critério')
    }
  }

  async function toggleSelected(c: any) {
    if (!c.selected && selectedCount >= 5) {
      toast.error('Máximo 5 comparáveis no relatório.')
      return
    }
    if (!c.selected && c.chauvenet_rejected) {
      toast('Este comparável foi identificado como outlier pelo Critério de Chauvenet.', { icon: '⚠️' })
    }
    await updateComp(c.id, { selected: !c.selected })
  }

  return (
    <div className="space-y-6">

      {/* 1 ── Adicionar comparável */}
      <CompForm propertyId={propertyId} onAdded={onRefresh}/>

      {/* 2 ── Lista completa */}
      {comps.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Comparáveis Carregados ({comps.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th className="w-8 text-center">✓</th>
                  <th>Portal</th>
                  <th>Localização</th>
                  <th>Uso</th>
                  <th>Tipologia</th>
                  <th>Ano/Estado</th>
                  <th>Área (m²)</th>
                  <th>Preço</th>
                  <th>€/m²</th>
                  <th>Descrição</th>
                  <th>Link</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {compsWithEpm2.map((c: any) => (
                  <tr key={c.id} className={
                    c.selected && c.chauvenet_rejected ? 'bg-red-50' :
                    c.selected                        ? 'bg-emerald-50' :
                    c.chauvenet_rejected               ? 'bg-red-50 opacity-60' : ''
                  }>
                    <td className="text-center">
                      <button onClick={() => toggleSelected(c)}
                        title={c.selected ? 'Remover do relatório' : 'Incluir no relatório'}
                        className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition-colors
                          ${c.selected && c.chauvenet_rejected ? 'border-red-500 bg-red-500 text-white' :
                            c.selected  ? 'border-emerald-500 bg-emerald-500 text-white' :
                            'border-gray-300 hover:border-brand-400'}`}>
                        {c.selected && <span className="text-[10px]">✓</span>}
                      </button>
                    </td>
                    <td><EditCell value={c.portal}     onSave={v => updateComp(c.id, { portal: v })}/></td>
                    <td className="max-w-[120px]"><EditCell value={c.address}    onSave={v => updateComp(c.id, { address: v })}/></td>
                    <td><EditCell value={c.uso}        onSave={v => updateComp(c.id, { uso: v })}/></td>
                    <td><EditCell value={c.tipologia}  onSave={v => updateComp(c.id, { tipologia: v })}/></td>
                    <td><EditCell value={c.ano_estado} onSave={v => updateComp(c.id, { ano_estado: v })}/></td>
                    <td><EditCell value={c.area_m2}    type="number" onSave={v => updateComp(c.id, { area_m2: v })}/></td>
                    <td className="whitespace-nowrap">
                      <EditCell
                        value={c.price ? parseFloat(c.price).toLocaleString('pt-PT', { minimumFractionDigits:0, maximumFractionDigits:0 }) : ''}
                        type="number"
                        onSave={v => updateComp(c.id, { price: v })}
                      />
                    </td>
                    <td className={`font-medium whitespace-nowrap
                      ${c.selected && c.chauvenet_rejected ? 'text-red-600' :
                        c.chauvenet_rejected ? 'text-red-400' :
                        c.selected ? 'text-emerald-700' : ''}`}>
                      {c.epm2 ? c.epm2.toFixed(2).replace('.',',') : '—'}
                    </td>
                    <td className="max-w-[160px]"><EditCell value={c.notes} onSave={v => updateComp(c.id, { notes: v })}/></td>
                    <td className="text-center">
                      {c.url
                        ? <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-700"><ExternalLink size={11}/></a>
                        : <EditCell value={c.url} onSave={v => updateComp(c.id, { url: v })} className="text-gray-300 text-[10px]"/>
                      }
                    </td>
                    <td>
                      <button className="text-red-400 hover:text-red-600" onClick={async () => {
                        if (confirm('Eliminar este comparável?')) {
                          await supabase.from('market_comps').delete().eq('id', c.id)
                          onRefresh()
                        }
                      }}><Trash2 size={11}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>Seleccionado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"></span>Outlier (Chauvenet)</span>
            <span className="italic">Clica em qualquer célula para editar</span>
          </div>
        </div>
      )}

      {/* 3 ── Botão Chauvenet */}
      {comps.length >= 3 && (
        <div className="flex items-center justify-between gap-3 py-3 border-t border-b border-gray-100">
          <div className="text-xs text-gray-400">
            O Critério de Chauvenet identifica comparáveis com €/m² estatisticamente improvável para a amostra.
            Podes na mesma seleccioná-los — ficam marcados a vermelho como aviso.
          </div>
          <button className="btn flex items-center gap-1.5 text-xs whitespace-nowrap" onClick={applyChauvenet} disabled={applying}>
            {applying ? <Loader2 size={11} className="animate-spin"/> : null}
            Aplicar Critério de Chauvenet
          </button>
        </div>
      )}

      {/* 4 ── Comparáveis seleccionados — recap para relatório */}
      {selected.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Comparáveis Seleccionados para Relatório ({selected.length}/5)
          </h3>
          <div className="overflow-x-auto">
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Localização</th>
                  <th>Uso</th>
                  <th>Tipologia</th>
                  <th>Ano/Estado</th>
                  <th>Área (m²)</th>
                  <th>Preço</th>
                  <th>€/m²</th>
                  <th>Descrição</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((c: any, i: number) => (
                  <tr key={c.id} className={c.chauvenet_rejected ? 'bg-red-50' : 'bg-emerald-50'}>
                    <td className="font-medium text-emerald-700">{i + 1}</td>
                    <td>{c.address || '—'}</td>
                    <td>{c.uso || '—'}</td>
                    <td>{c.tipologia || '—'}</td>
                    <td>{c.ano_estado || '—'}</td>
                    <td>{c.area_m2 ? parseFloat(c.area_m2).toFixed(2).replace('.',',') : '—'}</td>
                    <td className="whitespace-nowrap font-medium">{fmtPrice(c.price)}</td>
                    <td className={`font-semibold ${c.chauvenet_rejected ? 'text-red-600' : 'text-emerald-700'}`}>
                      {c.epm2 ? c.epm2.toFixed(2).replace('.',',') : '—'}
                      {c.chauvenet_rejected && <span className="ml-1 text-red-400 font-normal">⚠️</span>}
                    </td>
                    <td className="max-w-[180px] truncate">{c.notes || '—'}</td>
                    <td>{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-700"><ExternalLink size={11}/></a> : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-100 font-semibold">
                  <td colSpan={7} className="text-right text-emerald-800">Média €/m²</td>
                  <td className="text-emerald-800">{avgSelected ? avgSelected.toFixed(2).replace('.',',') + ' €' : '—'}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
          {selected.some((c:any) => c.chauvenet_rejected) && (
            <p className="text-xs text-red-500">⚠️ Um ou mais comparáveis seleccionados foram identificados como outliers pelo Critério de Chauvenet.</p>
          )}
        </div>
      )}

    </div>
  )
}

// ── Formulário de comparável ───────────────────────────────────────────────
function CompForm({ propertyId, onAdded }: { propertyId: string; onAdded: () => void }) {
  const [form, setForm] = useState({
    portal:'', listing_ref:'', url:'', address:'',
    area_m2:'', price:'', notes:'',
    uso:'', tipologia:'', ano_estado:''
  })
  const [saving, setSaving] = useState(false)
  async function submit() {
    setSaving(true)
    const { error } = await supabase.from('market_comps').insert({
      property_id: propertyId,
      portal:      form.portal,
      listing_ref: form.listing_ref,
      url:         form.url,
      address:     form.address,
      area_m2:     form.area_m2 ? parseFloat(form.area_m2) : null,
      price:       form.price   ? parseFloat(form.price)   : null,
      notes:       [form.tipologia, form.uso, form.ano_estado, form.notes].filter(Boolean).join(' | '),
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setForm({ portal:'', listing_ref:'', url:'', address:'', area_m2:'', price:'', notes:'', uso:'', tipologia:'', ano_estado:'' })
    onAdded(); toast.success('Comparável adicionado')
  }
  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Adicionar Comparável</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input className="input text-xs" placeholder="Portal (ex: Idealista)" value={form.portal} onChange={e => setForm(f=>({...f,portal:e.target.value}))}/>
        <input className="input text-xs" placeholder="Ref. anúncio" value={form.listing_ref} onChange={e => setForm(f=>({...f,listing_ref:e.target.value}))}/>
        <input className="input text-xs col-span-2" placeholder="URL / Fonte" value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))}/>
        <input className="input text-xs col-span-2" placeholder="Localização" value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))}/>
        <input className="input text-xs" placeholder="Uso (ex: Residencial)" value={form.uso} onChange={e => setForm(f=>({...f,uso:e.target.value}))}/>
        <input className="input text-xs" placeholder="Tipologia (ex: T3)" value={form.tipologia} onChange={e => setForm(f=>({...f,tipologia:e.target.value}))}/>
        <input className="input text-xs" placeholder="Ano / Estado (ex: 2005 / Usado)" value={form.ano_estado} onChange={e => setForm(f=>({...f,ano_estado:e.target.value}))}/>
        <input className="input text-xs" placeholder="Área (m²)" type="number" value={form.area_m2} onChange={e => setForm(f=>({...f,area_m2:e.target.value}))}/>
        <input className="input text-xs" placeholder="Preço (€)" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))}/>
        <input className="input text-xs col-span-2 md:col-span-4" placeholder="Descrição Geral" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}/>
      </div>
      <button className="btn btn-primary text-xs mt-2" onClick={submit} disabled={saving}>
        {saving ? <Loader2 size={11} className="animate-spin"/> : 'Adicionar'}
      </button>
    </div>
  )
}
