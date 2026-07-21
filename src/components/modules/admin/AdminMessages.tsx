import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState, Badge } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function AdminMessages() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedPerito, setSelectedPerito] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const { data: peritos = [] } = useQuery({
    queryKey: ['profiles-peritos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('role', 'perito').order('name')
      return (data || []) as { id: string; name: string }[]
    }
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['admin-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    refetchInterval: 15000,
  })

  const unreadByPerito = useMemo(() => {
    const map: Record<string, number> = {}
    messages.forEach((m: any) => {
      if (m.remetente_id !== user?.id && !m.lida_at) map[m.perito_id] = (map[m.perito_id] || 0) + 1
    })
    return map
  }, [messages, user])

  const thread = useMemo(
    () => messages.filter((m: any) => m.perito_id === selectedPerito),
    [messages, selectedPerito]
  )

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!selectedPerito || !draft.trim() || !user) return
      const { error } = await supabase.from('messages').insert({
        perito_id: selectedPerito, remetente_id: user.id, corpo: draft.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['admin-messages'] }) },
    onError: (e: any) => toast.error(e.message)
  })

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('messages').update({ lida_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-messages'] })
      // Limpa de imediato os indicadores de "mensagem nova" na sidebar e no dashboard.
      qc.invalidateQueries({ queryKey: ['sidebar-unread-messages'] })
      qc.invalidateQueries({ queryKey: ['dashboard-unread-messages'] })
    }
  })

  useEffect(() => {
    if (!selectedPerito || !user) return
    const unreadIds = thread.filter((m: any) => m.remetente_id !== user.id && !m.lida_at).map((m: any) => m.id)
    if (unreadIds.length) markRead.mutate(unreadIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPerito, thread.length])

  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Conversas com os peritos avaliadores" />
      <div className="p-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4" style={{ height: 'calc(100vh - 140px)' }}>
        <div className="card overflow-y-auto p-0">
          {peritos.length === 0 ? <EmptyState message="Sem peritos registados." /> : peritos.map(p => (
            <button key={p.id} onClick={() => setSelectedPerito(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 ${selectedPerito === p.id ? 'bg-brand-50' : ''}`}>
              <span className="text-sm text-gray-700">{p.name}</span>
              {unreadByPerito[p.id] > 0 && <Badge variant="red">{unreadByPerito[p.id]}</Badge>}
            </button>
          ))}
        </div>

        <div className="card flex flex-col p-0 overflow-hidden">
          {!selectedPerito ? (
            <EmptyState message="Selecciona um perito para ver a conversa." />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {thread.length === 0 ? (
                  <EmptyState message="Ainda não há mensagens nesta conversa." />
                ) : thread.map((m: any) => (
                  <div key={m.id} className={`max-w-[70%] ${m.remetente_id === user?.id ? 'ml-auto text-right' : ''}`}>
                    <div className={`inline-block px-3 py-2 rounded-xl text-sm ${m.remetente_id === user?.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {m.corpo}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(m.created_at)}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input className="input text-sm flex-1" placeholder="Escreve uma mensagem…" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) sendMessage.mutate() }}/>
                <button className="btn btn-primary text-sm" disabled={!draft.trim()} onClick={() => sendMessage.mutate()}>Enviar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
