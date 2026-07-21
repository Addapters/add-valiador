import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, KpiCard, Badge, EmptyState, WelcomeBanner, AlertBanner } from '@/components/ui'
import DeadlineCalendar from '@/components/DeadlineCalendar'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function ClienteDashboard() {
  const { name, clientId } = useAuth()

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ['cliente-portfolios', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, name, status, prazo_entrega, properties(id, visit_status)')
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Os meus projectos</h2>
            {isLoading ? (
              <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
            ) : portfolios.length === 0 ? (
              <EmptyState message="Ainda não tens projectos carregados na plataforma." />
            ) : (
              <div className="space-y-2">
                {portfolios.map((pf: any) => {
                  const imoveis = pf.properties || []
                  const concluidosPf = imoveis.filter((p: any) => p.visit_status === 'report_done').length
                  const pct = imoveis.length ? Math.round((concluidosPf / imoveis.length) * 100) : 0
                  return (
                    <div key={pf.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-800 text-sm">{pf.name}</span>
                        <div className="flex items-center gap-2">
                          {pf.prazo_entrega && <Badge variant="blue">Prazo: {formatDate(pf.prazo_entrega)}</Badge>}
                          <span className="text-xs text-gray-500">{concluidosPf} / {imoveis.length} concluídos</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DeadlineCalendar items={calendarItems} />
        </div>
      </div>
    </div>
  )
}
