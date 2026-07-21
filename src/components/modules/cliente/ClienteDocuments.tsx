import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import { Loader2, FileText, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const BUCKET = 'client-documents'

export default function ClienteDocuments() {
  const { clientId, user } = useAuth()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['cliente-documentos', clientId],
    queryFn: async () => {
      if (!clientId) return []
      const { data, error } = await supabase.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const registerDoc = useMutation({
    mutationFn: async ({ path, nome }: { path: string; nome: string }) => {
      const { error } = await supabase.from('client_documents').insert({
        client_id: clientId, storage_path: path, nome_ficheiro: nome, tipo: 'relatorio_anterior', uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente-documentos'] }),
    onError: (e: any) => toast.error(e.message)
  })

  async function handleUpload(file: File) {
    if (!clientId) return
    setUploading(true)
    const path = `${clientId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file)
    setUploading(false)
    if (error) { toast.error(error.message); return }
    registerDoc.mutate({ path, nome: file.name })
    toast.success('Documento carregado')
  }

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (error) { toast.error(error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div>
      <PageHeader title="Documentos" subtitle="Relatórios e informação que já tens sobre os teus imóveis" />
      <div className="p-6 space-y-4">
        <div className="card">
          <label className="btn btn-primary text-sm inline-flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
            Carregar documento
            <input type="file" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}/>
          </label>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : docs.length === 0 ? (
          <EmptyState message="Ainda não carregaste nenhum documento." />
        ) : (
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-gray-400 flex-shrink-0"/>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{d.nome_ficheiro || d.storage_path}</p>
                    <p className="text-xs text-gray-400">{formatDate(d.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => openDoc(d.storage_path)} className="text-brand-500 hover:text-brand-700 flex-shrink-0">
                  <ExternalLink size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
