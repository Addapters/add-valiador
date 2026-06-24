import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { FileSpreadsheet, CheckCircle, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

// Mapping from Excel column letter/name to DB field
const COL_MAP: Record<string, string> = {
  'ID_BIEN':                        'id_bem',
  'NUC_RIESGO':                     'nuc_risco',
  'Data de Pedido':                 'data_pedido',
  'Referência ':                    'referencia',
  'Referência':                     'referencia',
  'NOME_DISTRITO':                  'distrito',
  'NOME_CONCELHO':                  'concelho',
  'FREGUESIA':                      'freguesia',
  'TIPO_BIEN':                      'tipo_bem',
  'SUBTIPO_BIEN':                   'subtipo_bem',
  'USO_BIEN':                       'uso_bem',
  'SUBUSO_BIEN':                    'subuso_bem',
  'ESTADO_BIEN':                    'estado_bem',
  'TIPO_REEVALUACION':              'tipo_reavaliacao',
  'SUPERFICIE_ADOPTADA_FINCA':      'area_finca',
  'SUPERFICIE_ADOPTADA_GARAJE':     'area_garagem',
  'SUPERFICIE_ADOPTADA_TRASTERO':   'area_arrumos',
  'TIPOVIA':                        'tipo_via',
  'CALLE':                          'rua',
  'NUMERO':                         'numero',
  'BLOCO':                          'bloco',
  'PORTAL':                         'portal',
  'ESCALERA':                       'escada',
  'PISO':                           'piso',
  'LETRA':                          'letra',
  'AMPLIACION':                     'ampliacao',
  'LUGAR':                          'lugar',
  'CONCELHO':                       'concelho_codigo',
  'DISTRITO':                       'distrito_codigo',
  'DESCRIPCION':                    'descricao',
  'CODIGO_POSTAL':                  'codigo_postal',
  'PAIS_ID':                        'pais',
  'NUMERO_CONSERVATORIA_REGISTRO':  'conservatoria_numero',
  'NOME_CONSERVATORIA_REGISTRO':    'conservatoria_nome',
  'NUMERO_REGISTRO_PREDIAL':        'registo_predial_numero',
  'FREGUESIA_REGISTRO_PREDIAL':     'registo_predial_freguesia',
  'CONCELHO_REGISTRO_PREDIAL':      'registo_predial_concelho',
  'DISTRITO_REGISTRO_PREDIAL':      'registo_predial_distrito',
  'ARTIGO_MATRICIAL_FISCAL':        'artigo_matricial',
  'artigo_registral':               'artigo_registral',
  'FRACCION_FISCAL':                'fraccao_fiscal',
  'SECCION_FISCAL':                 'seccao_fiscal',
  'FREGUESIA_FISCAL':               'freguesia_fiscal',
  'CONCELHO_FISCAL':                'concelho_fiscal',
  'descricao_registro':             'descricao_registo',
  'RP_CODIGO':                      'rp_codigo',
  'CODIGOREGISTRO':                 'codigo_registo',
  'RP_SECCION':                     'rp_seccao',
  'RP_LIBRO':                       'rp_livro',
  'LIBROREGISTRO':                  'livro_registo',
  'RP_TOMO':                        'rp_tomo',
  'TOMOREGISTRO':                   'tomo_registo',
  'RP_FOLIO':                       'rp_folio',
  'FOLIOREGISTRO':                  'folio_registo',
  'BIEN_MATRIZ':                    'bem_matriz',
  'IDUFIR':                         'idufir',
  'RF_FREGUESIA':                   'rf_freguesia',
  'RF_CONCELLO':                    'rf_concelho',
  'REFERENCIA_CATASTRAL':           'referencia_cadastral',
  'NUC_TASACION':                   'nuc_avaliacao',
  'REFERENCIA_TASACION':            'referencia_avaliacao',
  'FECHA_TASACION':                 'data_avaliacao',
  'EMPRESA_TASADORA':               'empresa_avaliadora',
  'TASADORA':                       'avaliadora_codigo',
  'BIEN_TASACION':                  'bem_avaliacao',
  'TASACION':                       'valor_avaliacao',
  'TASACION_TRASTERO':              'valor_avaliacao_arrumos',
  'TASACION_GARAJE':                'valor_avaliacao_garagem',
  'VALOR_HIPOTESIS_TERMINADO':      'valor_hipotese_terminado',
  'VALOR_HIPOTESIS_TRASTERO':       'valor_hipotese_arrumos',
  'VALOR_HIPOTESIS_GARAJE':         'valor_hipotese_garagem',
  'VALOR_MET':                      'valor_met',
  'VALOR_MET_TRASTERO':             'valor_met_arrumos',
  'VALOR_MET_GARAJE':               'valor_met_garagem',
  'FECHA_TASACION_MET':             'data_avaliacao_met',
  'REFERENCIA_TASACION_MET':        'referencia_avaliacao_met',
  'EMPRESA_TASADORA_MET':           'empresa_avaliadora_met',
  'FECHA_CAIDA_SIGNIFICATIVA':      'data_queda_significativa',
  'VALOR_CAIDA_SIGNIFICATIVA':      'valor_queda_significativa',
  'VALOR_CAIDA_SIGNIFICATIVA_TRASTERO': 'valor_queda_arrumos',
  'VALOR_CAIDA_SIGNIFICATIVA_GARAJE':   'valor_queda_garagem',
  'ULTIMO_VLOR_TAS_COMPLETA_BIEN':  'ultimo_valor_avaliacao_completa',
  'FC_ULTIMO_VLOR_TAS_COMPLETA':    'data_ultimo_valor_completa',
  'ULTIMO_VLOR_TAS_AUTOMATICA_BIEN':'ultimo_valor_avaliacao_automatica',
  'FC_ULTIMO_VLOR_TAS_AUTOMATICA':  'data_ultimo_valor_automatica',
  'TOTAL_VT_COMPLETA':              'total_vt_completa',
  'TOTAL_VT_AVM':                   'total_vt_avm',
  'TAB_ULT_FECHA':                  'tab_ultima_data',
  'TAB_ULT_VT':                     'tab_ultimo_valor',
  'Documentação?':                  'documentacao',
  'Tipo de Avaliacão':              'tipo_avaliacao',
  'Avaliadora':                     'avaliadora',
}

const DATE_FIELDS = new Set(['data_pedido','data_avaliacao','data_queda_significativa','data_ultimo_valor_completa','tab_ultima_data'])
const NUMERIC_FIELDS = new Set(['area_finca','area_garagem','area_arrumos'])

function formatDate(v: any): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'string' && v !== '?') return v
  return null
}

