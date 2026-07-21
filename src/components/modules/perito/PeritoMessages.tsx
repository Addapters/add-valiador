import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function PeritoMessages() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')

  const { data: messages = [] } = useQuery({
    queryKey: ['perito-messages', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase.from('messages').select('*').eq('perito_id', user.id).order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!user,
    refetchInterval: 15000,
  })

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!draft.trim() || !user) return
      const { error } = await supabase.from('messages').insert({ perito_id: user.id, remetente_id: user.id, corpo: draft.trim() })
      if (error) throw error
    },
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['perito-messages'] }) },
    onError: (e: any) => toast.error(e.message)
  })

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('messages').update({ lida_at: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    }
  })

  useEffect(() => {
    if (!user) return
    const unreadIds = messages.filter((m: any) => m.remetente_id !== user.id && !m.lida_at).map((m: any) => m.id)
    if (unreadIds.length) markRead.mutate(unreadIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Conversa com o Admin" />
      <div className="p-6">
        <div className="card flex flex-col p-0 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <EmptyState message="Ainda não há mensagens. Escreve à equipa se tiveres dúvidas." />
            ) : messages.map((m: any) => (
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
        </div>
      </div>
    </div>
  )
}
