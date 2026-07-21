import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, KpiCard, VisitBadge, BillingBadge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'

// Converte texto em uppercase (datatape espanhol) para titleCase
function toDisplayDash(val: any): string {
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
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { CheckSquare, Square, Pencil, Check, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const VISIT_LABELS: Record<string,string>   = { pending:'Por visitar', scheduled:'Agendado', visited:'Visitado', report_done:'Report OK' }
const BILLING_LABELS: Record<string,string> = { no_po:'Sem PO', awaiting_po:'A aguardar PO', po_received:'PO recebida', invoice_pending:'Fat. por emitir', invoice_issued:'Fat. emitida', paid:'Pago' }

// ── Inline text edit ───────────────────────────────────────────────────────
function InlineEdit({ value, onSave }: { value: string|null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value || '')
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
        onKeyDown={e => { if (e.key==='Enter') { onSave(val); setEditing(false) } if (e.key==='Escape') setEditing(false) }}/>
      <button onClick={() => { onSave(val); setEditing(false) }} className="text-emerald-500"><Check size={12}/></button>
      <button onClick={() => { setVal(value||''); setEditing(false) }} className="text-gray-400"><X size={12}/></button>
    </div>
  )
}

// ── Inline select genérico ─────────────────────────────────────────────────
function InlineSelect({ value, options, renderValue, onChange }: {
  value: string|null
  options: Record<string,string>
  renderValue: (v: string|null) => React.ReactNode
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (!editing) return (
    <div className="cursor-pointer" onClick={() => setEditing(true)}>
      {renderValue(value)}
    </div>
  )
  return (
    <select autoFocus className="text-xs border border-brand-300 rounded px-1 py-0.5 focus:outline-none"
      value={value || ''}
      onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)}>
      {Object.entries(options).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  )
}

// ── Bool badge toggle ──────────────────────────────────────────────────────
function BoolBadge({ value, trueLabel, falseLabel, color, onClick }: {
  value: boolean; trueLabel: string; falseLabel: string; color: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors whitespace-nowrap
        ${value ? color : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
      {value ? `✓ ${trueLabel}` : falseLabel}
    </button>
  )
}

// Badge com motivo editável — hover mostra razão, clique abre edição
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
        onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();commit()} if(e.key==='Escape') setEditing(false) }}
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

