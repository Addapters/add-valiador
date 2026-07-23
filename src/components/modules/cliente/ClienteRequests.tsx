import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, Badge, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import { Paperclip, File, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ESTADO_LABELS: Record<string,string> = {
  pendente: 'Pendente', em_analise: 'Em análise', atribuido: 'Atribuído', rejeitado: 'Rejeitado', concluido: 'Concluído',
}
const ESTADO_VARIANT: Record<string, 'gray'|'blue'|'green'|'red'|'amber'> = {
  pendente: 'amber', em_analise: 'blue', atribuido: 'green', rejeitado: 'red', concluido: 'gray',
}
const TIPO_LABELS: Record<string,string> = {
  ad_hoc: 'Imóvel Avulso', carteira: 'Carteira', outro: 'Outro',
}

export default function ClienteRequests() {
  const { clientId, user } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ tipo: 'ad_hoc', titulo: '', descricao: '' })
  const [files, setFiles] = useState<File[]>([])

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['cliente-requests', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase.from('requests').select('*, request_documents(*)').eq('client_id', clientId).order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Conta sem cliente associado.')
      const { data, error } = await supabase.from('requests').insert({
        client_id: clientId, created_by: user?.id,
        tipo: form.tipo, titulo: form.titulo || null, descricao: form.descricao || null,
      }).select().single()
      if (error) throw error
      for (const file of files) {
        const path = `${data.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('request-documents').upload(path, file)
        if (upErr) throw upErr
        await supabase.from('request_documents').insert({
          request_id: data.id, storage_path: path, name: file.name, size_bytes: file.size,
        })
      }
    },
    onSuccess: () => {
      toast.success('Pedido submetido')
      setForm({ tipo: 'ad_hoc', titulo: '', descricao: '' })
      setFiles([])
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['cliente-requests'] })
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSubmitting(false),
  })

  function handleSubmit() {
    if (files.length === 0 && !confirm('Não anexaste nenhum documento a este pedido. Tens a certeza que queres submeter sem documentos?')) {
      return
    }
    setSubmitting(true)
    createRequest.mutate()
  }

  return (
    <div>
      <PageHeader title="Os meus pedidos"
        actions={<button className="btn btn-primary text-sm" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : 'Novo pedido'}</button>}
      />
      <div className="p-6 space-y-4">
        {showForm && (
          <div className="card space-y-3">
            <div>
              <label className="label">Tipo de pedido</label>
              <select className="input text-sm" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="ad_hoc">Imóvel Avulso</option>
                <option value="carteira">Carteira</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Título</label>
              <input className="input text-sm" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Avaliação urgente — Rua X"/>
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea className="input text-sm" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes do que precisas"/>
            </div>
            <div>
              <label className="label">Documentos (opcional)</label>
              <label className="btn text-xs flex items-center gap-1.5 w-fit cursor-pointer">
                <Paperclip size={12}/> Anexar ficheiros
                <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))}/>
              </label>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <span className="flex items-center gap-1.5 min-w-0 text-gray-600 truncate"><File size={12} className="flex-shrink-0"/>{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={12}/></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="btn btn-primary text-sm" disabled={submitting} onClick={handleSubmit}>
              Submeter pedido
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : requests.length === 0 ? (
          <EmptyState message="Ainda não submeteste nenhum pedido." />
        ) : (
          <div className="space-y-3">
            {requests.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-800 text-sm">{r.titulo || TIPO_LABELS[r.tipo] || r.tipo}</span>
                  <Badge variant={ESTADO_VARIANT[r.estado] || 'gray'}>{ESTADO_LABELS[r.estado] || r.estado}</Badge>
                </div>
                {r.descricao && <p className="text-sm text-gray-600 mt-2">{r.descricao}</p>}
                {r.request_documents?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.request_documents.map((doc: any) => {
                      const { data: { publicUrl } } = supabase.storage.from('request-documents').getPublicUrl(doc.storage_path)
                      return (
                        <a key={doc.id} href={publicUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                          <File size={12} className="flex-shrink-0"/>{doc.name}
                        </a>
                      )
                    })}
                  </div>
                )}
                {r.prazo_entrega && <p className="text-xs text-gray-500 mt-2">Prazo previsto: {formatDate(r.prazo_entrega)}</p>}
                {r.notas_admin && (
                  <div className="mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
                    <span className="font-medium">Nota do Admin: </span>{r.notas_admin}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Submetido em {formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
