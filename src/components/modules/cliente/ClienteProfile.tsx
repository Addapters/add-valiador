import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, VisitBadge, BillingBadge, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { Pencil, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const CONTACT_FIELDS = [
  { key: 'contact_name',  label: 'Nome do contacto' },
  { key: 'contact_role',  label: 'Cargo/Função' },
  { key: 'contact_email', label: 'Email do contacto', type: 'email' },
  { key: 'contact_phone', label: 'Telefone do contacto' },
] as const

const BILLING_FIELDS = [
  { key: 'billing_nif',     label: 'NIF de faturação' },
  { key: 'billing_email',   label: 'Email para faturas', type: 'email' },
  { key: 'billing_address', label: 'Morada de faturação' },
  { key: 'billing_notes',   label: 'Notas (PO obrigatória, centro de custo, etc.)' },
] as const

const ENTITY_EDITABLE = [...CONTACT_FIELDS, ...BILLING_FIELDS]

export default function ClienteProfile() {
  const { name, clientId } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    if (client) {
      const initial: Record<string, string> = {}
      ENTITY_EDITABLE.forEach(f => { initial[f.key] = (client as any)[f.key] || '' })
      setForm(initial)
    }
  }, [client])

  function cancelEdit() {
    if (client) {
      const initial: Record<string, string> = {}
      ENTITY_EDITABLE.forEach(f => { initial[f.key] = (client as any)[f.key] || '' })
      setForm(initial)
    }
    setEditing(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!clientId) return
      const patch: Record<string, any> = {}
      ENTITY_EDITABLE.forEach(f => { patch[f.key] = form[f.key] || null })
      const { error } = await supabase.from('clients').update(patch).eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Dados actualizados'); qc.invalidateQueries({ queryKey: ['cliente-info'] }); setEditing(false) },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSaving(false),
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
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Dados da entidade</h2>
              <p className="text-sm text-gray-600 mt-0.5">{client?.name || '—'}</p>
              {[client?.nif && `NIF ${client.nif}`, client?.email, client?.phone, client?.address].filter(Boolean).length > 0 && (
                <p className="text-xs text-gray-400">
                  {[client?.nif && `NIF ${client.nif}`, client?.email, client?.phone, client?.address].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {!editing ? (
              <button className="btn text-xs flex items-center gap-1.5 flex-shrink-0" onClick={() => setEditing(true)}>
                <Pencil size={12} /> Editar
              </button>
            ) : (
              <div className="flex gap-1.5 flex-shrink-0">
                <button className="btn text-xs" onClick={cancelEdit}><X size={12} /> Cancelar</button>
                <button className="btn btn-primary text-xs" disabled={saving} onClick={() => { setSaving(true); save.mutate() }}>
                  <Check size={12} /> Guardar
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Pessoa de contacto</p>
              <div className="space-y-2.5">
                {CONTACT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] text-gray-400">{f.label}</label>
                    {editing ? (
                      <input className="input text-sm mt-0.5" type={(f as any).type || 'text'}
                        value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
                    ) : (
                      <p className={(client as any)?.[f.key] ? 'text-sm text-gray-800' : 'text-sm text-gray-300'}>
                        {(client as any)?.[f.key] || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Faturação</p>
              <div className="space-y-2.5">
                {BILLING_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] text-gray-400">{f.label}</label>
                    {editing ? (
                      <input className="input text-sm mt-0.5" type={(f as any).type || 'text'}
                        value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
                    ) : (
                      <p className={(client as any)?.[f.key] ? 'text-sm text-gray-800' : 'text-sm text-gray-300'}>
                        {(client as any)?.[f.key] || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Estes dados ficam visíveis para o Admin, para saber que informação usar ao emitir faturas.
          </p>
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
