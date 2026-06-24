import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { FileSpreadsheet, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react'
import { calculateFee } from '@/lib/feeCalculator'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const ALIASES: Record<string, string> = {
  'referencia':'external_ref','ref':'external_ref','id':'external_ref','codigo':'external_ref','bem':'external_ref','n bem':'external_ref','nr bem':'external_ref',
  'rua':'street','street':'street','numero':'number','n':'number','bloco':'block','letra':'floor_letter','fraccao':'fracao','fracao':'fracao',
  'morada':'address','endereco':'address','address':'address',
  'freguesia':'parish','parish':'parish',
  'concelho':'municipality','municipio':'municipality','municipality':'municipality',
  'distrito':'district','district':'district',
  'codigo postal':'postal_code','cp':'postal_code','cod postal':'postal_code',
  'tipo de bem':'property_type','tipo':'property_type','type':'property_type',
  'subtipo':'property_subtype','subtipo de bem':'property_subtype',
  'uso':'use_type','uso do bem':'use_type','subuso':'use_subtype',
  'estado do bem':'property_state','estado':'property_state',
  'tipologia':'typology','typology':'typology',
  'm2':'area_m2','area m2':'area_m2','area':'area_m2','area bruta':'gross_area',
  'm2 garagem':'area_garage_m2','garagem m2':'area_garage_m2',
  'm2 anexo':'area_annex_m2','anexo m2':'area_annex_m2',
  'area util':'useful_area','area terreno':'land_area',
  'perito avaliador':'perito_avaliador','perito':'perito_avaliador','avaliador':'perito_avaliador','responsavel':'perito_avaliador',
  'honorario':'fee_amount','fee':'fee_amount','valor':'fee_amount',
  'id registo predial':'id_registo_predial','registo predial':'id_registo_predial',
  'id registo matricial':'id_registo_matricial','artigo':'id_registo_matricial',
}
const NUMERIC = ['area_m2','gross_area','useful_area','land_area','area_garage_m2','area_annex_m2','floor','year_built','fee_amount']
const FIELDS = [
  'external_ref','street','number','block','floor_letter','fracao','address','parish','municipality','district','postal_code',
  'property_type','property_subtype','use_type','use_subtype','property_state','typology',
  'area_m2','gross_area','useful_area','land_area','area_garage_m2','area_annex_m2',
  'year_built','condition','fee_amount','perito_avaliador','id_registo_predial','id_registo_matricial',
]
function norm(s: string) { return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'') }

type Step = 'upload' | 'map' | 'preview' | 'done'

