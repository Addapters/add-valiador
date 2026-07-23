import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, Badge, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { File, AlertTriangle, Mail, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

const ESTADOS = ['pendente','em_analise','atribuido','rejeitado','concluido'] as const
const ESTADO_LABELS: Record<string,string> = {
  pendente:    'Pendente',
  em_analise:  'Em análise',
  atribuido:   'Atribuído',
  rejeitado:   'Rejeitado',
  concluido:   'Concluído',
}
const ESTADO_VARIANT: Record<string, 'gray'|'blue'|'green'|'red'|'amber'> = {
  pendente:   'amber',
  em_analise: 'blue',
  atribuido:  'green',
  rejeitado:  'red',
  concluido:  'gray',
}
const TIPO_LABELS: Record<string,string> = { ad_hoc: 'Imóvel Avulso', carteira: 'Carteira', outro: 'Outro' }

export default function AdminRequests() {
  const qc = useQueryClient()
  const [filterEstado, setFilterEstado] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*, clients(name, contact_name, contact_email, contact_phone, email, phone), request_documents(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const { data: peritos = [] } = useQuery({
    queryKey: ['profiles-peritos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('role', 'perito').order('name')
      return (data || []) as { id: string; name: string }[]
    }
  })

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios-select'],
    queryFn: async () => {
      const { data } = await supabase.from('portfolios').select('id, name').order('name')
      return (data || []) as { id: string; name: string }[]
    }
  })

  const updateRequest = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from('requests').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-requests'] }),
    onError: (e: any) => toast.error(e.message)
  })

  const filtered = filterEstado ? requests.filter((r: any) => r.estado === filterEstado) : requests

  return (
    <div>
      <PageHeader
        title="Pedidos de clientes"
        subtitle="Recebe, analisa e atribui os pedidos submetidos pelos clientes"
        actions={
          <select className="input text-sm w-48" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos os estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
          </select>
        }
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : filtered.length === 0 ? (
          <EmptyState message="Sem pedidos para mostrar." />
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{r.titulo || TIPO_LABELS[r.tipo]}</span>
                      <Badge variant={ESTADO_VARIANT[r.estado] || 'gray'}>{ESTADO_LABELS[r.estado] || r.estado}</Badge>
                      <Badge variant="blue">{TIPO_LABELS[r.tipo] || r.tipo}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{r.clients?.name || 'Cliente desconhecido'}</p>
                    {(r.clients?.contact_name || r.clients?.contact_email || r.clients?.contact_phone || r.clients?.email || r.clients?.phone) && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                        {r.clients?.contact_name && <span>{r.clients.contact_name}</span>}
                        {(r.clients?.contact_email || r.clients?.email) && (
                          <span className="flex items-center gap-1"><Mail size={11}/>{r.clients.contact_email || r.clients.email}</span>
                        )}
                        {(r.clients?.contact_phone || r.clients?.phone) && (
                          <span className="flex items-center gap-1"><Phone size={11}/>{r.clients.contact_phone || r.clients.phone}</span>
                        )}
                      </p>
                    )}
                    {r.descricao && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{r.descricao}</p>}

                    {/* Documentos anexados pelo cliente */}
                    <div className="mt-2">
                      {r.request_documents?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {r.request_documents.map((doc: any) => {
                            const { data: { publicUrl } } = supabase.storage.from('request-documents').getPublicUrl(doc.storage_path)
                            return (
                              <a key={doc.id} href={publicUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg px-2 py-1 text-brand-600">
                                <File size={12} className="flex-shrink-0"/>{doc.name}
                              </a>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 w-fit">
                          <AlertTriangle size={12} className="flex-shrink-0"/> Sem documentos anexados a este pedido
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-2">Submetido em {formatDate(r.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
                  <div>
                    <label className="label">Estado</label>
                    <select className="input text-xs" value={r.estado}
                      onChange={e => updateRequest.mutate({ id: r.id, patch: { estado: e.target.value } })}>
                      {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Perito atribuído</label>
                    <select className="input text-xs" value={r.perito_id || ''}
                      onChange={e => updateRequest.mutate({ id: r.id, patch: { perito_id: e.target.value || null } })}>
                      <option value="">— por atribuir —</option>
                      {peritos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Projecto/carteira ligado</label>
                    <select className="input text-xs" value={r.portfolio_id || ''}
                      onChange={e => updateRequest.mutate({ id: r.id, patch: { portfolio_id: e.target.value || null } })}>
                      <option value="">— nenhum —</option>
                      {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Prazo de entrega</label>
                    <input className="input text-xs" type="date" value={r.prazo_entrega || ''}
                      onChange={e => updateRequest.mutate({ id: r.id, patch: { prazo_entrega: e.target.value || null } })}/>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="label">Notas internas</label>
                  <textarea className="input text-xs" rows={2} defaultValue={r.notas_admin || ''}
                    onBlur={e => { if (e.target.value !== (r.notas_admin || '')) updateRequest.mutate({ id: r.id, patch: { notas_admin: e.target.value || null } }) }}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
