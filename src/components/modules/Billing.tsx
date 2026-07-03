import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { Link } from 'react-router-dom'
import { formatCurrency, formatDate } from '@/lib/utils'

const BILLING_LABELS: Record<string,string> = {
  no_po:'Sem PO', awaiting_po:'A aguardar PO', po_received:'PO recebida',
  invoice_pending:'Fatura por emitir', invoice_issued:'Fatura emitida', paid:'Pago'
}
const BILLING_COLORS: Record<string,string> = {
  no_po:           'bg-red-100 text-red-600',
  awaiting_po:     'bg-orange-100 text-orange-600',
  po_received:     'bg-purple-100 text-purple-600',
  invoice_pending: 'bg-sky-100 text-sky-600',
  invoice_issued:  'bg-blue-100 text-blue-600',
  paid:            'bg-emerald-100 text-emerald-700',
}
const GROUP_BORDER: Record<string,string> = {
  no_po:'border-l-4 border-red-300', awaiting_po:'border-l-4 border-orange-300',
  po_received:'border-l-4 border-purple-300', invoice_pending:'border-l-4 border-sky-300',
  invoice_issued:'border-l-4 border-blue-300', paid:'border-l-4 border-emerald-300',
}

export default function Billing() {
  const [clientId,     setClientId]     = useState('')
  const [portfolioId,  setPortfolioId]  = useState('')
  const [peritoFilter, setPeritoFilter] = useState('')

  // ── Filtros em cascata ─────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-billing'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name').order('name')
      return (data || []) as any[]
    }
  })

  const { data: allPortfolios = [] } = useQuery({
    queryKey: ['portfolios-billing'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('id, name, client_id, clients(name)').order('name')
      return (data || []) as any[]
    }
  })

  const filteredPortfolios = clientId
    ? allPortfolios.filter((p: any) => p.client_id === clientId)
    : allPortfolios

  // ── Dados principais ───────────────────────────────────────────
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['billing-props', portfolioId, clientId, peritoFilter],
    queryFn: async () => {
      let q = supabase
        .from('properties')
        .select('id, external_ref, id_bien, address, municipality, billing_status, fee_amount, po_number, invoice_number, payment_date, perito_avaliador, portfolio_id, portfolios(id, name, clients(name))')
        .order('portfolio_id').order('external_ref')
      if (portfolioId)  q = q.eq('portfolio_id', portfolioId)
      else if (clientId) q = q.eq('client_id', clientId)
      if (peritoFilter)  q = q.eq('perito_avaliador', peritoFilter)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as any[]
    }
  })

  // Peritos disponíveis para o filtro (baseado nos dados já filtrados por projecto)
  const availablePeritos = useMemo(() => {
    const set = new Set(properties.map((p: any) => p.perito_avaliador).filter(Boolean))
    return [...set].sort()
  }, [properties])

  // ── Agrupamento por projecto ────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: any[] }>()
    properties.forEach((p: any) => {
      const pid   = p.portfolio_id || '__none__'
      const cName = p.portfolios?.clients?.name
      const pName = p.portfolios?.name
      const label = cName && pName ? `${cName} | ${pName}` : pName || cName || 'Sem projeto'
      if (!map.has(pid)) map.set(pid, { label, items: [] })
      map.get(pid)!.items.push(p)
    })
    return [...map.entries()].sort(([,a],[,b]) => a.label.localeCompare(b.label))
  }, [properties])

  // ── KPIs ────────────────────────────────────────────────────────
  const total    = properties.reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const received = properties.filter((p: any) => p.billing_status === 'paid')
                             .reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const pending  = total - received

  return (
    <div>
      <PageHeader title="Faturação" subtitle="Pipeline financeiro por projeto"/>

      {/* ── Filtros em cascata ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Cliente</label>
          <select className="input text-sm py-1.5 min-w-[180px]" value={clientId}
            onChange={e => { setClientId(e.target.value); setPortfolioId(''); setPeritoFilter('') }}>
            <option value="">Todos os clientes</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Projeto</label>
          <select className="input text-sm py-1.5 min-w-[220px]" value={portfolioId}
            onChange={e => { setPortfolioId(e.target.value); setPeritoFilter('') }}>
            <option value="">Todos os projetos</option>
            {filteredPortfolios.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.clients?.name ? `${p.clients.name} | ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Perito</label>
          <select className="input text-sm py-1.5 min-w-[180px]" value={peritoFilter}
            onChange={e => setPeritoFilter(e.target.value)}>
            <option value="">Todos os peritos</option>
            {availablePeritos.map((p: any) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {(clientId || portfolioId || peritoFilter) && (
          <button className="btn text-xs py-1.5 mt-4"
            onClick={() => { setClientId(''); setPortfolioId(''); setPeritoFilter('') }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total honorários</p>
          <p className="text-xl font-semibold text-gray-900">{formatCurrency(total)}</p>
          <p className="text-xs text-gray-400">{properties.length} imóveis</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Recebido</p>
          <p className="text-xl font-semibold text-emerald-600">{formatCurrency(received)}</p>
          <p className="text-xs text-gray-400">{properties.filter((p: any) => p.billing_status==='paid').length} processos</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Por receber</p>
          <p className="text-xl font-semibold text-amber-600">{formatCurrency(pending)}</p>
          <p className="text-xs text-gray-400">{properties.filter((p: any) => p.billing_status!=='paid').length} processos</p>
        </div>
      </div>

      {/* ── Listagem agrupada por projecto ── */}
      <div className="p-6 space-y-4">
        {isLoading ? <p className="text-sm text-gray-400">A carregar…</p>
        : groups.length === 0 ? <p className="text-sm text-gray-400">Nenhum imóvel encontrado para esta selecção.</p>
        : groups.map(([pid, { label, items }]) => {
            const groupTotal = items.reduce((s: number, p: any) => s + (p.fee_amount||0), 0)
            return (
              <div key={pid} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                {/* Cabeçalho do grupo */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{formatCurrency(groupTotal)}</span>
                </div>
                {/* Tabela de imóveis do grupo */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Ref. Avaliador</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">ID Bem</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Localização</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Perito</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Honorário</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">PO</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Fatura</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p: any, idx: number) => (
                        <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${idx%2===1?'bg-gray-50/30':''}`}>
                          <td className="px-4 py-2.5">
                            <Link to={`/properties/${p.id}`} className="text-brand-600 hover:underline font-medium">
                              {p.external_ref || '—'}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.id_bien || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600">{p.municipality || p.address || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{p.perito_avaliador || '—'}</td>
                          <td className="px-4 py-2.5">
                            {p.billing_status ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILLING_COLORS[p.billing_status] || 'bg-gray-100 text-gray-500'}`}>
                                {BILLING_LABELS[p.billing_status] || p.billing_status}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{p.fee_amount ? formatCurrency(p.fee_amount) : '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.po_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.invoice_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-400">{p.payment_date ? formatDate(p.payment_date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
