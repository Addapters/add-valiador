import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, VisitBadge, EmptyState } from '@/components/ui'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronRight, Trash2, CheckSquare, Square, Eye, EyeOff, Pencil, Check, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getSavedFilters as _getSavedFilters, saveFilters as _saveFilters, clearFilters as _clearFilters, type PropertyFilters,
  getSavedVisibleCols, saveVisibleCols, ALL_COLUMNS, DEFAULT_VISIBLE, DEFAULT_MINIMUM, type ColDef
} from '@/lib/userPrefs'

const VISIT_LABELS: Record<string,string>   = { pending:'Por visitar', scheduled:'Agendado', visited:'Visitado', report_done:'Report OK' }
const BILLING_LABELS: Record<string,string> = { no_po:'Sem PO', awaiting_po:'A aguardar PO', po_received:'PO recebida', invoice_pending:'Fat. por emitir', invoice_issued:'Fat. emitida', paid:'Pago' }

// Converte texto em uppercase (vindo da datatape em espanhol) para titleCase
function toDisplayProps(val: any): string {
  if (!val) return ''
  const s = String(val)
  if (s === s.toUpperCase() && s.length > 2 && /[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÄËÏÖÜ]/.test(s)) {
    const exceptions = new Set(['de','da','do','das','dos','e','a','o','as','os','em','na','no','nas','nos','ao','à','um','uma'])
    return s.split(' ').map((word, i) => {
      if (!word) return word
      const lower = word.toLowerCase()
      if (i > 0 && exceptions.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }).join(' ')
  }
  return s
}

function MultiSelect({ label, options, selected, onChange }: { label:string; options:string[]; selected:string[]; onChange:(v:string[])=>void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  function toggle(v: string) { onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]) }
  const display = selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`
  return (
    <div ref={ref} className="relative">
      <button className="input text-left flex items-center justify-between gap-2 min-w-[150px]" onClick={() => setOpen(o => !o)}>
        <span className={`truncate text-sm ${selected.length ? 'text-gray-900' : 'text-gray-400'}`}>{display}</span>
        <ChevronDown size={12} className="flex-shrink-0 text-gray-400"/>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-60 overflow-y-auto">
          {options.length === 0 ? <p className="text-xs text-gray-400 px-3 py-2">Sem opções</p> : (
            <>
              <button className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100" onClick={() => onChange([])}>Limpar</button>
              {options.map(o => (
                <button key={o} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => toggle(o)}>
                  {selected.includes(o) ? <CheckSquare size={13} className="text-brand-400"/> : <Square size={13} className="text-gray-300"/>}
                  {o}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ColumnPicker({ visible, onChange }: { visible:string[]; onChange:(v:string[])=>void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  function toggle(col: string) {
    const next = visible.includes(col) ? visible.filter(c => c !== col) : [...visible, col]
    onChange(next); saveVisibleCols(next)
  }
  const baseCount   = Object.keys(ALL_COLUMNS).filter(k => ALL_COLUMNS[k].group === 'base').length
  const abancaCount = Object.keys(ALL_COLUMNS).filter(k => ALL_COLUMNS[k].group === 'abanca').length
  return (
    <div ref={ref} className="relative">
      <button className="btn flex items-center gap-1.5" onClick={() => setOpen(o => !o)}>
        <Eye size={13}/> Colunas ({visible.length})
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-72 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <span className="text-xs font-semibold text-gray-600">Colunas visíveis</span>
            <div className="flex gap-2">
              <button className="text-xs text-brand-500 hover:underline" onClick={() => { const all = Object.keys(ALL_COLUMNS); onChange(all); saveVisibleCols(all) }}>Todas</button>
              <button className="text-xs text-gray-400 hover:underline" onClick={() => { onChange(DEFAULT_MINIMUM); saveVisibleCols(DEFAULT_MINIMUM) }}>Mínimo</button>
            </div>
          </div>

          {/* Base columns */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50">
            Campos gerais ({baseCount})
          </div>
          {(Object.entries(ALL_COLUMNS) as [string, ColDef][]).filter(([,d]) => d.group === 'base').map(([col, def]) => (
            <button key={col} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2" onClick={() => toggle(col)}>
              {visible.includes(col) ? <Eye size={12} className="text-brand-400 flex-shrink-0"/> : <EyeOff size={12} className="text-gray-300 flex-shrink-0"/>}
              <span className={visible.includes(col) ? 'text-gray-800' : 'text-gray-400'}>{def.label}</span>
            </button>
          ))}

          {/* ABANCA columns */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500 bg-blue-50 mt-1">
            Campos ABANCA ({abancaCount})
          </div>
          {(Object.entries(ALL_COLUMNS) as [string, ColDef][]).filter(([,d]) => d.group === 'abanca').map(([col, def]) => (
            <button key={col} className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2 bg-blue-50/30" onClick={() => toggle(col)}>
              {visible.includes(col) ? <Eye size={12} className="text-blue-400 flex-shrink-0"/> : <EyeOff size={12} className="text-gray-300 flex-shrink-0"/>}
              <span className={visible.includes(col) ? 'text-blue-800' : 'text-gray-400'}>{def.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MotivoBadge({ value, color, label, onSave }: {
  value: string|null; color: string; label: string; onSave: (v: string|null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value || '')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  function commit() { const v = draft.trim() || null; onSave(v); setEditing(false) }
  if (editing) return (
    <div className="flex flex-col gap-1 min-w-[180px] z-20 relative">
      <textarea ref={ref} rows={2}
        className="text-xs border border-gray-300 rounded px-2 py-1 resize-none focus:outline-none focus:border-brand-400"
        placeholder={`Motivo: ${label.toLowerCase()}…`}
        value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commit()} if(e.key==='Escape') setEditing(false) }}
      />
      <div className="flex gap-1">
        <button className="btn btn-primary text-[10px] py-0.5 px-2" onClick={commit}>Guardar</button>
        <button className="btn text-[10px] py-0.5 px-2 text-red-400" onClick={() => { onSave(null); setDraft(''); setEditing(false) }}>Limpar</button>
      </div>
    </div>
  )
  return (
    <div className="relative group inline-block cursor-pointer" onClick={() => { setDraft(value||''); setEditing(true) }}>
      {value
        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
        : <span className="text-gray-200 text-xs select-none hover:text-gray-400">+</span>}
      {value && (
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 bg-gray-900 text-white text-xs rounded px-2 py-1.5 max-w-[220px] whitespace-pre-wrap shadow-lg pointer-events-none">
          {value}
        </div>
      )}
    </div>
  )
}

function InlineEdit({ value, onSave, datalistId, options }: { value:string|null; onSave:(v:string)=>void; datalistId?:string; options?:string[] }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value || '')
  useEffect(() => setVal(value || ''), [value])
  if (!editing) return (
    <div className="flex items-center gap-1 group cursor-pointer whitespace-nowrap" onClick={() => setEditing(true)}>
      <span className={value ? 'text-gray-600' : 'text-gray-300'}>{value || '—'}</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 text-gray-400 flex-shrink-0"/>
    </div>
  )
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input className="border border-brand-300 rounded px-1 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-brand-400"
        value={val} onChange={e => setVal(e.target.value)} autoFocus
        list={datalistId}
        onKeyDown={e => { if (e.key==='Enter') { onSave(val); setEditing(false) } if (e.key==='Escape') setEditing(false) }}/>
      {datalistId && options && (
        <datalist id={datalistId}>{options.map(o => <option key={o} value={o}/>)}</datalist>
      )}
      <button onClick={() => { onSave(val); setEditing(false) }} className="text-emerald-500"><Check size={12}/></button>
      <button onClick={() => { setVal(value||''); setEditing(false) }} className="text-gray-400"><X size={12}/></button>
    </div>
  )
}

const COL_KEY = 'addvaliador_visible_cols'

function loadVisibleCols(): string[] {
  try {
    const r = sessionStorage.getItem(COL_KEY)
    return r ? JSON.parse(r) : [...DEFAULT_VISIBLE]
  } catch { return [...DEFAULT_VISIBLE] }
}

function persistVisibleCols(cols: string[]) {
  try { sessionStorage.setItem(COL_KEY, JSON.stringify(cols)) } catch {}
}

const FILTER_KEY = 'addvaliador_props_filters'

function loadFilters(): PropertyFilters {
  try {
    const r = sessionStorage.getItem(FILTER_KEY)
    return r ? JSON.parse(r) : { search:'', visitFilter:'', billingFilter:'', districtFilter:[], parishFilter:[], peritoFilter:'' }
  } catch { return { search:'', visitFilter:'', billingFilter:'', districtFilter:[], parishFilter:[], peritoFilter:'' } }
}
function persistFilters(f: PropertyFilters) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch {}
}

export default function Properties() {
  const qc = useQueryClient()
  const [filters,     setFiltersRaw] = useState<PropertyFilters>(loadFilters)
  const [visibleCols, setVisibleColsRaw] = useState<string[]>(loadVisibleCols)

  function setVisibleCols(cols: string[]) {
    persistVisibleCols(cols)
    setVisibleColsRaw(cols)
  }
  const [collapsed,   setCollapsed]   = useState<Record<string,boolean>>({})
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [bulkVisit,   setBulkVisit]   = useState('')
  const [bulkBilling, setBulkBilling] = useState('')
  const [bulkPerito,  setBulkPerito]  = useState('')
  const [showBulkPerito, setShowBulkPerito] = useState(false)
  // Ordenação e filtro rápido por coluna
  const [sortCol,  setSortCol]  = useState<string>('external_ref')
  const [sortDir,  setSortDir]  = useState<'asc'|'desc'>('asc')
  const [colFilter, setColFilter] = useState<Record<string, string>>({})

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  // Para colunas booleanas/motivo: cicla entre '' (todos) → 'sim' → 'nao'
  function cycleColFilter(col: string) {
    setColFilter(prev => {
      const cur = prev[col] || ''
      return { ...prev, [col]: cur === '' ? 'sim' : cur === 'sim' ? 'nao' : '' }
    })
  }
  const BOOL_COLS = ['tem_fotos','tem_comparaveis','verificado','para_verificacao','pendente_motivo','anulado_motivo']
  const SORT_INDICATOR: Record<string,string> = { '': ' ⇅', 'sim': ' ✓', 'nao': ' ✗' }

  function setFilters(f: PropertyFilters | ((prev: PropertyFilters) => PropertyFilters)) {
    setFiltersRaw(prev => {
      const next = typeof f === 'function' ? f(prev) : f
      persistFilters(next)
      return next
    })
  }

  function updateFilters(partial: Partial<PropertyFilters>) {
    setFilters(prev => { const next = {...prev,...partial}; return next })
  }

  // Lista de peritos vem da tabela profiles (utilizadores reais)
  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles-peritos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, role')
        .order('name')
      return (data || []) as { name: string; role: string }[]
    }
  })
  const peritos = profilesData
    .filter(p => p.role === 'perito' && p.name)
    .map(p => p.name) as string[]

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ['properties-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select(`
          id, ref, external_ref, id_bien,
          street, number, block, floor_letter, fracao,
          address, parish, municipality, district, postal_code,
          property_type, property_subtype, use_type, use_subtype, property_state,
          typology, year_built, condition,
          area_m2, gross_area, useful_area, land_area, area_garage_m2, area_annex_m2,
          id_registo_predial, id_registo_matricial,
          perito_avaliador, visit_status, visit_date,
          billing_status, fee_amount, po_number, invoice_number, payment_date,
          latitude, longitude,
          nuc_risco, data_pedido, tipo_via, escada, ampliacao, lugar,
          prev_valuation_date, prev_valuation_value, prev_valuation_method,
          prev_valuation_expert, prev_valuation_entity,
          tem_fotos, tem_comparaveis, para_verificacao, verificado,
          pendente_motivo, anulado_motivo,
          portfolios(id, name, status, clients(name))
        `)
        .order('portfolio_id').order('external_ref')
      return (data||[]) as any[]
    }
  })

  const districts = useMemo(() => [...new Set(rows.map((r: any) => r.district).filter(Boolean))].sort(), [rows])
  const parishes  = useMemo(() => {
    const base = filters.districtFilter.length ? rows.filter((r: any) => filters.districtFilter.includes(r.district)) : rows
    return [...new Set(base.map((r: any) => r.parish).filter(Boolean))].sort()
  }, [rows, filters.districtFilter])


  const filtered = useMemo(() => rows.filter((r: any) => {
    if (filters.visitFilter   && r.visit_status     !== filters.visitFilter)   return false
    if (filters.billingFilter && r.billing_status   !== filters.billingFilter) return false
    if (filters.districtFilter.length && !filters.districtFilter.includes(r.district)) return false
    if (filters.parishFilter.length   && !filters.parishFilter.includes(r.parish))     return false
    if (filters.peritoFilter  && r.perito_avaliador !== filters.peritoFilter)  return false
    if (filters.search) {
      const s = filters.search.toLowerCase()
      return [r.ref, r.external_ref, r.id_bien, r.address, r.street, r.municipality,
              r.district, r.parish, r.typology, r.property_type, r.perito_avaliador]
        .some(v => v?.toLowerCase().includes(s))
    }
    return true
  }), [rows, filters])

  const grouped = useMemo(() => {
    // Aplicar filtros rápidos por coluna
    let items = filtered.filter((r: any) => {
      for (const [col, val] of Object.entries(colFilter)) {
        if (!val) continue
        if (col === 'tem_fotos')        { if (val==='sim' && !r.tem_fotos)        return false; if (val==='nao' && r.tem_fotos)        return false }
        if (col === 'tem_comparaveis')  { if (val==='sim' && !r.tem_comparaveis)  return false; if (val==='nao' && r.tem_comparaveis)  return false }
        if (col === 'para_verificacao') { if (val==='sim' && !r.para_verificacao) return false; if (val==='nao' && r.para_verificacao) return false }
        if (col === 'verificado')       { if (val==='sim' && !r.verificado)        return false; if (val==='nao' && r.verificado)        return false }
        if (col === 'pendente_motivo') { if (val==='sim' && !r.pendente_motivo)   return false; if (val==='nao' && r.pendente_motivo)   return false }
        if (col === 'anulado_motivo')  { if (val==='sim' && !r.anulado_motivo)    return false; if (val==='nao' && r.anulado_motivo)    return false }
      }
      return true
    })
    // Ordenar
    items = [...items].sort((a: any, b: any) => {
      const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'pt', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    // Agrupar por portfolio
    const map: Record<string,{portfolio:any;items:any[]}> = {}
    items.forEach((r: any) => {
      const pid = r.portfolios?.id || 'sem-portfolio'
      if (!map[pid]) map[pid] = { portfolio: r.portfolios, items: [] }
      map[pid].items.push(r)
    })
    return Object.entries(map)
  }, [filtered, sortCol, sortDir, colFilter])

  function toggleGroup(pid: string) { setCollapsed(prev => ({...prev, [pid]: !prev[pid]})) }
  function toggleSelect(id: string) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function selectGroup(items: any[]) {
    const ids = items.map((i: any) => i.id)
    const allSel = ids.every(id => selected.has(id))
    setSelected(prev => { const n = new Set(prev); allSel ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n })
  }
  function selectAll() {
    const allIds = filtered.map((r: any) => r.id)
    setSelected(prev => prev.size === allIds.length ? new Set() : new Set(allIds))
  }

  const updatePerito = useMutation({
    mutationFn: async ({ id, value }: { id:string; value:string }) => {
      const { error } = await supabase.from('properties').update({ perito_avaliador: value||null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['properties-all'] }),
    onError: (e: any) => toast.error(e.message)
  })

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id:string; field:string; value:any }) => {
      const { error } = await supabase.from('properties').update({ [field]: value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['properties-all'] }),
    onError: (e: any) => toast.error(e.message)
  })

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field:string; value:string }) => {
      const ids = [...selected]
      for (let i = 0; i < ids.length; i += 50) {
        const { error } = await supabase.from('properties').update({ [field]: value||null }).in('id', ids.slice(i, i+50))
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['properties-all'] })
      toast.success(`${selected.size} actualizados`)
      setSelected(new Set()); setBulkVisit(''); setBulkBilling(''); setBulkPerito(''); setShowBulkPerito(false)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = [...selected]
      const BATCH = 50
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH)
        const { data: photos } = await supabase.from('property_photos').select('storage_path').in('property_id', chunk)
        if (photos?.length) {
          for (let j = 0; j < photos.length; j += 20)
            await supabase.storage.from('photos').remove(photos.slice(j, j+20).map((p: any) => p.storage_path))
        }
        await supabase.from('property_photos').delete().in('property_id', chunk)
        await supabase.from('market_comps').delete().in('property_id', chunk)
        const { error } = await supabase.from('properties').delete().in('id', chunk)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['properties-all'] })
      toast.success(`${selected.size} imóveis eliminados`)
      setSelected(new Set())
    },
    onError: (e: any) => toast.error(e.message)
  })

  const updatePortfolioStatus = useMutation({
    mutationFn: async ({ portfolioId, status }: { portfolioId:string; status:string }) => {
      const { error } = await supabase.from('portfolios').update({ status }).eq('id', portfolioId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey:['properties-all'] })
  })

  function cellVal(p: any, col: string) {
    const isAbanca = ALL_COLUMNS[col]?.group === 'abanca'
    const cls = isAbanca ? 'text-blue-700 whitespace-nowrap' : 'text-gray-600 whitespace-nowrap'
    const portfolioStatus = p.portfolios?.status || 'active'
    switch(col) {
      case 'external_ref':    return <Link to={`/properties/${p.id}`} className={`text-brand-600 hover:underline font-semibold whitespace-nowrap ${portfolioStatus==='closed' ? 'line-through opacity-60' : ''}`}>{p.external_ref || '—'}</Link>
      case 'portfolio_status': return p.portfolios ? (
        <select
          className={`text-xs border-0 bg-transparent cursor-pointer font-medium ${portfolioStatus==='closed' ? 'text-gray-400' : 'text-green-600'}`}
          value={portfolioStatus}
          onChange={e => updatePortfolioStatus.mutate({ portfolioId: p.portfolios.id, status: e.target.value })}>
          <option value="active">Activo</option>
          <option value="delivered">Entregue</option>
          <option value="awaiting_payment">Aguarda Pagamento</option>
          <option value="closed">Encerrado</option>
        </select>
      ) : <span className="text-gray-300 text-xs">—</span>
      case 'visit_status':    return (
        <select className="text-xs border-0 bg-transparent cursor-pointer" value={p.visit_status||''} onChange={e => updateField.mutate({ id:p.id, field:'visit_status', value:e.target.value })}>
          <option value="">—</option>
          {Object.entries(VISIT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )
      case 'tem_fotos':       return (
        <button onClick={() => updateField.mutate({ id:p.id, field:'tem_fotos', value:!p.tem_fotos })}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.tem_fotos ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
          {p.tem_fotos ? 'Sim' : 'Não'}
        </button>
      )
      case 'tem_comparaveis': return (
        <button onClick={() => updateField.mutate({ id:p.id, field:'tem_comparaveis', value:!p.tem_comparaveis })}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.tem_comparaveis ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
          {p.tem_comparaveis ? 'Sim' : 'Não'}
        </button>
      )
      case 'para_verificacao': return (
        <button onClick={() => updateField.mutate({ id:p.id, field:'para_verificacao', value:!p.para_verificacao })}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.para_verificacao ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
          {p.para_verificacao ? 'Sim' : 'Não'}
        </button>
      )
      case 'verificado':      return (
        <button onClick={() => updateField.mutate({ id:p.id, field:'verificado', value:!p.verificado })}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.verificado ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
          {p.verificado ? 'Sim' : 'Não'}
        </button>
      )
      case 'pendente_motivo': return (
        <MotivoBadge value={p.pendente_motivo} label="Pendente"
          color="bg-amber-100 text-amber-700"
          onSave={v => updateField.mutate({ id:p.id, field:'pendente_motivo', value:v })}/>
      )
      case 'anulado_motivo': return (
        <MotivoBadge value={p.anulado_motivo} label="Anulado"
          color="bg-red-100 text-red-600"
          onSave={v => updateField.mutate({ id:p.id, field:'anulado_motivo', value:v })}/>
      )
      case 'fee_amount':       return <span className="font-medium text-gray-800 whitespace-nowrap">{p.fee_amount?formatCurrency(p.fee_amount):'—'}</span>
      case 'honorarios_addapters': return <span className="font-medium text-emerald-700 whitespace-nowrap">{p.fee_amount?formatCurrency(Math.round(p.fee_amount*0.6)):'—'}</span>
      case 'geo':              return p.latitude ? <span className="text-emerald-500">✓</span> : <span className="text-gray-300">—</span>
      case 'perito_avaliador': return <InlineEdit value={p.perito_avaliador} onSave={val => updatePerito.mutate({ id:p.id, value:val })} datalistId="peritos-inline" options={peritos}/>
      case 'area_m2':          return <span className={cls}>{p.area_m2?`${p.area_m2} m²`:'—'}</span>
      case 'area_garage_m2':   return <span className={cls}>{p.area_garage_m2?`${p.area_garage_m2} m²`:'—'}</span>
      case 'area_annex_m2':    return <span className={cls}>{p.area_annex_m2?`${p.area_annex_m2} m²`:'—'}</span>
      case 'prev_valuation_value': return <span className={cls}>{p.prev_valuation_value?`€ ${p.prev_valuation_value}`:'—'}</span>
      default:                 return <span className={cls}>{toDisplayProps((p as any)[col])||'—'}</span>
    }
  }

  const hasFilters = filters.districtFilter.length || filters.parishFilter.length || filters.peritoFilter || filters.visitFilter || filters.billingFilter || filters.search

  return (
    <div>
      <PageHeader title="Imóveis" subtitle={`${filtered.length} de ${rows.length} registos`}
        actions={<>
          <Link to="/properties/new" className="btn btn-primary flex items-center gap-1.5 text-sm"><Plus size={14}/>Novo imóvel</Link>
          <ColumnPicker visible={visibleCols} onChange={setVisibleCols}/>
        </>}
      />

      <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap gap-2 items-center">
        <input className="input max-w-[180px]" placeholder="Ref, morada, perito…" value={filters.search} onChange={e => updateFilters({ search: e.target.value })}/>
        <MultiSelect label="Distrito"  options={districts} selected={filters.districtFilter} onChange={v => updateFilters({ districtFilter:v, parishFilter:[] })}/>
        <MultiSelect label="Freguesia" options={parishes}  selected={filters.parishFilter}   onChange={v => updateFilters({ parishFilter:v })}/>
        <select className="input max-w-[150px]" value={filters.peritoFilter} onChange={e => updateFilters({ peritoFilter:e.target.value })}>
          <option value="">Todos os peritos</option>
          {peritos.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="input max-w-[150px]" value={filters.visitFilter} onChange={e => updateFilters({ visitFilter:e.target.value })}>
          <option value="">Estado visita</option>
          {Object.entries(VISIT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filters.billingFilter} onChange={e => updateFilters({ billingFilter:e.target.value })}>
          <option value="">Estado financeiro</option>
          {Object.entries(BILLING_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {hasFilters && <button className="btn text-xs" onClick={() => { try { sessionStorage.removeItem(FILTER_KEY) } catch {} setFilters({ search:'', visitFilter:'', billingFilter:'', districtFilter:[], parishFilter:[], peritoFilter:'' }) }}>Limpar</button>}
      </div>

      {selected.size > 0 && (
        <div className="fixed top-0 left-[220px] right-0 z-40 bg-brand-100 border-b border-brand-200 px-6 py-3 flex items-center gap-3 flex-wrap shadow-md">
          <span className="text-sm font-medium text-brand-700">{selected.size} seleccionados</span>
          <div className="flex items-center gap-1.5">
            <select className="input text-xs py-1 max-w-[155px]" value={bulkVisit} onChange={e => setBulkVisit(e.target.value)}>
              <option value="">Alterar visita…</option>
              {Object.entries(VISIT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {bulkVisit && <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'visit_status', value:bulkVisit })}>OK</button>}
          </div>
          <div className="flex items-center gap-1.5">
            <select className="input text-xs py-1 max-w-[155px]" value={bulkBilling} onChange={e => setBulkBilling(e.target.value)}>
              <option value="">Alterar faturação…</option>
              {Object.entries(BILLING_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {bulkBilling && <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'billing_status', value:bulkBilling })}>OK</button>}
          </div>
          <div className="flex items-center gap-1.5">
            {!showBulkPerito
              ? <button className="btn text-xs py-1" onClick={() => setShowBulkPerito(true)}>Alterar perito…</button>
              : <>
                  <input className="input text-xs py-1 w-40" placeholder="Nome do perito" value={bulkPerito} onChange={e => setBulkPerito(e.target.value)} list="peritos-bulk"/>
                  <datalist id="peritos-bulk">{peritos.map(p => <option key={p} value={p}/>)}</datalist>
                  <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'perito_avaliador', value:bulkPerito })}>OK</button>
                  <button className="btn text-xs py-1" onClick={() => { setShowBulkPerito(false); setBulkPerito('') }}>✕</button>
                </>
            }
          </div>
          <button className="btn text-xs text-red-500 hover:bg-red-50 border-red-200 ml-auto"
            onClick={() => { if (confirm(`Eliminar ${selected.size} imóveis permanentemente?`)) bulkDelete.mutate() }}>
            <Trash2 size={12}/> Eliminar {selected.size}
          </button>
          <button className="btn text-xs" onClick={() => setSelected(new Set())}>Cancelar</button>
        </div>
      )}

      <div className="p-6 space-y-4">
        {(isLoading || isFetching) ? <p className="text-sm text-gray-400">A carregar…</p>
          : grouped.length === 0 ? <EmptyState message="Nenhum imóvel encontrado."/>
          : grouped.map(([pid, { portfolio, items }]) => {
            const isOpen      = !collapsed[pid]
            const clientName    = portfolio?.clients?.name
            const portfolioName = portfolio?.name
            const label         = clientName && portfolioName
              ? `${clientName} | ${portfolioName}`
              : clientName || portfolioName || 'Sem projeto'
            const groupAllSel = items.every((i: any) => selected.has(i.id))
            return (
              <div key={pid} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200 gap-2">
                  <button onClick={() => selectGroup(items)} className="text-gray-400 hover:text-brand-500 flex-shrink-0">
                    {groupAllSel ? <CheckSquare size={14} className="text-brand-400"/> : <Square size={14}/>}
                  </button>
                  <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleGroup(pid)}>
                    {isOpen ? <ChevronDown size={14} className="text-gray-400"/> : <ChevronRight size={14} className="text-gray-400"/>}
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{items.length}</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="sticky left-0 bg-gray-50 px-3 py-2 w-8 z-10">
                            <button onClick={() => selectGroup(items)} className="text-gray-400 hover:text-brand-500" title="Seleccionar este grupo">
                              {items.every((i: any) => selected.has(i.id)) && items.length > 0 ? <CheckSquare size={13} className="text-brand-400"/> : <Square size={13}/>}
                            </button>
                          </th>
                          {visibleCols.map(col => {
                            const def = ALL_COLUMNS[col]
                            const isAbanca = def?.group === 'abanca'
                            const isBool = BOOL_COLS.includes(col)
                            const isSort = sortCol === col
                            const fval   = colFilter[col] || ''
                            return (
                              <th key={col}
                                className={`px-3 py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${isAbanca?'bg-blue-50 text-blue-700':'bg-gray-50 text-gray-600'} ${isSort?'text-brand-600':''}`}
                                style={{ minWidth: col==='street'||col==='ampliacao'?'160px':'80px' }}
                                onClick={() => isBool ? cycleColFilter(col) : toggleSort(col)}
                                title={isBool ? `Filtrar: ${fval||'todos'}` : `Ordenar por ${def?.label||col}`}>
                                {def?.label || col}
                                {isBool
                                  ? <span className={`ml-1 text-[10px] ${fval==='sim'?'text-emerald-500':fval==='nao'?'text-red-400':'text-gray-300'}`}>{SORT_INDICATOR[fval]}</span>
                                  : <span className={`ml-1 text-[10px] ${isSort?'text-brand-500':'text-gray-300'}`}>{isSort ? (sortDir==='asc'?'↑':'↓') : '⇅'}</span>
                                }
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p: any, idx: number) => (
                          <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(p.id)?'bg-brand-50':idx%2===0?'bg-white':'bg-gray-50/30'}`}>
                            <td className="sticky left-0 px-3 py-2 bg-inherit z-10">
                              <button onClick={() => toggleSelect(p.id)} className="text-gray-400 hover:text-brand-500">
                                {selected.has(p.id) ? <CheckSquare size={13} className="text-brand-400"/> : <Square size={13}/>}
                              </button>
                            </td>
                            {visibleCols.map(col => {
                              const isAbanca = ALL_COLUMNS[col]?.group === 'abanca'
                              return (
                                <td key={col} className={`px-3 py-2 ${isAbanca&&!selected.has(p.id)?'bg-blue-50/40':''}`}>
                                  {cellVal(p, col)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
