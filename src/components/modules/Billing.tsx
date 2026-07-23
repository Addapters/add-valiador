import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, KpiCard } from '@/components/ui'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
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

function initialsFor(label: string) {
  const parts = label.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

export default function Billing() {
  const [peritoFilter, setPeritoFilter] = useState('')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['billing-props'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, external_ref, id_bien, address, municipality, billing_status, fee_amount, po_number, invoice_number, payment_date, perito_avaliador, portfolio_id, portfolios(id, name, client_id, clients(id, name))')
        .order('portfolio_id').order('external_ref')
      if (error) throw error
      return (data || []) as any[]
    }
  })

  const availablePeritos = useMemo(() => {
    const set = new Set(properties.map((p: any) => p.perito_avaliador).filter(Boolean))
    return [...set].sort()
  }, [properties])

  const filtered = useMemo(() => peritoFilter
    ? properties.filter((p: any) => p.perito_avaliador === peritoFilter)
    : properties,
  [properties, peritoFilter])

  // ── KPIs globais ────────────────────────────────────────────────
  const total    = filtered.reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const received = filtered.filter((p: any) => p.billing_status === 'paid').reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const pending  = total - received

  // ── Agrupamento por cliente, e dentro de cada cliente por projecto ──
  const clientGroups = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string; total: number; received: number; pending: number; count: number
      portfolios: Map<string, { label: string; items: any[] }>
    }>()
    filtered.forEach((p: any) => {
      const client = p.portfolios?.clients
      const cid = client?.id || '__sem-cliente__'
      const cname = client?.name || 'Sem cliente associado'
      if (!map.has(cid)) map.set(cid, { id: cid, name: cname, total: 0, received: 0, pending: 0, count: 0, portfolios: new Map() })
      const entry = map.get(cid)!
      entry.total += p.fee_amount || 0
      entry.count += 1
      if (p.billing_status === 'paid') entry.received += p.fee_amount || 0

      const pid = p.portfolio_id || '__sem-projecto__'
      const pname = p.portfolios?.name || 'Sem projecto'
      if (!entry.portfolios.has(pid)) entry.portfolios.set(pid, { label: pname, items: [] })
      entry.portfolios.get(pid)!.items.push(p)
    })
    return [...map.values()]
      .map(c => ({ ...c, pending: c.total - c.received }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total)
  }, [filtered])

  const clientsComSaldo = clientGroups.filter(c => c.pending > 0).length

  return (
    <div>
      <PageHeader title="Faturação" subtitle="Pipeline financeiro por cliente"
        actions={
          <select className="input text-sm w-48" value={peritoFilter} onChange={e => setPeritoFilter(e.target.value)}>
            <option value="">Todos os peritos</option>
            {availablePeritos.map((p: any) => <option key={p} value={p}>{p}</option>)}
          </select>
        }
      />

      <div className="p-6 space-y-4">
        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total honorários" value={formatCurrency(total)} sub={`${filtered.length} imóveis`} />
          <KpiCard label="Recebido" value={formatCurrency(received)} sub={`${filtered.filter((p:any)=>p.billing_status==='paid').length} processos`} color="green" />
          <KpiCard label="Por receber" value={formatCurrency(pending)} sub={`${filtered.filter((p:any)=>p.billing_status!=='paid').length} processos`} color={pending > 0 ? 'amber' : 'default'} />
          <KpiCard label="Clientes com saldo" value={clientsComSaldo} sub={`de ${clientGroups.length} clientes`} color={clientsComSaldo > 0 ? 'red' : 'default'} />
        </div>

        {/* ── Lista de clientes ── */}
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : clientGroups.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhum imóvel encontrado.</p>
        ) : (
          <div className="space-y-3">
            {clientGroups.map(c => {
              const pct = c.total > 0 ? Math.round((c.received / c.total) * 100) : 0
              const isOpen = expandedClient === c.id
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                    onClick={() => setExpandedClient(isOpen ? null : c.id)}>
                    {isOpen ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0"/> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0"/>}
                    <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initialsFor(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.count} imóveis</p>
                    </div>
                    <div className="hidden sm:block w-32 flex-shrink-0">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{pct}% recebido</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-28">
                      <p className="text-sm font-semibold text-gray-800">{formatCurrency(c.total)}</p>
                      <p className={`text-xs ${c.pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {c.pending > 0 ? `${formatCurrency(c.pending)} por receber` : 'Tudo recebido'}
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-3">
                      {[...c.portfolios.entries()].sort(([,a],[,b]) => a.label.localeCompare(b.label)).map(([pid, { label, items }]) => {
                        const groupTotal = items.reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
                        return (
                          <div key={pid} className="bg-white rounded-lg overflow-hidden border border-gray-100">
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <Building2 size={12} className="text-gray-400"/>
                                <span className="text-xs font-semibold text-gray-700">{label}</span>
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
                              </div>
                              <span className="text-xs font-semibold text-gray-600">{formatCurrency(groupTotal)}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Ref.</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Localização</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Perito</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Estado</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Honorário</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">PO</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Fatura</th>
                                    <th className="px-3 py-1.5 font-medium text-gray-400">Pagamento</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((p: any) => (
                                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="px-3 py-2">
                                        <Link to={`/properties/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.external_ref || '—'}</Link>
                                      </td>
                                      <td className="px-3 py-2 text-gray-600">{p.municipality || p.address || '—'}</td>
                                      <td className="px-3 py-2 text-gray-500">{p.perito_avaliador || '—'}</td>
                                      <td className="px-3 py-2">
                                        {p.billing_status ? (
                                          <span className={`px-2 py-0.5 rounded-full font-medium ${BILLING_COLORS[p.billing_status] || 'bg-gray-100 text-gray-500'}`}>
                                            {BILLING_LABELS[p.billing_status] || p.billing_status}
                                          </span>
                                        ) : <span className="text-gray-300">—</span>}
                                      </td>
                                      <td className="px-3 py-2 font-medium text-gray-800">{p.fee_amount ? formatCurrency(p.fee_amount) : '—'}</td>
                                      <td className="px-3 py-2 text-gray-500">{p.po_number || '—'}</td>
                                      <td className="px-3 py-2 text-gray-500">{p.invoice_number || '—'}</td>
                                      <td className="px-3 py-2 text-gray-400">{p.payment_date ? formatDate(p.payment_date) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
