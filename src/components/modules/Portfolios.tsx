import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, Badge } from '@/components/ui'
import { Plus, Trash2, ChevronRight, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { calculateFee } from '@/lib/feeCalculator'
import { CheckCircle, AlertCircle } from 'lucide-react'

const ALIASES: Record<string, string> = {
  // ABANCA exact column names
  'id_bien':                        'id_bien',
  'ID_BIEN':                        'id_bien',
  'referência ':                    'external_ref',
  'referência':                     'external_ref',
  'referencia ':                    'external_ref',
  'referencia':                     'external_ref',
  'documentação?':                  'documentacao',
  'documentacao?':                  'documentacao',
  'nome_distrito':                  'district',
  'nome_concelho':                  'municipality',
  'freguesia':                      'parish',
  'tipo_bien':                      'property_type',
  'subtipo_bien':                   'property_subtype',
  'uso_bien':                       'use_type',
  'subuso_bien':                    'use_subtype',
  'estado_bien':                    'property_state',
  'superficie_adoptada_finca':      'area_m2',
  'superficie_adoptada_garaje':     'area_garage_m2',
  'superficie_adoptada_trastero':   'area_annex_m2',
  'calle':                          'street',
  'numero':                         'number',
  'bloco':                          'block',
  'piso':                           'floor_letter',
  'codigo_postal':                  'postal_code',
  'avaliadora':                     'perito_avaliador',
  'empresa_tasadora':               'prev_valuation_entity',
  'fecha_tasacion':                 'prev_valuation_date',
  'tasacion':                       'prev_valuation_value',
  'fraccion_fiscal':                'fracao',
  'numero_registro_predial':        'id_registo_predial',
  'artigo_matricial_fiscal':        'id_registo_matricial',
  // Generic aliases
  'ref':                            'external_ref',
  'id':                             'external_ref',
  'rua':                            'street',
  'morada':                         'address',
  'endereco':                       'address',
  'address':                        'address',
  // Note: 'concelho'/'distrito' alone = numeric codes in ABANCA — map to code fields, not name fields
  // NOME_CONCELHO and NOME_DISTRITO are the actual names (mapped above)
  'municipio':                      'municipality',
  'municipality':                   'municipality',
  'district':                       'district',
  'cp':                             'postal_code',
  'cod postal':                     'postal_code',
  'codigo postal':                  'postal_code',
  'tipo de bem':                    'property_type',
  'tipo':                           'property_type',
  'subtipo':                        'property_subtype',
  'uso':                            'use_type',
  'subuso':                         'use_subtype',
  'estado do bem':                  'property_state',
  'estado':                         'property_state',
  'tipologia':                      'typology',
  'm2':                             'area_m2',
  'area m2':                        'area_m2',
  'area bruta':                     'gross_area',
  'm2 garagem':                     'area_garage_m2',
  'm2 anexo':                       'area_annex_m2',
  'area util':                      'useful_area',
  'area terreno':                   'land_area',
  'perito avaliador':               'perito_avaliador',
  'perito':                         'perito_avaliador',
  'avaliador':                      'perito_avaliador',
  'responsavel':                    'perito_avaliador',
  'honorario':                      'fee_amount',
  'fee':                            'fee_amount',
  'id registo predial':             'id_registo_predial',
  'id registo matricial':           'id_registo_matricial',
  'nuc_riesgo':                     'nuc_risco',
  'data de pedido':                 'data_pedido',
  'tipo_reevaluacion':              'tipo_reavaliacao',
  'tipovia':                        'tipo_via',
  'escalera':                       'escada',
  'ampliacion':                     'ampliacao',
  'lugar':                          'lugar',
}

const NUMERIC = ['area_m2','gross_area','useful_area','land_area','area_garage_m2','area_annex_m2','year_built','fee_amount','prev_valuation_value']
const FIELDS = [
  'external_ref','id_bien','id_registo_predial','id_registo_matricial','fracao',
  'street','number','block','floor_letter','address','parish','municipality','district','postal_code',
  'property_type','property_subtype','use_type','use_subtype','property_state','typology',
  'area_m2','gross_area','useful_area','land_area','area_garage_m2','area_annex_m2',
  'year_built','condition','fee_amount','perito_avaliador',
  'prev_valuation_date','prev_valuation_value','prev_valuation_method','prev_valuation_expert','prev_valuation_entity',
  'nuc_risco','data_pedido','tipo_via','escada','ampliacao','lugar','documentacao',
]

function norm(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'') }

