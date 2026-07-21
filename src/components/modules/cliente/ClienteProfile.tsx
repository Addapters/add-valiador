import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, VisitBadge, BillingBadge, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency } from '@/lib/utils'

export default function ClienteProfile() {
  const { name, clientId } = useAuth()

  const { data: client } = useQuery({
    queryKey: ['cliente-info', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })

  // Estado e pagamento por imóvel — RLS já restringe aos nossos próprios dados.
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['cliente-pagamentos', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, external_ref, address, visit_status, billing_status, fee_amount, portfolios(name)')
        .order('external_ref')
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const totalFaturado = properties
    .filter((p: any) => ['invoice_issued','paid'].includes(p.billing_status))
    .reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const totalPago = properties
    .filter((p: any) => p.billing_status === 'paid')
    .reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)

  return (
    <div>
      <PageHeader title="O meu perfil" subtitle={name || ''} />
      <div className="p-6 space-y-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Dados da entidade</h2>
          <p className="text-sm text-gray-600">{client?.name || '—'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Total facturado</p>
            <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalFaturado)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Total pago</p>
            <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(totalPago)}</p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Estado e pagamento por imóvel</h2>
          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
          ) : properties.length === 0 ? (
            <EmptyState message="Ainda não há imóveis associados." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-base text-sm">
                <thead>
                  <tr>
                    <th>Ref.</th>
                    <th>Morada</th>
                    <th>Projecto</th>
                    <th>Estado</th>
                    <th>Facturação</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.external_ref || '—'}</td>
                      <td>{p.address || '—'}</td>
                      <td>{p.portfolios?.name || '—'}</td>
                      <td><VisitBadge status={p.visit_status} /></td>
                      <td><BillingBadge status={p.billing_status} /></td>
                      <td>{p.fee_amount ? formatCurrency(p.fee_amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