function formatValue(field: string, v: any): any {
  if (v === null || v === undefined || v === '?') return null
  if (DATE_FIELDS.has(field))    return formatDate(v)
  if (NUMERIC_FIELDS.has(field)) return typeof v === 'number' ? v : (parseFloat(String(v)) || null)
  return String(v).trim() || null
}

type Step = 'upload' | 'confirm' | 'done'

export default function AbancaImport() {
  const qc = useQueryClient()
  const [rows, setRows]         = useState<any[]>([])
  const [headers, setHeaders]   = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [portfolioId, setPId]   = useState('')
  const [step, setStep]         = useState<Step>('upload')
  const [existing, setExisting] = useState<{new:number; update:number}>({new:0,update:0})

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios-simple'],
    queryFn: async () => {
      const {data} = await supabase.from('portfolios').select('id, name, clients(name)').order('name')
      return (data||[]) as any[]
    }
  })

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]; if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const wb   = XLSX.read(e.target!.result, { type:'array', cellDates:true })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval:null, raw:false }) as any[]
      if (!data.length) { toast.error('Ficheiro vazio'); return }
      setHeaders(Object.keys(data[0]))
      setRows(data)
      setStep('confirm')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':[],'application/vnd.ms-excel':[]}, maxFiles:1
  })

  async function checkExisting() {
    if (!portfolioId) { toast.error('Selecciona um portfólio'); return }
    const {data} = await supabase.from('abanca_datatape').select('id_bem, referencia').eq('portfolio_id', portfolioId)
    const existingIds = new Set((data||[]).map((r: any) => r.id_bem || r.referencia))
    let newCount = 0, updateCount = 0
    rows.forEach((row: any) => {
      const id = String(row['ID_BIEN'] || row['Referência '] || row['Referência'] || '')
      if (existingIds.has(id)) updateCount++
      else newCount++
    })
    setExisting({ new: newCount, update: updateCount })
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!portfolioId) throw new Error('Selecciona um portfólio')

      // Get existing records for this portfolio
      const {data: existingData} = await supabase.from('abanca_datatape').select('id, id_bem, referencia').eq('portfolio_id', portfolioId)
      const existMap: Record<string, string> = {}
      ;(existingData||[]).forEach((r: any) => {
        if (r.id_bem)    existMap[String(r.id_bem)]    = r.id
        if (r.referencia) existMap[r.referencia] = r.id
      })

      const toInsert: any[] = []
      const toUpdate: {id:string; data:any}[] = []

      rows.forEach((row: any) => {
        const mapped: any = { portfolio_id: portfolioId }
        headers.forEach(col => {
          const field = COL_MAP[col] || COL_MAP[col.trim()]
          if (field) mapped[field] = formatValue(field, row[col])
        })

        const existKey = String(row['ID_BIEN'] || '')
        const existRef = String(row['Referência '] || row['Referência'] || '')
        const existId  = existMap[existKey] || existMap[existRef]

        if (existId) toUpdate.push({ id: existId, data: mapped })
        else         toInsert.push(mapped)
      })

      // Batch insert
      let inserted = 0
      for (let i = 0; i < toInsert.length; i += 100) {
        const {error} = await supabase.from('abanca_datatape').insert(toInsert.slice(i, i+100))
        if (error) throw error
        inserted += Math.min(100, toInsert.length - i)
      }

      // Update existing
      let updated = 0
      for (const {id, data} of toUpdate) {
        const {error} = await supabase.from('abanca_datatape').update(data).eq('id', id)
        if (error) throw error
        updated++
      }

      return { inserted, updated }
    },
    onSuccess: ({ inserted, updated }) => {
      qc.invalidateQueries({ queryKey: ['abanca-data'] })
      toast.success(`${inserted} novos · ${updated} actualizados`)
      setStep('done')
    },
    onError: (e: any) => toast.error(e.message)
  })

  // Recognised vs unrecognised columns
  const recognised   = headers.filter(h => COL_MAP[h] || COL_MAP[h.trim()])
  const unrecognised = headers.filter(h => !COL_MAP[h] && !COL_MAP[h.trim()])

  return (
    <div>
      <PageHeader title="Importar Data-Tape ABANCA" subtitle="Tabela dedicada com todos os 91 campos"/>
      <div className="p-6 max-w-3xl space-y-5">

        {step === 'upload' && (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive?'border-brand-400 bg-brand-50':'border-gray-200 hover:border-brand-300'}`}>
            <input {...getInputProps()}/>
            <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-sm text-gray-600 font-medium">Arrasta o ficheiro Excel ABANCA aqui</p>
            <p className="text-xs text-gray-400 mt-1">Formato esperado: 91 colunas, cabeçalho na linha 1</p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="card flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-brand-400"/>
              <div className="flex-1">
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-gray-500">{rows.length} linhas · {recognised.length} colunas mapeadas de {headers.length}</p>
              </div>
            </div>

            <div>
              <label className="label">Portfólio de destino *</label>
              <select className="input max-w-sm" value={portfolioId} onChange={e => { setPId(e.target.value); setExisting({new:0,update:0}) }}>
                <option value="">Seleccionar…</option>
                {portfolios.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.clients?.name}</option>)}
              </select>
              {portfolioId && existing.new === 0 && existing.update === 0 && (
                <button className="btn text-xs mt-2" onClick={checkExisting}>Verificar duplicados</button>
              )}
            </div>

            {(existing.new > 0 || existing.update > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="card text-center py-3">
                  <p className="text-2xl font-semibold text-emerald-600">{existing.new}</p>
                  <p className="text-xs text-gray-500 mt-1">Registos novos</p>
                </div>
                <div className="card text-center py-3">
                  <p className="text-2xl font-semibold text-amber-600">{existing.update}</p>
                  <p className="text-xs text-gray-500 mt-1">Registos a actualizar</p>
                </div>
              </div>
            )}

            {unrecognised.length > 0 && (
              <div className="card bg-amber-50 border-amber-100">
                <p className="text-xs font-medium text-amber-700 mb-1">{unrecognised.length} colunas não mapeadas (serão ignoradas):</p>
                <p className="text-xs text-amber-600">{unrecognised.join(', ')}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn" onClick={() => { setStep('upload'); setRows([]); setHeaders([]) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => importMutation.mutate()} disabled={!portfolioId || importMutation.isPending}>
                {importMutation.isPending ? `A importar ${rows.length} registos…` : `Importar ${rows.length} registos`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="card text-center py-10">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3"/>
            <p className="text-base font-semibold">Importação concluída</p>
            <p className="text-sm text-gray-500 mt-1">{rows.length} registos processados</p>
            <div className="flex justify-center gap-3 mt-5">
              <button className="btn" onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setExisting({new:0,update:0}) }}>Nova importação</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