export default function Dashboard() {
  const { role, name } = useAuth()
  const qc = useQueryClient()

  // Filters
  const [filterVisita,     setFilterVisita]     = useState('')
  const [filterFotos,      setFilterFotos]      = useState('')
  const [filterComps,      setFilterComps]      = useState('')
  const [filterVerificado, setFilterVerificado] = useState('')
  const [search,           setSearch]           = useState('')

  // Bulk
  const [selected,       setSelected]       = useState<Set<string>>(new Set())
  const [bulkVisit,      setBulkVisit]      = useState('')
  const [bulkBilling,    setBulkBilling]    = useState('')
  const [bulkPerito,     setBulkPerito]     = useState('')
  const [showBulkPerito, setShowBulkPerito] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', role, name],
    queryFn: async () => {
      let statsQ = supabase.from('properties').select('visit_status, billing_status, fee_amount, verificado')
      if (role === 'perito' && name) statsQ = statsQ.eq('perito_avaliador', name)

      let tableQ = supabase.from('properties')
        .select('id, ref, external_ref, id_bien, address, municipality, property_type, typology, visit_status, billing_status, fee_amount, perito_avaliador, updated_at, tem_fotos, tem_comparaveis, para_verificacao, verificado, pendente_motivo, anulado_motivo, portfolio_id, portfolios(id, name, status, prazo_entrega, clients(name))')
        .order('portfolio_id').order('external_ref', { ascending: true })
      if (role === 'perito' && name) tableQ = tableQ.eq('perito_avaliador', name)

      const [statsRes, tableRes] = await Promise.all([statsQ, tableQ])
      return { properties: statsRes.data || [], recent: tableRes.data || [] }
    }
  })

  const props  = (data?.properties || []) as any[]
  const recent = (data?.recent     || []) as any[]

  // Agrupar imóveis por projeto (portfolio)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState<string>('external_ref')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [colFilter, setColFilter] = useState<Record<string,string>>({})
  const BOOL_COLS_DB = ['tem_fotos','tem_comparaveis','para_verificacao','verificado','pendente_motivo','anulado_motivo']

  function dbToggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  function dbCycleFilter(col: string) {
    setColFilter(prev => ({ ...prev, [col]: (prev[col]||'')==='' ? 'sim' : (prev[col]==='sim' ? 'nao' : '') }))
  }
  function toggleGroup(pid: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }
  const groupedByPortfolio = useMemo(() => {
    // Filtros rápidos por coluna booleana
    const items = recent.filter((p: any) => {
      for (const [col, val] of Object.entries(colFilter)) {
        if (!val) continue
        if (col==='tem_fotos')        { if (val==='sim'&&!p.tem_fotos)        return false; if (val==='nao'&&p.tem_fotos)        return false }
        if (col==='tem_comparaveis')  { if (val==='sim'&&!p.tem_comparaveis)  return false; if (val==='nao'&&p.tem_comparaveis)  return false }
        if (col==='para_verificacao') { if (val==='sim'&&!p.para_verificacao) return false; if (val==='nao'&&p.para_verificacao) return false }
        if (col==='verificado')       { if (val==='sim'&&!p.verificado)        return false; if (val==='nao'&&p.verificado)        return false }
        if (col==='pendente_motivo') { if (val==='sim'&&!p.pendente_motivo)  return false; if (val==='nao'&&p.pendente_motivo)  return false }
        if (col==='anulado_motivo')  { if (val==='sim'&&!p.anulado_motivo)   return false; if (val==='nao'&&p.anulado_motivo)   return false }
      }
      return true
    })
    // Agrupar
    const map = new Map<string, { label: string; items: any[]; status: string }>()
    items.forEach((p: any) => {
      const pid   = p.portfolio_id || '__none__'
      const pName = p.portfolios?.name
      const cName = p.portfolios?.clients?.name
      const label = cName && pName ? `${cName} | ${pName}` : pName || cName || 'Sem projeto'
      const status = p.portfolios?.status || 'active'
      if (!map.has(pid)) map.set(pid, { label, items: [], status })
      map.get(pid)!.items.push(p)
    })
    // Ordenar itens dentro de cada grupo
    const sortFn = (a: any, b: any) => {
      const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? ''
      const cmp = typeof av==='number'&&typeof bv==='number' ? av-bv
        : String(av).localeCompare(String(bv), 'pt', { sensitivity:'base' })
      return sortDir==='asc' ? cmp : -cmp
    }
    for (const g of map.values()) g.items.sort(sortFn)
    return [...map.entries()].sort(([,a],[,b]) => a.label.localeCompare(b.label))
  }, [recent, sortCol, sortDir, colFilter])

  // KPIs
  const total      = props.length
  const visited    = props.filter(p => p.visit_status !== 'pending').length
  const verificados = props.filter(p => p.verificado).length
  const reportOk   = props.filter(p => p.visit_status === 'report_done').length
  const emTrabalho = total - reportOk
  const pct = total > 0 ? Math.round((visited / total) * 100) : 0
  const pctVerificados = total > 0 ? Math.round((verificados / total) * 100) : 0

  // Prazos: por projecto (portfolios.prazo_entrega), só conta projectos que
  // ainda têm pelo menos um imóvel por concluir.
  const { prazosSemana, prazosAtraso, proximoPrazo } = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 7)
    const porPortfolio = new Map<string, { prazo: string; nome: string; algumPendente: boolean }>()
    recent.forEach((p: any) => {
      const pf = p.portfolios
      if (!pf?.id || !pf?.prazo_entrega) return
      const entry = porPortfolio.get(pf.id) || { prazo: pf.prazo_entrega, nome: pf.name, algumPendente: false }
      if (p.visit_status !== 'report_done') entry.algumPendente = true
      porPortfolio.set(pf.id, entry)
    })
    const pendentes = [...porPortfolio.values()].filter(x => x.algumPendente)
    const semana = pendentes.filter(x => { const d = new Date(x.prazo); return d >= hoje && d <= em7dias }).length
    const atraso = pendentes.filter(x => new Date(x.prazo) < hoje).length
    const proximo = pendentes.sort((a,b) => a.prazo.localeCompare(b.prazo))[0]
    return { prazosSemana: semana, prazosAtraso: atraso, proximoPrazo: proximo }
  }, [recent])

  // Lista de peritos vem da tabela profiles (utilizadores reais)
  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles-peritos'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('name, role').order('name')
      return (data || []) as { name: string; role: string }[]
    }
  })
  const peritos = profilesData
    .filter(p => p.role === 'perito' && p.name)
    .map(p => p.name) as string[]

  // Filtered rows
  const filtered = useMemo(() => recent.filter((p: any) => {
    if (filterVisita     && p.visit_status !== filterVisita) return false
    if (filterFotos      === 'sim' && !p.tem_fotos)          return false
    if (filterFotos      === 'nao' &&  p.tem_fotos)          return false
    if (filterComps      === 'sim' && !p.tem_comparaveis)    return false
    if (filterComps      === 'nao' &&  p.tem_comparaveis)    return false
    if (filterVerificado === 'sim' && !p.verificado)         return false
    if (filterVerificado === 'nao' &&  p.verificado)         return false
    if (search) {
      const s = search.toLowerCase()
      if (![p.external_ref, p.id_bien, p.address, p.municipality, p.property_type, p.perito_avaliador]
        .some((v: any) => v?.toLowerCase().includes(s))) return false
    }
    return true
  }), [recent, filterVisita, filterFotos, filterComps, filterVerificado, search])

  // ── Mutations ──────────────────────────────────────────────────────────────
  // Actualização optimista: aplica o valor de imediato no cache local (sem
  // esperar pela resposta do servidor nem refazer o fetch completo), para que
  // o toggle Sim/Não não provoque salto/refresh visual na tabela. Só se algo
  // correr mal é que reverte para o estado anterior.
  const dashboardKey = ['dashboard-stats', role, name]
  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id:string; field:string; value:any }) => {
      const { error } = await supabase.from('properties').update({ [field]: value }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: dashboardKey })
      const previous = qc.getQueryData<any>(dashboardKey)
      qc.setQueryData<any>(dashboardKey, (old: any) => {
        if (!old) return old
        const patch = (list: any[]) => list.map((p: any) => p.id === id ? { ...p, [field]: value } : p)
        return { properties: patch(old.properties || []), recent: patch(old.recent || []) }
      })
      return { previous }
    },
    onError: (e: any, _vars, context: any) => {
      if (context?.previous) qc.setQueryData(dashboardKey, context.previous)
      toast.error(e.message)
    },
    // Ressincroniza com o servidor em segundo plano, sem bloquear nem "saltar" a UI
    onSettled: () => qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  })

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field:string; value:any }) => {
      const ids = [...selected]
      for (let i = 0; i < ids.length; i += 50) {
        const { error } = await supabase.from('properties').update({ [field]: value }).in('id', ids.slice(i,i+50))
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(`${selected.size} actualizados`)
      setSelected(new Set()); setBulkVisit(''); setBulkBilling(''); setBulkPerito(''); setShowBulkPerito(false)
    },
    onError: (e: any) => toast.error(e.message)
  })

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = [...selected]
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i,i+50)
        const { data: photos } = await supabase.from('property_photos').select('storage_path').in('property_id', chunk)
        if (photos?.length) {
          for (let j = 0; j < photos.length; j += 20)
            await supabase.storage.from('photos').remove(photos.slice(j,j+20).map((p: any) => p.storage_path))
        }
        await supabase.from('property_photos').delete().in('property_id', chunk)
        await supabase.from('market_comps').delete().in('property_id', chunk)
        const { error } = await supabase.from('properties').delete().in('id', chunk)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(`${selected.size} imóveis eliminados`)
      setSelected(new Set())
    },
    onError: (e: any) => toast.error(e.message)
  })

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() {
    const allIds = filtered.map((r: any) => r.id)
    setSelected(prev => prev.size === allIds.length ? new Set() : new Set(allIds))
  }

  const hasFilters = filterVisita || filterFotos || filterComps || filterVerificado || search || Object.values(colFilter).some(v => v)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={role === 'perito' ? `Os meus imóveis — ${name}` : 'Visão geral do portfólio'}
      />
      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Em trabalho"     value={emTrabalho} sub="imóveis" />
          <KpiCard label="Concluídos"      value={reportOk}   sub={`de ${total}`} color="green" />
          <KpiCard label="Prazos esta semana" value={prazosSemana}
            sub={proximoPrazo ? `Próximo: ${formatDate(proximoPrazo.prazo)} · ${proximoPrazo.nome}` : 'sem prazos definidos'}
            color={prazosSemana > 0 ? 'amber' : 'default'} />
          <KpiCard label="Prazos em atraso" value={prazosAtraso} sub="projectos"
            color={prazosAtraso > 0 ? 'red' : 'default'} />
        </div>

        {/* Progress */}
        <div className="card">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium">Progresso do portfólio</span>
            <span className="text-gray-500">{verificados} / {total} verificados</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${pctVerificados}%` }} />
          </div>
        </div>

        {/* Table card */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              {role === 'perito' ? 'Imóveis atribuídos' : 'Últimos processos'}
              <span className="ml-1.5 text-gray-400 font-normal">({filtered.length})</span>
            </h2>
            <Link to="/properties" className="text-xs text-brand-600 hover:underline">Gestão completa →</Link>
          </div>

          {/* Compact filter bar */}
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <input
              className="input text-sm w-40"
              placeholder="Ref. ou localização…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="input text-sm w-36" value={filterVisita} onChange={e => setFilterVisita(e.target.value)}>
              <option value="">Visita: todas</option>
              {Object.entries(VISIT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="input text-sm w-36" value={filterFotos} onChange={e => setFilterFotos(e.target.value)}>
              <option value="">Fotos: todas</option>
              <option value="sim">Com fotos</option>
              <option value="nao">Sem fotos</option>
            </select>
            <select className="input text-sm w-40" value={filterComps} onChange={e => setFilterComps(e.target.value)}>
              <option value="">Comparáveis: todos</option>
              <option value="sim">Com comparáveis</option>
              <option value="nao">Sem comparáveis</option>
            </select>
            <select className="input text-sm w-40" value={filterVerificado} onChange={e => setFilterVerificado(e.target.value)}>
              <option value="">Verificado: todos</option>
              <option value="sim">Verificado</option>
              <option value="nao">Por verificar</option>
            </select>
            {hasFilters && (
              <button className="btn text-xs" onClick={() => {
                setFilterVisita(''); setFilterFotos(''); setFilterComps(''); setFilterVerificado(''); setSearch(''); setColFilter({})
              }}>Limpar</button>
            )}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="fixed top-0 left-[220px] right-0 z-40 bg-brand-100 border-b border-brand-200 px-6 py-3 flex items-center gap-3 flex-wrap shadow-md">
              <span className="text-sm font-medium text-brand-700">{selected.size} seleccionados</span>

              <div className="flex items-center gap-1.5">
                <select className="input text-xs py-1 w-36" value={bulkVisit} onChange={e => setBulkVisit(e.target.value)}>
                  <option value="">Alterar visita…</option>
                  {Object.entries(VISIT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {bulkVisit && <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'visit_status', value:bulkVisit })}>OK</button>}
              </div>

              <div className="flex items-center gap-1.5">
                <select className="input text-xs py-1 w-36" value={bulkBilling} onChange={e => setBulkBilling(e.target.value)}>
                  <option value="">Alterar faturação…</option>
                  {Object.entries(BILLING_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {bulkBilling && <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'billing_status', value:bulkBilling })}>OK</button>}
              </div>

              <div className="flex items-center gap-1.5">
                <select className="input text-xs py-1 w-40" onChange={e => {
                  if (e.target.value) bulkUpdate.mutate({ field:'tem_fotos', value: e.target.value==='sim' })
                }}>
                  <option value="">Alterar fotos…</option>
                  <option value="sim">Com fotos</option>
                  <option value="nao">Sem fotos</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <select className="input text-xs py-1 w-44" onChange={e => {
                  if (e.target.value) bulkUpdate.mutate({ field:'tem_comparaveis', value: e.target.value==='sim' })
                }}>
                  <option value="">Alterar comparáveis…</option>
                  <option value="sim">Com comparáveis</option>
                  <option value="nao">Sem comparáveis</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <select className="input text-xs py-1 w-40" onChange={e => {
                  if (e.target.value) bulkUpdate.mutate({ field:'verificado', value: e.target.value==='sim' })
                }}>
                  <option value="">Alterar verificado…</option>
                  <option value="sim">Verificado</option>
                  <option value="nao">Por verificar</option>
                </select>
              </div>

              {role === 'admin' && (
                <div className="flex items-center gap-1.5">
                  {!showBulkPerito
                    ? <button className="btn text-xs py-1" onClick={() => setShowBulkPerito(true)}>Alterar perito…</button>
                    : <>
                        <input className="input text-xs py-1 w-40" placeholder="Nome do perito"
                          value={bulkPerito} onChange={e => setBulkPerito(e.target.value)} list="peritos-bulk-dash"/>
                        <datalist id="peritos-bulk-dash">{peritos.map(p => <option key={p} value={p}/>)}</datalist>
                        <button className="btn btn-primary text-xs py-1" onClick={() => bulkUpdate.mutate({ field:'perito_avaliador', value:bulkPerito })}>OK</button>
                        <button className="btn text-xs py-1" onClick={() => { setShowBulkPerito(false); setBulkPerito('') }}>✕</button>
                      </>
                  }
                </div>
              )}

              <button className="btn text-xs text-red-500 hover:bg-red-50 border-red-200 ml-auto"
                onClick={() => { if (confirm(`Eliminar ${selected.size} imóveis permanentemente?`)) bulkDelete.mutate() }}>
                <Trash2 size={12}/> Eliminar {selected.size}
              </button>
              <button className="btn text-xs" onClick={() => setSelected(new Set())}>Cancelar</button>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-400">Nenhum imóvel encontrado para esta selecção.</p>
              {hasFilters && (
                <button className="btn text-xs" onClick={() => {
                  setFilterVisita(''); setFilterFotos(''); setFilterComps(''); setFilterVerificado(''); setSearch(''); setColFilter({})
                }}>
                  ✕ Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByPortfolio
                .filter(([, { items }]) => items.some(p => filtered.includes(p)))
                .map(([pid, { label, items, status }]) => {
                  const groupItems = items.filter(p => filtered.includes(p))
                  if (groupItems.length === 0) return null
                  const isClosed = status === 'closed'
                  return (
                    <div key={pid}>
                      <div
                        className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 cursor-pointer select-none hover:bg-gray-100"
                        onClick={() => toggleGroup(pid)}>
                        <button
                          className="text-gray-400 hover:text-brand-500"
                          title="Seleccionar imóveis deste grupo"
                          onClick={e => {
                            e.stopPropagation()
                            const ids = groupItems.map((p: any) => p.id)
                            const allSel = ids.every((id: string) => selected.has(id))
                            setSelected(prev => {
                              const next = new Set(prev)
                              ids.forEach((id: string) => allSel ? next.delete(id) : next.add(id))
                              return next
                            })
                          }}>
                          {groupItems.every((p: any) => selected.has(p.id)) && groupItems.length > 0
                            ? <CheckSquare size={13} className="text-brand-400"/>
                            : <Square size={13}/>}
                        </button>
                        <span className={`text-gray-400 transition-transform ${collapsedGroups.has(pid) ? '' : 'rotate-90'}`}>▶</span>
                        <span className={`text-sm font-semibold ${isClosed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
                        {isClosed && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Encerrado</span>}
                        <span className="ml-2 text-xs text-gray-400">{groupItems.length} imóveis</span>
                      </div>
                      {!collapsedGroups.has(pid) && (
                      <div className="overflow-x-auto">
                        <table className="table-base">
                          <thead>
                            <tr>
                              <th className="w-8">
                                <button
                                  onClick={() => {
                                    const ids = groupItems.map((p: any) => p.id)
                                    const allSel = ids.every((id: string) => selected.has(id))
                                    setSelected(prev => {
                                      const next = new Set(prev)
                                      ids.forEach((id: string) => allSel ? next.delete(id) : next.add(id))
                                      return next
                                    })
                                  }}
                                  className="text-gray-400 hover:text-brand-500"
                                  title="Seleccionar este grupo">
                                  {groupItems.every((p: any) => selected.has(p.id)) && groupItems.length > 0
                                    ? <CheckSquare size={13} className="text-brand-400"/>
                                    : <Square size={13}/>}
                                </button>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('external_ref')}>
                                Ref. Externa <span className="text-[10px] text-gray-300">{sortCol==='external_ref'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('id_bien')}>
                                ID Bem <span className="text-[10px] text-gray-300">{sortCol==='id_bien'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('municipality')}>
                                Localização <span className="text-[10px] text-gray-300">{sortCol==='municipality'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('property_type')}>
                                Tipo <span className="text-[10px] text-gray-300">{sortCol==='property_type'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                              {role === 'admin' && <th>Perito</th>}
                              <th>Visita</th>
                              <th className="text-center cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('tem_fotos')} title="Filtrar fotos">
                                Fotos <span className={`text-[10px] ${colFilter['tem_fotos']==='sim'?'text-emerald-500':colFilter['tem_fotos']==='nao'?'text-red-400':'text-gray-300'}`}>{colFilter['tem_fotos']==='sim'?'✓':colFilter['tem_fotos']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="text-center cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('tem_comparaveis')} title="Filtrar comparáveis">
                                Comparáveis <span className={`text-[10px] ${colFilter['tem_comparaveis']==='sim'?'text-emerald-500':colFilter['tem_comparaveis']==='nao'?'text-red-400':'text-gray-300'}`}>{colFilter['tem_comparaveis']==='sim'?'✓':colFilter['tem_comparaveis']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="text-center cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('para_verificacao')} title="Filtrar para verificação">
                                Para Verificação <span className={`text-[10px] ${colFilter['para_verificacao']==='sim'?'text-amber-500':colFilter['para_verificacao']==='nao'?'text-red-400':'text-gray-300'}`}>{colFilter['para_verificacao']==='sim'?'✓':colFilter['para_verificacao']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="text-center cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('verificado')} title="Filtrar verificados">
                                Verificado <span className={`text-[10px] ${colFilter['verificado']==='sim'?'text-emerald-500':colFilter['verificado']==='nao'?'text-red-400':'text-gray-300'}`}>{colFilter['verificado']==='sim'?'✓':colFilter['verificado']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('fee_amount')}>
                                Honorário <span className="text-[10px] text-gray-300">{sortCol==='fee_amount'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                              <th>Hon. Addapters</th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('pendente_motivo')} title="Filtrar pendentes">
                                Pendente <span className={`text-[10px] ${colFilter['pendente_motivo']==='sim'?'text-amber-500':colFilter['pendente_motivo']==='nao'?'text-red-400':'text-gray-300'}`}>{colFilter['pendente_motivo']==='sim'?'✓':colFilter['pendente_motivo']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbCycleFilter('anulado_motivo')} title="Filtrar anulados">
                                Anulado <span className={`text-[10px] ${colFilter['anulado_motivo']==='sim'?'text-red-500':colFilter['anulado_motivo']==='nao'?'text-emerald-400':'text-gray-300'}`}>{colFilter['anulado_motivo']==='sim'?'✓':colFilter['anulado_motivo']==='nao'?'✗':'⇅'}</span>
                              </th>
                              <th className="cursor-pointer hover:bg-gray-100 select-none" onClick={() => dbToggleSort('updated_at')}>
                                Actualizado <span className="text-[10px] text-gray-300">{sortCol==='updated_at'?(sortDir==='asc'?'↑':'↓'):'⇅'}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupItems.map((p: any, idx: number) => (
                              <tr key={p.id} className={`${p.verificado ? 'bg-green-50 hover:bg-green-100' : selected.has(p.id) ? 'bg-brand-50' : idx%2===0 ? 'bg-white' : 'bg-gray-50/30'} ${isClosed ? 'opacity-60' : ''}`}>
                                <td>
                                  <button onClick={() => toggleSelect(p.id)} className="text-gray-400 hover:text-brand-500">
                                    {selected.has(p.id) ? <CheckSquare size={13} className="text-brand-400"/> : <Square size={13}/>}
                                  </button>
                                </td>
                                <td>
                                  <Link to={`/properties/${p.id}`} className={`text-brand-600 hover:underline font-medium whitespace-nowrap ${isClosed ? 'line-through' : ''}`}>
                                    {p.external_ref || '—'}
                                  </Link>
                                </td>
                                <td className="text-gray-500 text-xs font-mono whitespace-nowrap">{p.id_bien || '—'}</td>
                                <td className="text-gray-600 max-w-[160px] truncate">{toDisplayDash(p.municipality || p.address) || '—'}</td>
                                <td className="text-gray-600 whitespace-nowrap">{toDisplayDash([p.property_type, p.typology].filter(Boolean).join(' ')) || '—'}</td>
                                {role === 'admin' && (
                                  <td>
                                    <InlineEdit value={p.perito_avaliador}
                                      onSave={val => updateField.mutate({ id:p.id, field:'perito_avaliador', value:val||null })}/>
                                  </td>
                                )}
                                <td>
                                  <InlineSelect
                                    value={p.visit_status}
                                    options={VISIT_LABELS}
                                    renderValue={v => <VisitBadge status={v} />}
                                    onChange={val => updateField.mutate({ id:p.id, field:'visit_status', value:val })}
                                  />
                                </td>
                                <td className="text-center">
                                  <BoolBadge value={!!p.tem_fotos} trueLabel="Sim" falseLabel="Não"
                                    color="bg-blue-100 text-blue-600 hover:bg-blue-200"
                                    onClick={() => updateField.mutate({ id:p.id, field:'tem_fotos', value:!p.tem_fotos })}/>
                                </td>
                                <td className="text-center">
                                  <BoolBadge value={!!p.tem_comparaveis} trueLabel="Sim" falseLabel="Não"
                                    color="bg-purple-100 text-purple-600 hover:bg-purple-200"
                                    onClick={() => updateField.mutate({ id:p.id, field:'tem_comparaveis', value:!p.tem_comparaveis })}/>
                                </td>
                                <td className="text-center">
                                  <BoolBadge value={!!p.para_verificacao} trueLabel="Sim" falseLabel="Não"
                                    color="bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    onClick={() => updateField.mutate({ id:p.id, field:'para_verificacao', value:!p.para_verificacao })}/>
                                </td>
                                <td className="text-center">
                                  <BoolBadge value={!!p.verificado} trueLabel="Sim" falseLabel="Não"
                                    color="bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                    onClick={() => updateField.mutate({ id:p.id, field:'verificado', value:!p.verificado })}/>
                                </td>
                                <td className="text-gray-600 whitespace-nowrap">{p.fee_amount ? formatCurrency(p.fee_amount) : '—'}</td>
                                <td className="text-emerald-700 font-medium whitespace-nowrap">{p.fee_amount ? formatCurrency(Math.round(p.fee_amount * 0.6)) : '—'}</td>
                                <td className="px-1">
                                  <MotivoBadge value={p.pendente_motivo} label="Pendente"
                                    color="bg-amber-100 text-amber-700"
                                    onSave={v => updateField.mutate({ id:p.id, field:'pendente_motivo', value:v })}/>
                                </td>
                                <td className="px-1">
                                  <MotivoBadge value={p.anulado_motivo} label="Anulado"
                                    color="bg-red-100 text-red-600"
                                    onSave={v => updateField.mutate({ id:p.id, field:'anulado_motivo', value:v })}/>
                                </td>
                                <td className="text-gray-400 whitespace-nowrap">{formatDate(p.updated_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