const STATUS_OPTIONS = [
  { value:'active',           label:'Activo',            badge:'green'  },
  { value:'delivered',        label:'Entregue',          badge:'blue'   },
  { value:'awaiting_payment', label:'Aguarda Pagamento', badge:'amber'  },
  { value:'closed',           label:'Encerrado',         badge:'gray'   },
] as const
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s])) as Record<string, typeof STATUS_OPTIONS[number]>

function ImportPanel({ portfolioId, clientId, onClose, onDone }: { portfolioId:string; clientId:string; onClose:()=>void; onDone:()=>void }) {
  const [rows, setRows]         = useState<any[]>([])
  const [headers, setHeaders]   = useState<string[]>([])
  const [mapping, setMapping]   = useState<Record<string,string>>({})
  const [fileName, setFileName] = useState('')
  const [step, setStep]         = useState<'upload'|'map'|'preview'|'done'>('upload')
  const [preview, setPreview]   = useState<{newRows:any[];updates:any[];unchanged:any[]}>({newRows:[],updates:[],unchanged:[]})
  const [result, setResult]     = useState({imported:0,updated:0})
  const [feeScheduleId, setFeeScheduleId] = useState('')

  const { data: feeSchedules = [] } = useQuery({
    queryKey: ['fee-schedules'],
    queryFn: async () => { const {data} = await supabase.from('fee_schedules').select('*').eq('is_active',true); return (data||[]) as any[] }
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const wb   = XLSX.read(ev.target!.result, { type:'array', cellDates:true })
      const raw  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:null, raw:true }) as any[]
      // Filtra linhas completamente vazias (todas as colunas null ou string vazia)
      const data = raw.filter((row: any) =>
        Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null')
      )
      if (!data.length) { toast.error('Ficheiro vazio'); return }
      const hdrs = Object.keys(data[0])
      const map: Record<string,string> = {}
      hdrs.forEach(h => {
        const normalized = norm(h)
        const field = ALIASES[normalized] || ALIASES[h.trim()]
        if (field) map[h] = field
      })
      setHeaders(hdrs); setMapping(map); setRows(data); setStep('map')
    }
    reader.readAsArrayBuffer(file)
  }

  async function buildPreview() {
    // feeRules vazio → calculateFee usa a tabela hardcoded do precário ABANCA
    const feeRules: any[] = []

    // Get ALL existing properties for this portfolio with their id_bien
    const { data: existing } = await supabase
      .from('properties')
      .select('id, id_bien, external_ref')
      .eq('portfolio_id', portfolioId)

    const existMap: Record<string,string> = {}
    ;(existing||[]).forEach((p: any) => {
      if (p.id_bien) existMap[String(p.id_bien).trim()] = p.id
    })

    console.log(`Found ${Object.keys(existMap).length} existing records`)

    const newRows: any[] = [], updates: any[] = [], unchanged: any[] = []

    rows.forEach((row: any, i: number) => {
      const p: any = { datatape_data: row }
      Object.entries(mapping).forEach(([col, field]) => {
        if (!field || !col) return  // skip empty keys
        const v = row[col]
        if (v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null') {
          // Handle date fields: convert DD-MM-YYYY to YYYY-MM-DD
          const DATE_FIELDS_SET = new Set(['data_pedido','prev_valuation_date','visit_date'])
          if (DATE_FIELDS_SET.has(field)) {
            const s = String(v).trim()
            if (v instanceof Date || (typeof v === 'object' && v !== null)) {
              const d = new Date(v)
              p[field] = isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            } else {
              const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
              if (m) p[field] = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
              else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) p[field] = s
              else p[field] = null
            }
          } else {
            if (NUMERIC.includes(field)) {
              // Handle European number format: 99.000,00€ → 99000
              // Remove currency symbols, spaces, then handle . and ,
              const raw = String(v).replace(/[€$£\s]/g, '').trim()
              // If has both . and ,: . is thousands separator, , is decimal (PT format)
              // If has only .: could be decimal (EN) or thousands (PT) — if >3 digits after, it's thousands
              // If has only ,: decimal separator
              let normalized = raw
              if (raw.includes('.') && raw.includes(',')) {
                // PT format: 99.000,00 → remove dots, replace comma with dot
                normalized = raw.replace(/\./g, '').replace(',', '.')
              } else if (raw.includes(',') && !raw.includes('.')) {
                // Comma as decimal: 99,50 → 99.50
                normalized = raw.replace(',', '.')
              } else if (raw.includes('.')) {
                // Dot: check if thousands separator (e.g. 99.000 → digits after dot <= 3 and no more dots)
                const parts = raw.split('.')
                if (parts.length === 2 && parts[1].length <= 3 && parts[0].length >= 1) {
                  // Likely thousands separator: 99.000 → 99000
                  normalized = parts.join('')
                }
                // else treat as decimal: 99.5 stays
              }
              p[field] = parseFloat(normalized) || null
            } else {
              p[field] = String(v).trim()
            }
          }
        }
      })

      if (p.property_type && !p.fee_amount) {
        const tipo    = (p.property_type    || '').toUpperCase().trim()
        const subtipo = (p.property_subtype || '').toUpperCase().trim()
        let activity  = ''
        const area    = p.area_m2 || p.gross_area || 0

        if      (tipo === 'VIVIENDA (PISO)'       || tipo === 'VIVIENDA' || tipo === 'PISO' || tipo === 'ATICO' || tipo === 'DUPLEX' || tipo === 'ESTUDIO') activity = 'Apartamento'
        else if (tipo === 'VIVIENDA UNIFAMILIAR'  || tipo === 'CHALET'   || tipo === 'CASA')                                                               activity = 'Moradias unifamiliares'
        else if (tipo === 'CHALET ADOSADO'        || tipo === 'CHALET PAREADO' || tipo === 'CASA ADOSADA')                                                 activity = 'Moradias em banda'
        else if (tipo === 'GARAJE'                || tipo === 'PLAZA DE GARAJE')                                                                           activity = 'Garagem'
        else if (tipo === 'TRASTERO')                                                                                                                      activity = 'Arrumos'
        else if (tipo === 'LOCAL COMERCIAL'       || tipo === 'LOCAL'    || tipo === 'LOCAL DE NEGOCIO')                                                   activity = 'Loja'
        else if (tipo === 'OFICINA')                                                                                                                       activity = 'Escritórios'
        else if (tipo === 'NAVE'                  || tipo === 'NAVE INDUSTRIAL')                                                                           activity = 'Naves industriais'
        else if (tipo === 'EDIFICIO')                                                                                                                      activity = 'Edifício'
        else if (tipo === 'TERRENO') {
          activity = (subtipo === 'FINCA RÚSTICA' || subtipo === 'FINCA RUSTICA') ? 'Terreno rústico' : 'Terreno urbano'
        }
        else if (tipo === 'FINCA RÚSTICA'         || tipo === 'FINCA RUSTICA' || tipo === 'TERRENO FINCA RUSTICA' || tipo === 'TERRENO FINCA RÚSTICA')    activity = 'Terreno rústico'
        else if (tipo === 'SOLAR')                                                                                                                         activity = 'Terreno urbano'

        if (activity) {
          const fee = calculateFee(activity, area, feeRules, p.property_subtype || null, p.tipo_servico || null)
          if (fee) p.fee_amount = fee
        }
      }

      const idBien  = p.id_bien ? String(p.id_bien).trim() : null
      const extRef  = p.external_ref?.trim()
      const existId = idBien ? existMap[idBien] : null

      if (existId) {
        updates.push({ ...p, _id: existId, _ref: idBien || extRef })
      } else {
        newRows.push({ ...p, _ref: idBien || extRef || `linha ${i+1}` })
      }
    })

    console.log(`Preview: ${newRows.length} new, ${updates.length} updates`)
    setPreview({ newRows, updates, unchanged }); setStep('preview')
  }

  // Valid columns in the properties table — anything else goes to datatape_data only
  const VALID_PROPERTY_COLS = new Set([
    'external_ref','id_bien','street','number','block','floor_letter','fracao',
    'address','parish','municipality','district','postal_code',
    'property_type','property_subtype','use_type','use_subtype','property_state',
    'typology','year_built','condition','area_m2','gross_area','useful_area',
    'land_area','area_garage_m2','area_annex_m2','fee_amount',
    'perito_avaliador','id_registo_predial','id_registo_matricial',
    'prev_valuation_date','prev_valuation_value','prev_valuation_method','prev_valuation_expert','prev_valuation_entity',
    'nuc_risco','data_pedido','tipo_via','escada','ampliacao','lugar','documentacao',
  ])

  function sanitiseForDB(p: any) {
    const clean: any = {}
    Object.entries(p).forEach(([k, v]) => {
      // Skip internal markers, empty keys, and unknown columns
      if (!k || k.startsWith('_')) return
      if (k === 'datatape_data') { clean[k] = v; return }
      if (VALID_PROPERTY_COLS.has(k)) clean[k] = v
      // Everything else stays only in datatape_data
    })
    return clean
  }

  async function doImport() {
    let imported = 0, updated = 0

    if (preview.newRows.length) {
      const toInsert = preview.newRows.map((p: any, i: number) => {
        const { _ref, ...rest } = p
        const safe = sanitiseForDB(rest)
        return { ...safe, portfolio_id: portfolioId, client_id: clientId, ref: `AV-${String(i+1).padStart(4,'0')}` }
      })
      for (let i = 0; i < toInsert.length; i += 100) {
        const { error } = await supabase.from('properties').insert(toInsert.slice(i, i+100))
        if (error) { toast.error(error.message); return }
        imported += Math.min(100, toInsert.length - i)
      }
    }

    for (const p of preview.updates) {
      const { _id, _ref, ...fields } = p
      const safe = sanitiseForDB(fields)
      const { error } = await supabase.from('properties').update(safe).eq('id', _id)
      if (error) { toast.error(error.message); return }
      updated++
    }

    await supabase.from('datatape_imports').insert({
      portfolio_id: portfolioId, file_name: fileName,
      row_count: rows.length, imported_count: imported + updated
    })

    setResult({ imported, updated }); setStep('done')
    toast.success(`${imported} novos · ${updated} actualizados`)
    onDone()
  }

  const refFieldMapped = Object.values(mapping).includes('id_bien')

  return (
    <div className="mt-3 border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Importar / actualizar data-tape</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15}/></button>
      </div>

      {step === 'upload' && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:border-brand-300 transition-colors">
          <Upload size={20} className="text-gray-300 mb-2"/>
          <p className="text-xs text-gray-500">Clica para seleccionar o Excel</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile}/>
        </label>
      )}

      {step === 'map' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{fileName} · {rows.length} linhas · {Object.values(mapping).filter(Boolean).length} mapeadas</p>

          {!refFieldMapped && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ Nenhuma coluna mapeada para <strong>id_bien</strong>. Sem o ID do Bem, o sistema não consegue detectar duplicados e criará sempre novos registos. Verifica o mapeamento da coluna <strong>ID_BIEN</strong>.
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Precário (honorários automáticos)</label>
            <select className="input text-xs" value={feeScheduleId} onChange={e => setFeeScheduleId(e.target.value)}>
              <option value="">Sem cálculo automático</option>
              {feeSchedules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg bg-white p-2">
            {headers.map(h => (
              <div key={h} className="flex items-center gap-2">
                <span className={`text-xs font-mono w-36 truncate px-1 py-0.5 rounded ${mapping[h]==='id_bien'?'bg-brand-50 text-brand-700':'text-gray-400 bg-gray-50'}`}>{h}</span>
                <select className="input flex-1 text-xs py-0.5" value={mapping[h]||''} onChange={e => setMapping(prev => ({...prev,[h]:e.target.value}))}>
                  <option value="">(ignorar)</option>
                  {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {mapping[h]==='id_bien'
                  ? <span className="text-xs text-brand-600 font-bold flex-shrink-0">KEY</span>
                  : mapping[h]
                    ? <CheckCircle size={12} className="text-emerald-400 flex-shrink-0"/>
                    : <AlertCircle size={12} className="text-gray-200 flex-shrink-0"/>
                }
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn text-xs py-1" onClick={() => setStep('upload')}>← Voltar</button>
            <button className="btn btn-primary text-xs py-1" onClick={buildPreview}>Verificar →</button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-emerald-50 rounded-lg p-2"><p className="text-lg font-semibold text-emerald-600">{preview.newRows.length}</p><p className="text-xs text-gray-500">Novos</p></div>
            <div className="bg-amber-50 rounded-lg p-2"><p className="text-lg font-semibold text-amber-600">{preview.updates.length}</p><p className="text-xs text-gray-500">Actualizados</p></div>
          </div>
          {preview.updates.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto">
              <p className="text-xs font-medium text-gray-600 mb-1">A actualizar:</p>
              {preview.updates.slice(0,10).map((p: any, i: number) => (
                <p key={i} className="text-xs text-gray-500 font-mono">{p._ref}</p>
              ))}
              {preview.updates.length > 10 && <p className="text-xs text-gray-400">…e mais {preview.updates.length-10}</p>}
            </div>
          )}
          {!refFieldMapped && preview.newRows.length > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Sem campo de referência mapeado — todos os registos serão tratados como novos.
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn text-xs py-1" onClick={() => setStep('map')}>← Voltar</button>
            <button className="btn btn-primary text-xs py-1" onClick={doImport}
              disabled={preview.newRows.length + preview.updates.length === 0}>
              Confirmar importação
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-3">
          <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2"/>
          <p className="text-sm font-medium">{result.imported} novos · {result.updated} actualizados</p>
          <div className="flex justify-center gap-2 mt-3">
            <button className="btn text-xs py-1" onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setMapping({}) }}>Nova importação</button>
            <Link to="/properties" className="btn btn-primary text-xs py-1">Ver imóveis →</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Portfolios() {
  const qc = useQueryClient()
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState({ client_id:'', name:'', description:'', deadline:'', status:'active', type:'datatape' })
  const [openImport, setOpenImport] = useState<string|null>(null)

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('*, clients(name, id), properties(count)').order('created_at', { ascending:false })
      return (data||[]) as any[]
    }
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: async () => { const {data} = await supabase.from('clients').select('id, name').order('name'); return (data||[]) as any[] }
  })

  const create = useMutation({
    mutationFn: async () => {
      // deadline vazio → null para evitar "invalid input syntax for type date: ''"
      const payload = { ...form, deadline: form.deadline || null }
      const {error} = await supabase.from('portfolios').insert(payload)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['portfolios'] }); toast.success('Projeto criado'); setModal(false); setForm({ client_id:'', name:'', description:'', deadline:'', status:'active', type:'datatape' }) },
    onError: (e: any) => toast.error(e.message)
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id:string; status:string }) => {
      const { error } = await supabase.from('portfolios').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['portfolios'] }) },
    onError: (e: any) => toast.error(e.message)
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { data: props } = await supabase.from('properties').select('id').eq('portfolio_id', id)
      const ids = (props||[]).map((p: any) => p.id)
      if (ids.length) {
        const { data: photos } = await supabase.from('property_photos').select('storage_path').in('property_id', ids)
        if (photos?.length) await supabase.storage.from('photos').remove(photos.map((p: any) => p.storage_path))
        await supabase.from('property_photos').delete().in('property_id', ids)
        await supabase.from('market_comps').delete().in('property_id', ids)
        await supabase.from('properties').delete().in('id', ids)
      }
      await supabase.from('datatape_imports').delete().eq('portfolio_id', id)
      const { error } = await supabase.from('portfolios').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['portfolios'] }); toast.success('Projeto eliminado') },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <div>
      <PageHeader title="Projetos" subtitle="Mandatos, data-tapes e pedidos adhoc por cliente"
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Novo projeto</button>}
      />
      <div className="p-6">
        {isLoading ? <p className="text-sm text-gray-400">A carregar…</p>
          : portfolios.length === 0 ? <EmptyState message="Sem projetos criados ainda."/>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {portfolios.map((p: any) => {
                const statusInfo = STATUS_MAP[p.status] || STATUS_MAP['active']
                return (
                  <div key={p.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.clients?.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={statusInfo.badge as any}>{statusInfo.label}</Badge>
                        <button className="btn p-1.5 text-red-400 hover:bg-red-50 border-0 ml-1"
                          onClick={() => { if (confirm(`Eliminar "${p.name}" e todos os imóveis? Esta acção é irreversível.`)) del.mutate(p.id) }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>

                    {p.description && <p className="text-xs text-gray-500">{p.description}</p>}

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Estado</label>
                      <select className="input text-xs py-1.5" value={p.status||'active'}
                        onChange={e => updateStatus.mutate({ id:p.id, status:e.target.value })}>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                      <span>{p.properties?.[0]?.count || 0} imóveis</span>
                      {p.deadline && <span>Prazo: {p.deadline}</span>}
                      <Link to={`/properties?portfolio=${p.id}`} className="text-brand-500 flex items-center gap-0.5 hover:underline">
                        Ver imóveis <ChevronRight size={11}/>
                      </Link>
                    </div>

                    {openImport === p.id ? (
                      <ImportPanel
                        portfolioId={p.id}
                        clientId={p.clients?.id || ''}
                        onClose={() => setOpenImport(null)}
                        onDone={() => { qc.invalidateQueries({ queryKey:['portfolios'] }); setOpenImport(null) }}
                      />
                    ) : p.type === 'adhoc' ? (
                      <Link to={`/properties/new?portfolio=${p.id}&client=${p.clients?.id || ''}`}
                        className="btn text-xs w-full flex items-center justify-center gap-1.5 border-dashed">
                        <Plus size={13}/> Adicionar imóvel
                      </Link>
                    ) : (
                      <button className="btn text-xs w-full flex items-center justify-center gap-1.5 border-dashed"
                        onClick={() => setOpenImport(p.id)}>
                        <Upload size={13}/> Importar / actualizar data-tape
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold mb-5">Novo projeto</h2>
            <div className="space-y-3">
              {/* Tipo de projeto */}
              <div>
                <label className="label">Tipo de projeto *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({...f, type:'datatape'}))}
                    className={`flex-1 border rounded-lg px-3 py-2 text-xs text-left transition-colors ${form.type==='datatape' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <p className="font-semibold">Portfólio / Data-tape</p>
                    <p className="text-gray-400 mt-0.5">Importação massiva via ficheiro Excel</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({...f, type:'adhoc'}))}
                    className={`flex-1 border rounded-lg px-3 py-2 text-xs text-left transition-colors ${form.type==='adhoc' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <p className="font-semibold">Pedidos Individuais</p>
                    <p className="text-gray-400 mt-0.5">Imóveis criados individualmente</p>
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Cliente *</label>
                <select className="input" value={form.client_id} onChange={e => setForm(f => ({...f, client_id:e.target.value}))}>
                  <option value="">Seleccionar…</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}/></div>
              <div><label className="label">Descrição</label><input className="input" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))}/></div>
              <div><label className="label">Prazo</label><input type="date" className="input" value={form.deadline} onChange={e => setForm(f => ({...f, deadline:e.target.value}))}/></div>
              <div>
                <label className="label">Estado</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => create.mutate()} disabled={!form.client_id || !form.name || create.isPending}>
                {create.isPending ? 'A criar…' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