export default function DataTapeImport() {
  const qc = useQueryClient()
  const [rows, setRows]           = useState<any[]>([])
  const [headers, setHeaders]     = useState<string[]>([])
  const [mapping, setMapping]     = useState<Record<string,string>>({})
  const [fileName, setFileName]   = useState('')
  const [portfolioId, setPId]     = useState('')
  const [step, setStep]           = useState<Step>('upload')
  const [preview, setPreview]     = useState<{new:any[]; updates:any[]; unchanged:any[]}>({ new:[], updates:[], unchanged:[] })
  const [importResult, setResult] = useState({ imported:0, updated:0 })
  const [feeSchedule, setFeeSchedule] = useState<any>(null)

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('id, name, clients(name, id)').eq('status','active').order('name')
      return (data||[]) as any[]
    }
  })

  const { data: feeSchedules = [] } = useQuery({
    queryKey: ['fee-schedules'],
    queryFn: async () => {
      const { data } = await supabase.from('fee_schedules').select('*').eq('is_active', true)
      return (data||[]) as any[]
    }
  })

  // Delete entire portfolio
  const deletePortfolio = useMutation({
    mutationFn: async (pid: string) => {
      // Get all property IDs
      const { data: props } = await supabase.from('properties').select('id').eq('portfolio_id', pid)
      const ids = (props||[]).map((p: any) => p.id)
      if (ids.length) {
        // Delete photos from storage
        const { data: photos } = await supabase.from('property_photos').select('storage_path').in('property_id', ids)
        if (photos?.length) {
          await supabase.storage.from('photos').remove(photos.map((p: any) => p.storage_path))
        }
        // Delete prev reports
        const { data: prevReports } = await supabase.from('properties').select('prev_valuation_report_path').in('id', ids).not('prev_valuation_report_path','is',null)
        if (prevReports?.length) {
          await supabase.storage.from('prev-reports').remove(prevReports.map((p: any) => p.prev_valuation_report_path))
        }
        await supabase.from('property_photos').delete().in('property_id', ids)
        await supabase.from('market_comps').delete().in('property_id', ids)
        await supabase.from('properties').delete().in('id', ids)
      }
      await supabase.from('datatape_imports').delete().eq('portfolio_id', pid)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties-all'] }); toast.success('Portfólio e imóveis eliminados') },
    onError: (e: any) => toast.error(e.message)
  })

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]; if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const wb   = XLSX.read(e.target!.result, { type:'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:null }) as any[]
      if (!data.length) { toast.error('Ficheiro vazio'); return }
      const hdrs = Object.keys(data[0])
      const map: Record<string,string> = {}
      hdrs.forEach(h => { const a = ALIASES[norm(h)]; if (a) map[h] = a })
      setHeaders(hdrs); setMapping(map); setRows(data); setStep('map')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':[],'application/vnd.ms-excel':[]}, maxFiles:1
  })

  async function buildPreview() {
    if (!portfolioId) { toast.error('Selecciona um portfólio'); return }

    // Get fee rules if schedule selected
    let feeRules: any[] = []
    if (feeSchedule) {
      const sched = feeSchedules.find((s: any) => s.id === feeSchedule)
      feeRules = sched?.rules || []
    }

    // Get existing properties for this portfolio
    const { data: existing } = await supabase.from('properties').select('id, external_ref, datatape_data').eq('portfolio_id', portfolioId)
    const existingMap: Record<string, any> = {}
    ;(existing||[]).forEach((p: any) => { if (p.external_ref) existingMap[p.external_ref] = p })

    const newRows: any[]      = []
    const updateRows: any[]   = []
    const unchangedRows: any[]= []

    rows.forEach((row: any, i: number) => {
      const p: any = { datatape_data: row }
      Object.entries(mapping).forEach(([col, field]) => {
        const v = row[col]
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          p[field] = NUMERIC.includes(field) ? (parseFloat(String(v)) || null) : String(v).trim()
        }
      })

      // Auto fee
      if (feeRules.length && p.property_type && !p.fee_amount) {
        const fee = calculateFee(p.property_type, p.area_m2 || p.gross_area, feeRules)
        if (fee) p.fee_amount = fee
      }

      const extRef = p.external_ref
      if (extRef && existingMap[extRef]) {
        // Check for changes
        const existing = existingMap[extRef]
        const changed = Object.keys(p).some(k => k !== 'datatape_data' && String(p[k]||'') !== String((existing as any)[k]||''))
        if (changed) updateRows.push({ ...p, _existing_id: existing.id, _ref: extRef || `linha ${i+1}` })
        else         unchangedRows.push({ ...p, _ref: extRef || `linha ${i+1}` })
      } else {
        newRows.push({ ...p, _ref: extRef || `linha ${i+1}` })
      }
    })

    setPreview({ new: newRows, updates: updateRows, unchanged: unchangedRows })
    setStep('preview')
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!portfolioId) throw new Error('Selecciona um portfólio')
      const { data: pf } = await supabase.from('portfolios').select('client_id').eq('id', portfolioId).single()
      if (!pf) throw new Error('Portfólio não encontrado')

      let imported = 0, updated = 0

      // Insert new
      if (preview.new.length) {
        const toInsert = preview.new.map((p: any, i: number) => {
          const { _ref, ...rest } = p
          return { ...rest, portfolio_id: portfolioId, client_id: pf.client_id, ref: `AV-${String(i+1).padStart(4,'0')}` }
        })
        for (let i = 0; i < toInsert.length; i += 100) {
          const { error } = await supabase.from('properties').insert(toInsert.slice(i, i+100))
          if (error) throw error
          imported += Math.min(100, toInsert.length - i)
        }
      }

      // Update existing
      for (const p of preview.updates) {
        const { _existing_id, _ref, ...fields } = p
        const { error } = await supabase.from('properties').update(fields).eq('id', _existing_id)
        if (error) throw error
        updated++
      }

      await supabase.from('datatape_imports').insert({
        portfolio_id: portfolioId, file_name: fileName,
        row_count: rows.length, imported_count: imported + updated,
      })
      return { imported, updated }
    },
    onSuccess: ({ imported, updated }) => {
      qc.invalidateQueries({ queryKey: ['properties-all'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setResult({ imported, updated }); setStep('done')
      toast.success(`${imported} novos · ${updated} actualizados`)
    },
    onError: (e: any) => toast.error(e.message)
  })

  function reset() { setStep('upload'); setRows([]); setHeaders([]); setMapping({}); setPreview({ new:[], updates:[], unchanged:[] }) }

  // Portfolio management tab
  const [showManage, setShowManage] = useState(false)
  const { data: portfoliosWithCount = [] } = useQuery({
    queryKey: ['portfolios-manage'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('id, name, clients(name), properties(count)').order('name')
      return (data||[]) as any[]
    }
  })

  return (
    <div>
      <PageHeader title="Importar / Gerir data-tape" subtitle="Excel com o portfólio de imóveis"
        actions={
          <button className={`btn ${showManage ? 'btn-primary' : ''}`} onClick={() => setShowManage(m => !m)}>
            <Trash2 size={14}/> Gerir portfólios
          </button>
        }
      />
      <div className="p-6 max-w-4xl space-y-6">

        {/* Manage portfolios panel */}
        {showManage && (
          <div className="card border-red-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Trash2 size={14} className="text-red-500"/> Eliminar portfólio e todos os imóveis
            </h3>
            <p className="text-xs text-red-600 mb-3">Atenção — esta acção elimina permanentemente todos os imóveis, fotos e comparáveis do portfólio.</p>
            <div className="space-y-2">
              {portfoliosWithCount.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.clients?.name}</span>
                    <span className="badge badge-gray ml-2">{p.properties?.[0]?.count || 0} imóveis</span>
                  </div>
                  <button className="btn text-xs text-red-500 hover:bg-red-50 border-red-200"
                    onClick={() => { if (confirm(`Eliminar "${p.name}" e TODOS os imóveis? Esta acção é irreversível.`)) deletePortfolio.mutate(p.id) }}>
                    <Trash2 size={12}/> Eliminar tudo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive?'border-brand-400 bg-brand-50':'border-gray-200 hover:border-brand-300'}`}>
            <input {...getInputProps()}/>
            <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-sm text-gray-600 font-medium">Arrasta o ficheiro Excel aqui</p>
            <p className="text-xs text-gray-400 mt-1">ou clica para seleccionar · .xlsx / .xls</p>
          </div>
        )}

        {/* STEP: Map */}
        {step === 'map' && (
          <div className="space-y-5">
            <div className="card flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-brand-400"/>
              <div className="flex-1">
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-gray-500">{rows.length} linhas · {Object.values(mapping).filter(Boolean).length} colunas mapeadas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Portfólio de destino *</label>
                <select className="input" value={portfolioId} onChange={e => setPId(e.target.value)}>
                  <option value="">Seleccionar portfólio…</option>
                  {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.clients?.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Precário para calcular honorários</label>
                <select className="input" value={feeSchedule||''} onChange={e => setFeeSchedule(e.target.value||null)}>
                  <option value="">Não calcular automaticamente</option>
                  {feeSchedules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Mapeamento de colunas <span className="font-normal text-gray-400 ml-2">({Object.values(mapping).filter(Boolean).length} de {headers.length} auto-detectadas)</span>
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-44 truncate font-mono bg-gray-50 px-2 py-1 rounded">{h}</span>
                    <span className="text-gray-300 text-xs">→</span>
                    <select className="input flex-1 text-xs" value={mapping[h]||''} onChange={e => setMapping(prev => ({...prev, [h]:e.target.value}))}>
                      <option value="">(ignorar)</option>
                      {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {mapping[h] ? <CheckCircle size={14} className="text-emerald-500 flex-shrink-0"/> : <AlertCircle size={14} className="text-gray-200 flex-shrink-0"/>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button className="btn" onClick={reset}>Cancelar</button>
              <button className="btn btn-primary" onClick={buildPreview} disabled={!portfolioId}>
                Verificar alterações →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <p className="text-2xl font-semibold text-emerald-600">{preview.new.length}</p>
                <p className="text-xs text-gray-500 mt-1">Novos imóveis</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-semibold text-amber-600">{preview.updates.length}</p>
                <p className="text-xs text-gray-500 mt-1">Com alterações</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-semibold text-gray-400">{preview.unchanged.length}</p>
                <p className="text-xs text-gray-500 mt-1">Sem alterações</p>
              </div>
            </div>

            {preview.updates.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                  <RefreshCw size={14}/> Imóveis que vão ser actualizados ({preview.updates.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {preview.updates.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                      <span className="font-mono text-gray-600">{p._ref}</span>
                      <span className="text-amber-600">dados actualizados</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.new.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-emerald-700 mb-3">Novos imóveis a criar ({preview.new.length})</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {preview.new.slice(0,20).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                      <span className="font-mono text-gray-600">{p._ref}</span>
                      <span className="text-gray-500">{p.property_type||''} {p.municipality||''}</span>
                      {p.fee_amount && <span className="text-emerald-600 font-medium">{p.fee_amount}€</span>}
                    </div>
                  ))}
                  {preview.new.length > 20 && <p className="text-xs text-gray-400 pt-1">… e mais {preview.new.length - 20}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn" onClick={() => setStep('map')}>← Voltar</button>
              <button className="btn btn-primary" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || (preview.new.length === 0 && preview.updates.length === 0)}>
                {importMutation.isPending ? 'A importar…' : `Confirmar importação (${preview.new.length + preview.updates.length} registos)`}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Done */}
        {step === 'done' && (
          <div className="card text-center py-10">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3"/>
            <p className="text-base font-semibold text-gray-900">Importação concluída</p>
            <div className="flex justify-center gap-6 mt-3">
              <div><p className="text-2xl font-semibold text-emerald-600">{importResult.imported}</p><p className="text-xs text-gray-500">novos</p></div>
              <div><p className="text-2xl font-semibold text-amber-600">{importResult.updated}</p><p className="text-xs text-gray-500">actualizados</p></div>
            </div>
            <div className="flex justify-center gap-3 mt-5">
              <button className="btn" onClick={reset}>Nova importação</button>
              <a href="/properties" className="btn btn-primary">Ver imóveis →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
