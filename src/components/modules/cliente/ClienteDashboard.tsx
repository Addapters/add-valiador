import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, KpiCard, EmptyState, WelcomeBanner, AlertBanner } from '@/components/ui'
import DeadlineCalendar from '@/components/DeadlineCalendar'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function initialsFor(label: string) {
  const parts = label.replace(/\|/g, ' ').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

// ── Cartão de projecto (mesmo estilo usado no dashboard de admin/perito) ────
function ProjectCard({ label, done, total, pct, prazo }: { label: string; done: number; total: number; pct: number; prazo?: string | null }) {
  const isDone = pct === 100
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initialsFor(label)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
            {prazo && <p className="text-[11px] text-gray-400">Prazo: {formatDate(prazo)}</p>}
          </div>
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
    </div>
  )
}

export default function ClienteDashboard() {
  const { name, clientId } = useAuth()

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ['cliente-portfolios', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, name, status, prazo_entrega, properties(id, external_ref, address, visit_status)')
        .eq('client_id', clientId)
        .order('name')
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const stats = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 7)
    let totalImoveis = 0, concluidos = 0
    let prazosSemana = 0, prazosAtraso = 0
    portfolios.forEach((pf: any) => {
      const imoveis = pf.properties || []
      totalImoveis += imoveis.length
      const todosConcluidos = imoveis.length > 0 && imoveis.every((p: any) => p.visit_status === 'report_done')
      concluidos += imoveis.filter((p: any) => p.visit_status === 'report_done').length
      if (pf.prazo_entrega && !todosConcluidos) {
        const d = new Date(pf.prazo_entrega)
        if (d < hoje) prazosAtraso++
        else if (d <= em7dias) prazosSemana++
      }
    })
    return { totalImoveis, concluidos, prazosSemana, prazosAtraso }
  }, [portfolios])

  const projectProgress = useMemo(() => portfolios.map((pf: any) => {
    const imoveis = pf.properties || []
    const done = imoveis.filter((p: any) => p.visit_status === 'report_done').length
    const total = imoveis.length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { label: pf.name, done, total, pct, prazo: pf.prazo_entrega }
  }), [portfolios])

  // Imóveis ainda por concluir, ordenados por prazo (do projecto) mais próximo primeiro.
  const tasksList = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const rows: any[] = []
    portfolios.forEach((pf: any) => {
      (pf.properties || []).forEach((p: any) => {
        if (p.visit_status !== 'report_done') {
          const atraso = pf.prazo_entrega ? new Date(pf.prazo_entrega) < hoje : false
          rows.push({ ...p, _projecto: pf.name, _prazo: pf.prazo_entrega, _atraso: atraso })
        }
      })
    })
    rows.sort((a, b) => {
      if (a._atraso !== b._atraso) return a._atraso ? -1 : 1
      if (!a._prazo) return 1
      if (!b._prazo) return -1
      return new Date(a._prazo).getTime() - new Date(b._prazo).getTime()
    })
    return rows.slice(0, 8)
  }, [portfolios])

  const calendarItems = useMemo(() => portfolios
    .filter((pf: any) => {
      const imoveis = pf.properties || []
      const todosConcluidos = imoveis.length > 0 && imoveis.every((p: any) => p.visit_status === 'report_done')
      return pf.prazo_entrega && !todosConcluidos
    })
    .map((pf: any) => ({ date: pf.prazo_entrega, label: pf.name })),
    [portfolios])

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Os meus projectos — ${name || ''}`} />
      <div className="p-6 space-y-6">
        <WelcomeBanner name={name} subtitle="Aqui tens um resumo dos teus projectos" />

        {stats.prazosAtraso > 0 && (
          <AlertBanner variant="red">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span><strong>{stats.prazosAtraso}</strong> {stats.prazosAtraso === 1 ? 'projecto está' : 'projectos estão'} com o prazo de entrega em atraso.</span>
          </AlertBanner>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Projectos carregados" value={portfolios.length} sub="carteiras/pedidos" />
          <KpiCard label="Imóveis concluídos"    value={stats.concluidos} sub={`de ${stats.totalImoveis}`} color="green" />
          <KpiCard label="Prazos esta semana"    value={stats.prazosSemana} color={stats.prazosSemana > 0 ? 'amber' : 'default'} />
          <KpiCard label="Prazos em atraso"      value={stats.prazosAtraso} color={stats.prazosAtraso > 0 ? 'red' : 'default'} />
        </div>

        {/* Projectos · Imóveis por concluir · Calendário de prazos */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_300px] gap-4 items-start">

          {/* Coluna 1 — cartões de projecto */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Os meus projectos</h2>
            {isLoading ? (
              <div className="card"><p className="text-sm text-gray-400 py-4 text-center">A carregar…</p></div>
            ) : portfolios.length === 0 ? (
              <div className="card"><EmptyState message="Ainda não tens projectos carregados na plataforma." /></div>
            ) : (
              projectProgress.map((pp: any) => <ProjectCard key={pp.label} {...pp} />)
            )}
          </div>

          {/* Coluna 2 — imóveis por concluir */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Por concluir <span className="text-gray-400 font-normal">({tasksList.length})</span></h2>
            </div>
            {tasksList.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Sem imóveis por concluir. 🎉</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {tasksList.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 truncate">{p.external_ref || p.address || 'Imóvel'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{p._projecto}</p>
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

          {/* Coluna 3 — calendário de prazos */}
          <div className="space-y-4">
            <DeadlineCalendar items={calendarItems} />
            <Link to="/cliente/pedidos" className="text-xs text-brand-600 hover:underline flex items-center justify-end">
              Ver os meus pedidos <ChevronRight size={12}/>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
