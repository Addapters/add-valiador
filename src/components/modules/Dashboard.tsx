import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, KpiCard, VisitBadge, BillingBadge, WelcomeBanner, AlertBanner } from '@/components/ui'
import DeadlineCalendar from '@/components/DeadlineCalendar'
import { formatDate } from '@/lib/utils'

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
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { CheckSquare, Square, Pencil, Check, X, Trash2, AlertTriangle, MessageCircle, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const VISIT_LABELS: Record<string,string>   = { pending:'Por visitar', scheduled:'Agendado', visited:'Visitado', report_done:'Report OK' }
const BILLING_LABELS: Record<string,string> = { no_po:'Sem PO', awaiting_po:'A aguardar PO', po_received:'PO recebida', invoice_pending:'Fat. por emitir', invoice_issued:'Fat. emitida', paid:'Pago' }

// Duas iniciais para o "avatar" dos cartões de projecto
function initialsFor(label: string) {
  const parts = label.replace(/\|/g, ' ').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

// ── Cartão de projecto (estilo painel de gestão) — clicável, reencaminha
// para os imóveis atribuídos a esse projecto ───────────────────────────────
function ProjectCard({ pid, label, done, total, pct, onNavigate }: { pid: string; label: string; done: number; total: number; pct: number; onNavigate: (pid: string) => void }) {
  const isDone = pct === 100
  return (
    <button onClick={() => onNavigate(pid)} className="card w-full text-left hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initialsFor(label)}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
        </div>
        <span className={`badge flex-shrink-0 ${isDone ? 'badge-green' : 'badge-blue'}`}>{isDone ? 'Concluído' : 'Em progresso'}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Imóveis concluídos</span>
        <span>{done} / {total}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-400' : 'bg-brand-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

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
  const { role, name, user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Reencaminha para a página Imóveis já filtrada por este projecto.
  function goToProject(pid: string) {
    try { sessionStorage.setItem('addvaliador_props_project', pid) } catch {}
    navigate('/properties')
  }

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

  // Visão geral por perito (apenas admin) — quantos imóveis tem cada perito,
  // quantos já concluiu e o estado dos prazos dos projectos onde trabalha.
  const peritosOverview = useMemo(() => {
    if (role !== 'admin') return []
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    type Entry = { nome: string; total: number; concluidos: number; emAtraso: number; proximoPrazo: string | null }
    const map = new Map<string, Entry>()
    peritos.forEach(nome => map.set(nome, { nome, total: 0, concluidos: 0, emAtraso: 0, proximoPrazo: null }))
    recent.forEach((p: any) => {
      const nome = p.perito_avaliador
      if (!nome) return
      const entry = map.get(nome) || { nome, total: 0, concluidos: 0, emAtraso: 0, proximoPrazo: null }
      entry.total += 1
      if (p.visit_status === 'report_done') {
        entry.concluidos += 1
      } else {
        const prazo = p.portfolios?.prazo_entrega
        if (prazo) {
          if (new Date(prazo) < hoje) entry.emAtraso += 1
          if (!entry.proximoPrazo || prazo < entry.proximoPrazo) entry.proximoPrazo = prazo
        }
      }
      map.set(nome, entry)
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [recent, peritos, role])

  // Evolução por projecto — % de imóveis concluídos em cada portfólio, para
  // dar uma leitura visual rápida de como cada projecto está a avançar.
  const projectProgress = useMemo(() => {
    const map = new Map<string, { pid: string; label: string; total: number; done: number }>()
    recent.forEach((p: any) => {
      const pf = p.portfolios
      const pid = pf?.id || 'sem-projecto'
      const label = pf?.clients?.name && pf?.name ? `${pf.clients.name} | ${pf.name}` : (pf?.name || 'Sem projecto')
      const entry = map.get(pid) || { pid, label, total: 0, done: 0 }
      entry.total += 1
      if (p.visit_status === 'report_done') entry.done += 1
      map.set(pid, entry)
    })
    return [...map.values()]
      .map(e => ({ ...e, pct: e.total > 0 ? Math.round((e.done / e.total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 6)
  }, [recent])

  // Datas relevantes para o calendário — prazo de entrega de cada projecto
  // que ainda tenha imóveis por concluir.
  const calendarItems = useMemo(() => {
    const map = new Map<string, string>()
    recent.forEach((p: any) => {
      const pf = p.portfolios
      if (!pf?.id || !pf?.prazo_entrega) return
      if (p.visit_status === 'report_done') return
      const label = pf.clients?.name ? `${pf.clients.name} | ${pf.name}` : pf.name
      map.set(pf.id, JSON.stringify({ date: pf.prazo_entrega, label }))
    })
    return [...map.values()].map(v => JSON.parse(v))
  }, [recent])

  // Lista de tarefas — imóveis ainda por concluir, ordenados por urgência
  // (prazo do respectivo projecto), para uma leitura rápida do que falta fazer.
  const tasksList = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    return recent
      .filter((p: any) => p.visit_status !== 'report_done')
      .map((p: any) => {
        const prazo = p.portfolios?.prazo_entrega || null
        const atraso = prazo ? new Date(prazo) < hoje : false
        return { ...p, _prazo: prazo, _atraso: atraso }
      })
      .sort((a: any, b: any) => {
        if (a._atraso !== b._atraso) return a._atraso ? -1 : 1
        if (a._prazo && b._prazo) return a._prazo.localeCompare(b._prazo)
        return a._prazo ? -1 : b._prazo ? 1 : 0
      })
      .slice(0, 8)
  }, [recent])

  // Mensagens novas — mostra um alerta no dashboard quando há conversas por ler.
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['dashboard-unread-messages', role, user?.id],
    queryFn: async () => {
      if (!user) return 0
      let q = supabase.from('messages').select('id', { count: 'exact', head: true }).neq('remetente_id', user.id).is('lida_at', null)
      if (role === 'perito') q = q.eq('perito_id', user.id)
      const { count } = await q
      return count || 0
    },
    enabled: !!user,
    refetchInterval: 30000,
  })

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

        {/* Bem-vindo */}
        <WelcomeBanner name={name} subtitle={role === 'perito' ? 'Aqui tens um resumo do teu trabalho' : 'Aqui tens um resumo do portfólio'} />

        {/* Alertas: urgências de prazo e mensagens novas */}
        {(prazosAtraso > 0 || unreadCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prazosAtraso > 0 && (
              <AlertBanner variant="red">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span><strong>{prazosAtraso}</strong> {prazosAtraso === 1 ? 'projecto está' : 'projectos estão'} com o prazo de entrega em atraso.</span>
              </AlertBanner>
            )}
            {unreadCount > 0 && (
              <AlertBanner variant="blue">
                <MessageCircle size={16} className="flex-shrink-0" />
                <span>
                  Tens <strong>{unreadCount}</strong> {unreadCount === 1 ? 'mensagem nova' : 'mensagens novas'}.{' '}
                  <Link to={role === 'admin' ? '/admin/mensagens' : '/mensagens'} className="underline">Ver conversa</Link>
                </span>
              </AlertBanner>
            )}
          </div>
        )}

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

        {/* Projectos · Tarefas · Mensagens · Calendário */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

          {/* Coluna 1 — cartões de projecto */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Projectos</h2>
              <Link to="/properties"
                onClick={() => { try { sessionStorage.setItem('addvaliador_props_project', 'all') } catch {} }}
                className="text-xs text-brand-600 hover:underline flex items-center">Ver todos <ChevronRight size={12}/></Link>
            </div>
            <div className="p-4 space-y-3">
              {projectProgress.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Sem imóveis associados a projectos.</p>
              ) : (
                projectProgress.map(pp => <ProjectCard key={pp.pid} {...pp} onNavigate={goToProject} />)
              )}
            </div>
          </div>

          {/* Coluna 2 — lista de tarefas (imóveis por concluir) */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Tarefas <span className="text-gray-400 font-normal">({tasksList.length})</span></h2>
              <Link to="/properties" className="text-xs text-brand-600 hover:underline flex items-center">Ver todas <ChevronRight size={12}/></Link>
            </div>
            {tasksList.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sem tarefas pendentes.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {tasksList.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <button onClick={() => updateField.mutate({ id: p.id, field: 'visit_status', value: 'report_done' })}
                      className="text-gray-300 hover:text-brand-400 flex-shrink-0" title="Marcar como concluído">
                      <Square size={15}/>
                    </button>
                    <div className="min-w-0 flex-1">
                      <Link to={`/properties/${p.id}`} className="text-sm text-gray-700 hover:text-brand-600 truncate block">
                        {p.external_ref || p.address || 'Imóvel'}
                      </Link>
                    </div>
                    {p._prazo && (
                      <span className={`text-[10px] flex-shrink-0 ${p._atraso ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {formatDate(p._prazo)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna 3 — mensagens */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <MessageCircle size={14} className="text-brand-500"/> Mensagens
              </h2>
              {unreadCount > 0 && <span className="badge badge-blue">{unreadCount}</span>}
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">
                {unreadCount > 0 ? `Tens ${unreadCount} ${unreadCount === 1 ? 'mensagem por ler' : 'mensagens por ler'}.` : 'Sem mensagens novas.'}
              </p>
              <Link to={role === 'admin' ? '/admin/mensagens' : '/mensagens'} className="text-xs text-brand-600 hover:underline flex items-center">
                Ver conversa <ChevronRight size={12}/>
              </Link>
            </div>
          </div>

          {/* Coluna 4 — calendário de prazos */}
          <DeadlineCalendar items={calendarItems} />
        </div>

        {/* Visão geral dos peritos (apenas admin) */}
        {role === 'admin' && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Peritos avaliadores</h2>
              <Link to="/admin/peritos" className="text-xs text-brand-600 hover:underline">Gestão de peritos →</Link>
            </div>
            {peritosOverview.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Ainda não há peritos registados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Perito</th>
                      <th>Alocados</th>
                      <th>Concluídos</th>
                      <th>Em trabalho</th>
                      <th>Em atraso</th>
                      <th>Próximo prazo</th>
                      <th>Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peritosOverview.map(pv => {
                      const emTrabalhoPv = pv.total - pv.concluidos
                      const pctPv = pv.total > 0 ? Math.round((pv.concluidos / pv.total) * 100) : 0
                      return (
                        <tr key={pv.nome}>
                          <td className="font-medium text-gray-700 whitespace-nowrap">{pv.nome}</td>
                          <td>{pv.total}</td>
                          <td className="text-emerald-600 font-medium">{pv.concluidos}</td>
                          <td>{emTrabalhoPv}</td>
                          <td className={pv.emAtraso > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{pv.emAtraso || '—'}</td>
                          <td className="text-gray-500 whitespace-nowrap">{pv.proximoPrazo ? formatDate(pv.proximoPrazo) : '—'}</td>
                          <td className="min-w-[120px]">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${pctPv}%` }} />
                            </div>
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
