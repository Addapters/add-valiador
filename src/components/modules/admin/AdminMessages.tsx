import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { Link } from 'react-router-dom'
import { Search, Send, Phone, BadgeCheck, Shield, MapPin, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}
function formatDayTime(iso: string) {
  const d = new Date(iso)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dOnly = new Date(d); dOnly.setHours(0, 0, 0, 0)
  if (dOnly.getTime() === hoje.getTime()) return formatTime(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

export default function AdminMessages() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedPerito, setSelectedPerito] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)

  const { data: peritos = [] } = useQuery({
    queryKey: ['profiles-peritos-select'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, telefone, numero_cmvm, seguradora, zonas_atuacao')
        .eq('role', 'perito')
        .order('name')
      return (data || []) as any[]
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

  // Projectos alocados a cada perito (mesmo padrão usado em Gestão de Peritos).
  const { data: allocations = [] } = useQuery({
    queryKey: ['admin-peritos-allocations'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('perito_avaliador, portfolios(id, name, clients(name))').not('perito_avaliador', 'is', null)
      return data || []
    },
  })
  function projectsFor(nome: string | null) {
    if (!nome) return []
    const map = new Map<string, string>()
    allocations.filter((a: any) => a.perito_avaliador === nome && a.portfolios?.id)
      .forEach((a: any) => {
        const label = a.portfolios?.clients?.name ? `${a.portfolios.clients.name} | ${a.portfolios.name}` : a.portfolios.name
        map.set(a.portfolios.id, label)
      })
    return [...map.values()]
  }

  const unreadByPerito = useMemo(() => {
    const map: Record<string, number> = {}
    messages.forEach((m: any) => {
      if (m.remetente_id !== user?.id && !m.lida_at) map[m.perito_id] = (map[m.perito_id] || 0) + 1
    })
    return map
  }, [messages, user])

  const lastMessageByPerito = useMemo(() => {
    const map = new Map<string, any>()
    messages.forEach((m: any) => {
      const cur = map.get(m.perito_id)
      if (!cur || m.created_at > cur.created_at) map.set(m.perito_id, m)
    })
    return map
  }, [messages])

  const visiblePeritos = useMemo(() => {
    return peritos
      .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !onlyUnread || (unreadByPerito[p.id] || 0) > 0)
      .sort((a, b) => {
        const la = lastMessageByPerito.get(a.id)?.created_at || ''
        const lb = lastMessageByPerito.get(b.id)?.created_at || ''
        return lb.localeCompare(la)
      })
  }, [peritos, search, onlyUnread, unreadByPerito, lastMessageByPerito])

  const activePerito = peritos.find(p => p.id === selectedPerito) || null

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
    },
    onError: (e: any) => toast.error(e.message)
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
      <div className="p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4" style={{ height: 'calc(100vh - 140px)' }}>

        {/* Coluna 1 — lista de conversas */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"/>
              <input className="input text-xs pl-7" placeholder="Pesquisar perito…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setOnlyUnread(false)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${!onlyUnread ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Todas</button>
              <button onClick={() => setOnlyUnread(true)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${onlyUnread ? 'bg-brand-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Não lidas</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visiblePeritos.length === 0 ? (
              <EmptyState message="Sem peritos para mostrar." />
            ) : visiblePeritos.map(p => {
              const last = lastMessageByPerito.get(p.id)
              const unread = unreadByPerito[p.id] || 0
              return (
                <button key={p.id} onClick={() => setSelectedPerito(p.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex items-start gap-2.5 hover:bg-gray-50 ${selectedPerito === p.id ? 'bg-brand-50' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{p.name}</span>
                      {last && <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDayTime(last.created_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-gray-400 truncate">{last ? last.corpo : 'Sem mensagens ainda'}</span>
                      {unread > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center flex-shrink-0">{unread}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Coluna 2 — conversa */}
        <div className="card flex flex-col p-0 overflow-hidden">
          {!activePerito ? (
            <EmptyState message="Selecciona um perito para ver a conversa." />
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {initials(activePerito.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{activePerito.name}</p>
                  <p className="text-[11px] text-gray-400">Perito Avaliador</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {thread.length === 0 ? (
                  <EmptyState message="Ainda não há mensagens nesta conversa." />
                ) : thread.map((m: any) => (
                  <div key={m.id} className={`max-w-[70%] ${m.remetente_id === user?.id ? 'ml-auto text-right' : ''}`}>
                    <div className={`inline-block px-3 py-2 rounded-2xl text-sm text-left ${m.remetente_id === user?.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {m.corpo}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatTime(m.created_at)}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input className="input text-sm flex-1 rounded-full" placeholder="Escreve uma mensagem…" value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) sendMessage.mutate() }}/>
                <button className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-brand-600 transition-colors"
                  disabled={!draft.trim()} onClick={() => sendMessage.mutate()}>
                  <Send size={14}/>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Coluna 3 — informação do perito */}
        {activePerito && (
          <div className="card overflow-y-auto">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-base font-bold mb-2">
                {initials(activePerito.name)}
              </div>
              <p className="text-sm font-semibold text-gray-800">{activePerito.name}</p>
              <p className="text-xs text-gray-400">Perito Avaliador</p>
            </div>

            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Informação geral</p>
            <div className="space-y-2 mb-4">
              {activePerito.telefone && (
                <p className="text-xs text-gray-600 flex items-center gap-2"><Phone size={12} className="text-gray-300 flex-shrink-0"/>{activePerito.telefone}</p>
              )}
              {activePerito.numero_cmvm && (
                <p className="text-xs text-gray-600 flex items-center gap-2"><BadgeCheck size={12} className="text-gray-300 flex-shrink-0"/>N.º CMVM {activePerito.numero_cmvm}</p>
              )}
              {activePerito.seguradora && (
                <p className="text-xs text-gray-600 flex items-center gap-2"><Shield size={12} className="text-gray-300 flex-shrink-0"/>{activePerito.seguradora}</p>
              )}
              {activePerito.zonas_atuacao && (
                <p className="text-xs text-gray-600 flex items-center gap-2"><MapPin size={12} className="text-gray-300 flex-shrink-0"/>{activePerito.zonas_atuacao}</p>
              )}
            </div>

            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
              <Briefcase size={11}/> Projectos atribuídos
            </p>
            {projectsFor(activePerito.name).length === 0 ? (
              <p className="text-xs text-gray-300 mb-3">Sem projectos atribuídos.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {projectsFor(activePerito.name).map(label => <span key={label} className="badge badge-gray">{label}</span>)}
              </div>
            )}

            <Link to="/admin/peritos" className="text-xs text-brand-600 hover:underline">Ver perfil completo →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
