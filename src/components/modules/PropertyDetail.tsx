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
  'sec1','sec2','sec3','sec4','sec5','sec6','sec7','sec8',
  'sec9','sec10','sec11','sec12','sec13','sec14','sec15','sec16','sec17','sec18'
] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = {
  sec1:'1. Identificação', sec2:'2. Morada', sec3:'3. Descrição',
  sec4:'4. Localização', sec5:'5. Construção', sec6:'6. Áreas',
  sec7:'7. Métodos', sec8:'8. Documentos', sec9:'9. Condicionalismos',
  sec10:'10. Advertências', sec11:'11. Conclusão', sec12:'12. Justificação',
  sec13:'13. Certificação', sec14:'14. Faturação',
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
        supabase.from('market_comps').select('*').eq('property_id', id as string).order('created_at', { ascending: false }),
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
  useEffect(() => {
    if (!mapReady || !mapRef.current || tab !== 'sec2' || !property) return
    setTimeout(() => {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
      const L = window.L
      const lat = property.latitude||39.5, lon = property.longitude||-8.0
      mapInst.current = L.map(mapRef.current).setView([lat,lon], property.latitude?16:7)
      const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution:'© Esri', maxZoom:19 })
      const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:19 })
      satellite.addTo(mapInst.current)
      L.control.layers({'Satélite':satellite,'Mapa':street},{},{position:'topright'}).addTo(mapInst.current)
      if (property.latitude) {
        L.marker([property.latitude, property.longitude], {
          draggable: true,
          icon: L.divIcon({ className:'', html:`<div style="width:16px;height:16px;border-radius:50%;background:#1D9E75;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize:[16,16], iconAnchor:[8,8] })
        }).addTo(mapInst.current).bindPopup(`<b>${property.external_ref||property.ref}</b>`).openPopup()
      }
    }, 150)
  }, [mapReady, tab, property?.latitude, property?.longitude])

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
      const templateUrl = import.meta.env.VITE_REPORT_TEMPLATE_URL
      if (!templateUrl) throw new Error('VITE_REPORT_TEMPLATE_URL não está configurada.')

      // Captura do mapa com html2canvas
      let mapImageBlob: Blob | null = null
      if (mapRef.current && property.latitude) {
        try {
          // Zoom 17 para captura
          if (mapInst.current) mapInst.current.setZoom(17)
          await new Promise(r => setTimeout(r, 1200)) // aguarda tiles carregarem

          // Esconde controlos temporariamente
          const controls = mapRef.current.querySelectorAll<HTMLElement>(
            '.leaflet-control-container'
          )
          controls.forEach(el => { el.style.display = 'none' })

          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(mapRef.current, {
            useCORS: true, allowTaint: true, logging: false,
            width: mapRef.current.offsetWidth, height: mapRef.current.offsetHeight,
          })
          mapImageBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))

          // Restaura controlos
          controls.forEach(el => { el.style.display = '' })
        } catch { /* mapa não disponível, continua sem ele */ }
      }

      const { data: freshPhotos } = await supabase.from('property_photos').select('*').eq('property_id', property.id).order('slot').order('sort_order')
      const photoUrls = (freshPhotos||[]).map((ph: any) => {
        const { data } = supabase.storage.from('photos').getPublicUrl(ph.storage_path)
        return { ...ph, url: data.publicUrl }
      }).filter((ph: any) => ph.url)

      await generateAbancaReport(property, photoUrls, comps, templateUrl, mapImageBlob)
      toast.success('Relatório gerado com sucesso')
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
            <F label="Subtipo de Relatório"       field="subtipo_relatorio"        value={property.subtipo_relatorio}                      onSave={save}/>
            <F label="Finalidade"                 field="finalidade"               value={property.finalidade}
              opts={['Adjudicado com visita interior','Adjudicado sem visita interior','Garantia hipotecária','Outros fins']} onSave={save}/>
            <F label="Ref. Externa"               field="external_ref"             value={property.external_ref}                           onSave={save}/>
            <F label="ID do Bem"                  field="id_bien"                  value={property.id_bien}                                onSave={save}/>
            <F label="NUC Risco"                  field="nuc_risco"                value={property.nuc_risco}                              onSave={save}/>
            <F label="Tipo de Serviço"            field="tipo_servico"             value={property.tipo_servico}
              opts={['Avaliação','Vistoria','Portabilidade','Reavaliação']} onSave={save}/>
          </Section>
          <Section title="Perito Avaliador">
            <F label="Nome do Perito"             field="perito_avaliador"         value={property.perito_avaliador}                       onSave={save}/>
            <F label="NIF do Perito"              field="perito_nif"               value={property.perito_nif}                             onSave={save}/>
            <F label="N.º CMVM"                   field="perito_cmvm"              value={property.perito_cmvm}                            onSave={save}/>
            <F label="N.º Apólice Seguro"         field="nr_apolice"               value={property.nr_apolice}                             onSave={save}/>
            <F label="Data Validade Seguro"       field="data_validade_seguro"     value={property.data_validade_seguro}     type="date"   onSave={save}/>
            <F label="Seguradora"                 field="seguradora"               value={property.seguradora}                             onSave={save}/>
          </Section>
          <Section title="Requerente / Mandatário">
            <F label="Requerente — Nome"          field="requerente_nome"          value={property.requerente_nome}                        onSave={save}/>
            <F label="Requerente — NIF"           field="requerente_nif"           value={property.requerente_nif}                         onSave={save}/>
            <F label="Mandatário — Nome"          field="mandatario_nome"          value={property.mandatario_nome}                        onSave={save}/>
            <F label="Mandatário — NIF"           field="mandatario_nif"           value={property.mandatario_nif}                         onSave={save}/>
          </Section>
        </>)}

        {/* SEC 2 ── Morada do Imóvel */}
        {tab==='sec2' && (<>
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
        </>)}

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
            <F label="Estado do Bem"         field="property_state"     value={property.property_state}
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
          <Section title="Registos">
            <F label="Registo Predial"       field="id_registo_predial"   value={property.id_registo_predial}    onSave={save}/>
            <F label="Artigo Matricial"      field="id_registo_matricial" value={property.id_registo_matricial}  onSave={save}/>
            <F label="Fracção"               field="fracao"               value={property.fracao}                onSave={save}/>
            <F label="Tipo de Prédio"        field="tipo_predio"          value={property.tipo_predio}
              opts={['Prédio urbano','Prédio rústico','Prédio misto']} onSave={save}/>
            <F label="Referência Cadastral"  field="ref_cadastral"        value={property.ref_cadastral}         onSave={save}/>
          </Section>
          <div className="mb-4">
            <label className="label">Composição / Descrição do Imóvel</label>
            <F label="" field="composicao_imovel" value={property.composicao_imovel} textarea span onSave={save}/>
          </div>
        </>)}

        {/* SEC 4 ── Características da Localização */}
        {tab==='sec4' && (<>
          <Section title="Enquadramento no Mercado">
            <F label="Características do Mercado"  field="caract_mercado"           value={property.caract_mercado}
              opts={['Urbano consolidado','Urbano não consolidado','Urbanizável','Rural']} onSave={save}/>
            <F label="Zona Envolvente"              field="zona_envolvente"          value={property.zona_envolvente}          onSave={save}/>
            <F label="Expectativas do Mercado"      field="tipo_expectativa_mercado" value={property.tipo_expectativa_mercado}
              opts={['Muito positiva','Positiva','Estável','Negativa','Muito negativa']} onSave={save}/>
            <F label="Evolução do Mercado"          field="evolucao_mercado"         value={property.evolucao_mercado}
              opts={['Tendencialmente positiva','Estável','Tendencialmente negativa']} onSave={save}/>
            <F label="Ocupação Laboral"             field="ocupacao_laboral"         value={property.ocupacao_laboral}
              opts={['Muito alta','Alta','Média','Baixa','Muito baixa']} onSave={save}/>
            <F label="População do Concelho"        field="populacao_concelho"       value={property.populacao_concelho}       onSave={save}/>
          </Section>
          <Section title="Datas do Processo">
            <F label="Data do Pedido"               field="data_pedido_relatorio"    value={property.data_pedido_relatorio}    type="date" onSave={save}/>
            <F label="Data da Visita ao Imóvel"     field="data_visita"              value={property.data_visita}              type="date" onSave={save}/>
            <F label="Data de Conclusão e Entrega"  field="data_conclusao"           value={property.data_conclusao}           type="date" onSave={save}/>
            <F label="Data do Relatório"            field="data_relatorio"           value={property.data_relatorio}           type="date" onSave={save}/>
            <F label="Data de Emissão"              field="data_emissao_cert"        value={property.data_emissao_cert}        type="date" onSave={save}/>
          </Section>
          <Section title="Conclusão — Valores Finais">
            <F label="Valor de Mercado (€)"              field="valor_mercado"            value={property.valor_mercado}            type="number" onSave={save}/>
            <F label="V.V.R. — Valor Venda Rápida (€)"  field="valor_venda_rapida"       value={property.valor_venda_rapida}       type="number" onSave={save}/>
            <F label="Valor de Seguro (€)"               field="valor_seguro"             value={property.valor_seguro}             type="number" onSave={save}/>
            <F label="Valor de Mercado Actual (€)"       field="valor_mercado_atual"      value={property.valor_mercado_atual}      type="number" onSave={save}/>
            <F label="V.V.R. Actual (€)"                 field="valor_venda_rapida_atual" value={property.valor_venda_rapida_atual} type="number" onSave={save}/>
            <F label="% Obra"                            field="pct_obra"                 value={property.pct_obra}                 type="number" onSave={save}/>
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
            <F label="Ano de Construção"          field="year_built"              value={property.year_built}              type="number" onSave={save}/>
            <F label="Ano Licença Utilização"     field="ano_licenca_utilizacao"  value={property.ano_licenca_utilizacao}  type="number" onSave={save}/>
            <F label="Data Licença Construção"    field="data_licenca_construcao" value={property.data_licenca_construcao} type="date"   onSave={save}/>
            <F label="Data Conclusão Prevista"    field="data_conclusao_obras"    value={property.data_conclusao_obras}    type="date"   onSave={save}/>
            <F label="Data Última Remodelação"    field="data_ultima_remod"       value={property.data_ultima_remod}       type="date"   onSave={save}/>
            <F label="Imóvel de Interesse Cultural" field="interesse_cultural"    value={property.interesse_cultural}
              opts={['Sim','Não']} onSave={save}/>
            <F label="Potencial Alteração de Uso" field="potencial_alteracao_uso" value={property.potencial_alteracao_uso}
              opts={['Sim','Não']} onSave={save}/>
          </Section>
          <Section title="Certificado Energético">
            <F label="Classe Energética"    field="classe_energetica"    value={property.classe_energetica}
              opts={['A+','A','B','B-','C','D','E','F','Isento','Em curso']} onSave={save}/>
            <F label="N.º Certificado"      field="nr_certificado_energ" value={property.nr_certificado_energ}  onSave={save}/>
            <F label="Data de Emissão"      field="data_emissao_cert"    value={property.data_emissao_cert}     type="date" onSave={save}/>
            <F label="Data de Validade"     field="data_validade_cert"   value={property.data_validade_cert}    type="date" onSave={save}/>
          </Section>
          <Section title="Qualificação do Solo">
            <F label="Qualificação do Solo"  field="qualificacao_solo"   value={property.qualificacao_solo}   onSave={save}/>
            <F label="Classificação do Solo" field="classificacao_solo"  value={property.classificacao_solo}  onSave={save}/>
            <F label="Condição de Lote"      field="condicao_lote"       value={property.condicao_lote}
              opts={['Sim','Não']} onSave={save}/>
          </Section>
        </>)}

        {/* SEC 6 ── Áreas do Imóvel */}
        {tab==='sec6' && (<>
          <Section title="Áreas">
            <F label="Área Considerada (m²)"       field="area_considerada" value={property.area_considerada} type="number" onSave={save}/>
            <F label="Área Bruta Construída (m²)"  field="area_m2"          value={property.area_m2}          type="number" onSave={save}/>
            <F label="Área Bruta Privativa (m²)"   field="gross_area"       value={property.gross_area}        type="number" onSave={save}/>
            <F label="Área Útil (m²)"              field="useful_area"      value={property.useful_area}       type="number" onSave={save}/>
            <F label="Área do Terreno (m²)"        field="land_area"        value={property.land_area}         type="number" onSave={save}/>
            <F label="Área Garagem (m²)"           field="area_garage_m2"   value={property.area_garage_m2}    type="number" onSave={save}/>
            <F label="Área Arrumos/Anexo (m²)"     field="area_annex_m2"    value={property.area_annex_m2}     type="number" onSave={save}/>
            <F label="Área Caderneta Predial (m²)" field="area_caderneta"   value={property.area_caderneta}    type="number" onSave={save}/>
          </Section>
          <Section title="Tipo de Superfície Adoptada">
            <F label="Tipo de Superfície" field="tipo_superficie" value={property.tipo_superficie}
              opts={['Área bruta construída','Área bruta privativa','Área útil','Área do terreno']} onSave={save}/>
            <F label="Tipo de Parcela"    field="tipo_parcela"    value={property.tipo_parcela}   onSave={save}/>
          </Section>
        </>)}

        {/* SEC 7 ── Métodos de Avaliação */}
        {tab==='sec7' && (<>
          <Section title="Métodos">
            <F label="Método Principal"  field="metodo_avaliacao"   value={property.metodo_avaliacao}
              opts={['Comparação/Mercado','Rendimento','Custo','Residual estático','Residual dinâmico']} onSave={save}/>
            <F label="Método Secundário" field="metodo_avaliacao_2" value={property.metodo_avaliacao_2}
              opts={['Comparação/Mercado','Rendimento','Custo','Residual estático','Residual dinâmico','N/A']} onSave={save}/>
          </Section>
          <div className="mb-4">
            <label className="label">Justificação da escolha dos Métodos de Avaliação</label>
            <F label="" field="justificacao_metodo" value={property.justificacao_metodo} textarea span onSave={save}/>
          </div>
          <Section title="Valores por Método">
            <F label="Valor Comparativo Ajustado (€)"    field="valor_comparativo"       value={property.valor_comparativo}       type="number" onSave={save}/>
            <F label="Ajuste Aplicado (%)"               field="ajuste_comparativo"      value={property.ajuste_comparativo}      type="number" onSave={save}/>
            <F label="Valor Comparativo s/ Ajuste (€)"   field="valor_comparativo_bruto" value={property.valor_comparativo_bruto} type="number" onSave={save}/>
            <F label="Valor por Rendas (€)"              field="valor_rendas"            value={property.valor_rendas}            type="number" onSave={save}/>
            <F label="Valor Residual Dinâmico (€)"       field="valor_residual_din"      value={property.valor_residual_din}      type="number" onSave={save}/>
            <F label="Valor Patrimonial Tributário (€)"  field="valor_patrimonial"       value={property.valor_patrimonial}       type="number" onSave={save}/>
            <F label="Valor de Substituição Bruto (€)"   field="valor_subs_bruto"        value={property.valor_subs_bruto}        type="number" onSave={save}/>
            <F label="Valor de Substituição Líquido (€)" field="valor_subs_liquido"      value={property.valor_subs_liquido}      type="number" onSave={save}/>
            <F label="Valor Máximo Legal (€)"            field="valor_maximo_legal"      value={property.valor_maximo_legal}      type="number" onSave={save}/>
            <F label="Renda Ótima (€)"                   field="valor_renda_otima"       value={property.valor_renda_otima}       type="number" onSave={save}/>
          </Section>
        </>)}

        {/* SEC 8 ── Documentos Entregues */}
        {tab==='sec8' && (<>
          <Section title="Documentação">
            <F label="Caderneta Predial"              field="doc_caderneta"         value={property.doc_caderneta}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Certidão Permanente"            field="doc_certidao"          value={property.doc_certidao}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Licença de Utilização"          field="doc_licenca_util"      value={property.doc_licenca_util}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Licença de Construção"          field="doc_licenca_constr"    value={property.doc_licenca_constr}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Certificado Energético"         field="doc_cert_energetico"   value={property.doc_cert_energetico}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Planta do Imóvel"               field="doc_planta"            value={property.doc_planta}
              opts={['Entregue','Não entregue','N/A']} onSave={save}/>
            <F label="Tipo de Documento a Enviar"     field="tipo_doc_enviar"       value={property.tipo_doc_enviar}       onSave={save}/>
            <F label="Tipo de Documento a Descarregar" field="tipo_doc_descarregar" value={property.tipo_doc_descarregar}  onSave={save}/>
          </Section>
          <div className="mb-4">
            <label className="label">Notas sobre Documentação</label>
            <F label="" field="documentacao" value={property.documentacao} textarea span onSave={save}/>
          </div>
        </>)}

        {/* SEC 9 ── Condicionalismos */}
        {tab==='sec9' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Incluir esclarecimentos urbanísticos, diligências com organismos, data prevista de resolução.</p>
            <F label="Condicionalismos" field="prev_valuation_conditions" value={property.prev_valuation_conditions} textarea span onSave={save}/>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <F label="Data Prevista de Levantamento" field="data_levantamento_cond" value={property.data_levantamento_cond} type="date" onSave={save}/>
              <F label="Condicionante Sanável"         field="cond_sanavel"           value={property.cond_sanavel}
                opts={['Sim','Não']} onSave={save}/>
            </div>
          </div>
        )}

        {/* SEC 10 ── Advertências */}
        {tab==='sec10' && (
          <div className="space-y-4">
            <F label="Advertências e Considerações Gerais" field="advertencias" value={property.advertencias} textarea span onSave={save}/>
            <F label="Pressupostos de Avaliação"           field="pressupostos" value={property.pressupostos} textarea span onSave={save}/>
          </div>
        )}

        {/* SEC 11 ── Conclusão */}
        {tab==='sec11' && (
          <Section title="Valores de Conclusão">
            <F label="Valor de Mercado (€)"                         field="valor_mercado"            value={property.valor_mercado}            type="number" onSave={save}/>
            <F label="V.V.R. — Valor de Venda Rápida (€)"          field="valor_venda_rapida"       value={property.valor_venda_rapida}       type="number" onSave={save}/>
            <F label="Valor de Seguro (€)"                         field="valor_seguro"             value={property.valor_seguro}             type="number" onSave={save}/>
            <F label="Valor de Mercado Actual (€)"                 field="valor_mercado_atual"      value={property.valor_mercado_atual}      type="number" onSave={save}/>
            <F label="V.V.R. Actual (€)"                           field="valor_venda_rapida_atual" value={property.valor_venda_rapida_atual} type="number" onSave={save}/>
            <F label="% Obra Executada"                            field="pct_obra"                 value={property.pct_obra}                 type="number" onSave={save}/>
            <F label="Valor HEC — Hipótese Edifício Concluído (€)" field="valor_hec"               value={property.valor_hec}                type="number" onSave={save}/>
            <F label="Valor V.V.R. HEC (€)"                        field="valor_vvr_hec"            value={property.valor_vvr_hec}            type="number" onSave={save}/>
            <F label="Valor Empreendimento Completo HEC (€)"       field="valor_emp_hec"            value={property.valor_emp_hec}            type="number" onSave={save}/>
          </Section>
        )}

        {/* SEC 12 ── Justificação */}
        {tab==='sec12' && (
          <div className="space-y-4">
            <F label="Justificação da Escolha dos Métodos de Avaliação" field="justificacao_metodo" value={property.justificacao_metodo} textarea span onSave={save}/>
          </div>
        )}

        {/* SEC 13 ── Certificação */}
        {tab==='sec13' && (
          <Section title="Certificação e Assinatura">
            <F label="Data do Pedido"            field="data_pedido_relatorio" value={property.data_pedido_relatorio} type="date" onSave={save}/>
            <F label="Data da Visita"            field="data_visita"           value={property.data_visita}           type="date" onSave={save}/>
            <F label="Data de Conclusão/Entrega" field="data_conclusao"        value={property.data_conclusao}        type="date" onSave={save}/>
            <F label="Data de Certificação"      field="data_certificacao"     value={property.data_certificacao}     type="date" onSave={save}/>
            <F label="Data de Caducidade"        field="data_caducidade"       value={property.data_caducidade}       type="date" onSave={save}/>
            <F label="Data do Contrato"          field="data_contrato"         value={property.data_contrato}         type="date" onSave={save}/>
            <F label="Perito Avaliador"          field="perito_avaliador"      value={property.perito_avaliador}                 onSave={save}/>
            <F label="NIF do Perito"             field="perito_nif"            value={property.perito_nif}                       onSave={save}/>
            <F label="N.º CMVM"                  field="perito_cmvm"           value={property.perito_cmvm}                      onSave={save}/>
          </Section>
        )}

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
          <div className="space-y-4">
            <CompForm propertyId={property.id} onAdded={() => qc.invalidateQueries({ queryKey: ['property', id] })}/>
            {comps.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table-base text-xs">
                  <thead><tr>
                    <th>Portal</th><th>Ref.</th><th>Morada</th>
                    <th>Área (m²)</th><th>Preço (€)</th><th>€/m²</th><th>Notas</th><th></th>
                  </tr></thead>
                  <tbody>
                    {comps.map((c: any) => {
                      const epm2 = c.price&&c.area_m2 ? (parseFloat(c.price)/parseFloat(c.area_m2)).toFixed(2).replace('.',',') : '—'
                      return (
                        <tr key={c.id}>
                          <td>{c.portal||'—'}</td>
                          <td>{c.listing_ref ? <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{c.listing_ref}</a> : '—'}</td>
                          <td className="max-w-[120px] truncate">{c.address||'—'}</td>
                          <td>{c.area_m2 ? parseFloat(c.area_m2).toFixed(2).replace('.',',') : '—'}</td>
                          <td>{c.price ? formatCurrency(c.price) : '—'}</td>
                          <td>{epm2}</td>
                          <td className="max-w-[120px] truncate">{c.notes||'—'}</td>
                          <td><button className="text-red-400 hover:text-red-600" onClick={async () => {
                            if (confirm('Eliminar este comparável?')) {
                              await supabase.from('market_comps').delete().eq('id', c.id)
                              qc.invalidateQueries({ queryKey: ['property', id] })
                            }
                          }}><Trash2 size={12}/></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">Média €/m²: {(() => {
                  const valid = comps.filter((c: any) => c.price&&c.area_m2)
                  if (!valid.length) return '—'
                  const avg = valid.reduce((s: number, c: any) => s + parseFloat(c.price)/parseFloat(c.area_m2), 0) / valid.length
                  return avg.toFixed(2).replace('.',',') + ' €/m²'
                })()}</p>
              </div>
            )}
          </div>
        )}

        {/* SEC 17 ── Avaliação Anterior */}
        {tab==='sec17' && (
          <div className="space-y-6">
            <Section title="Avaliação Anterior">
              <F label="Data da Avaliação"   field="prev_valuation_date"   value={property.prev_valuation_date}   type="date"   onSave={save}/>
              <F label="Valor (€)"           field="prev_valuation_value"  value={property.prev_valuation_value}  type="number" onSave={save}/>
              <F label="Método"              field="prev_valuation_method" value={property.prev_valuation_method}               onSave={save}/>
              <F label="Perito Anterior"     field="prev_valuation_expert" value={property.prev_valuation_expert}               onSave={save}/>
              <F label="Entidade Anterior"   field="prev_valuation_entity" value={property.prev_valuation_entity}               onSave={save}/>
            </Section>

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

            {/* Dados originais da datatape */}
            {datatapeFields.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dados Originais da Data-tape</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {datatapeFields.map(([k,v]) => (
                    <div key={k} className="flex gap-2 px-2.5 py-1.5 bg-gray-50 rounded text-xs">
                      <span className="text-gray-400 font-mono min-w-[160px] flex-shrink-0">{k}</span>
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

// ── Formulário de comparável ───────────────────────────────────────────────
function CompForm({ propertyId, onAdded }: { propertyId: string; onAdded: () => void }) {
  const [form, setForm] = useState({ portal:'', listing_ref:'', url:'', address:'', area_m2:'', price:'', notes:'' })
  const [saving, setSaving] = useState(false)
  async function submit() {
    setSaving(true)
    const { error } = await supabase.from('market_comps').insert({ ...form, property_id: propertyId })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setForm({ portal:'', listing_ref:'', url:'', address:'', area_m2:'', price:'', notes:'' })
    onAdded(); toast.success('Comparável adicionado')
  }
  return (
    <div className="card">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Adicionar Comparável</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input className="input text-xs" placeholder="Portal" value={form.portal} onChange={e => setForm(f=>({...f,portal:e.target.value}))}/>
        <input className="input text-xs" placeholder="Ref. anúncio" value={form.listing_ref} onChange={e => setForm(f=>({...f,listing_ref:e.target.value}))}/>
        <input className="input text-xs col-span-2" placeholder="URL" value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))}/>
        <input className="input text-xs col-span-2" placeholder="Morada" value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))}/>
        <input className="input text-xs" placeholder="Área (m²)" type="number" value={form.area_m2} onChange={e => setForm(f=>({...f,area_m2:e.target.value}))}/>
        <input className="input text-xs" placeholder="Preço (€)" type="number" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))}/>
        <input className="input text-xs col-span-2 md:col-span-4" placeholder="Notas" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}/>
      </div>
      <button className="btn btn-primary text-xs mt-2" onClick={submit} disabled={saving}>
        {saving ? <Loader2 size={11} className="animate-spin"/> : 'Adicionar'}
      </button>
    </div>
  )
}
