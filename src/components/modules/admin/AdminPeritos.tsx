import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Plus, Upload, X, Pencil, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const SIGNATURE_BUCKET = 'perito-assinaturas'

const PROFILE_FIELDS = [
  { key: 'numero_cmvm',       label: 'N.º CMVM' },
  { key: 'seguro_rc_apolice', label: 'Apólice N.º' },
  { key: 'seguro_rc_validade', label: 'Data de Validade', type: 'date' },
  { key: 'seguradora',        label: 'Seguradora' },
] as const

// ── Campo editável em linha (clique para editar, Enter/blur para guardar) ──
function InlineField({ value, type, onSave }: { value: string | null; type?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  if (!editing) return (
    <div className="flex items-center gap-1 group cursor-pointer whitespace-nowrap" onClick={() => { setVal(value || ''); setEditing(true) }}>
      <span className={value ? 'text-gray-700' : 'text-gray-300'}>
        {value ? (type === 'date' ? formatDate(value) : value) : '—'}
      </span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 text-gray-400 flex-shrink-0" />
    </div>
  )
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        className="border border-brand-300 rounded px-1.5 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-brand-400"
        type={type || 'text'} value={val} onChange={e => setVal(e.target.value)} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      />
      <button onClick={() => { onSave(val); setEditing(false) }} className="text-emerald-500"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-gray-400"><X size={12} /></button>
    </div>
  )
}

// ── Assinatura: thumbnail + upload ──────────────────────────────────────────
function SignatureCell({ peritoId, path, onUploaded }: { peritoId: string; path: string | null; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  async function loadPreview() {
    if (!path) return
    const { data } = await supabase.storage.from(SIGNATURE_BUCKET).createSignedUrl(path, 300)
    setSignedUrl(data?.signedUrl || null)
  }
  if (path && signedUrl === null) loadPreview()

  async function handleUpload(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const newPath = `${peritoId}/assinatura.${ext}`
    const { error } = await supabase.storage.from(SIGNATURE_BUCKET).upload(newPath, file, { upsert: true })
    setUploading(false)
    if (error) { toast.error(error.message); return }
    const { error: profErr } = await supabase.from('profiles').update({ assinatura_path: newPath }).eq('id', peritoId)
    if (profErr) { toast.error(profErr.message); return }
    toast.success('Assinatura carregada')
    setSignedUrl(null)
    onUploaded()
  }

  return (
    <div className="flex items-center gap-2">
      {path && signedUrl ? (
        <img src={signedUrl} alt="Assinatura" className="h-8 max-w-[100px] object-contain bg-white border border-gray-100 rounded" />
      ) : (
        <span className="text-xs text-gray-300">Sem assinatura</span>
      )}
      <label className="btn text-xs py-1 px-2 cursor-pointer">
        {uploading ? '…' : <Upload size={11} />}
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
      </label>
    </div>
  )
}

// ── Modal de criação de novo perito ─────────────────────────────────────────
// Esta área só cria contas de Perito Avaliador — contas de Cliente criam-se
// na tab Clientes, associadas à respectiva entidade.
function NewUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!email.trim() || !password.trim() || !name.trim()) { toast.error('Preenche todos os campos'); return }
    setSaving(true)
    const { error } = await supabase.rpc('admin_create_user', {
      p_email: email.trim(), p_password: password, p_name: name.trim(), p_role: 'perito',
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Perito criado')
    qc.invalidateQueries({ queryKey: ['admin-peritos'] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Novo perito avaliador</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input text-sm" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password provisória</label>
            <input className="input text-sm" type="text" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary text-sm w-full" disabled={saving} onClick={create}>
            {saving ? 'A criar…' : 'Criar perito'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPeritos() {
  const qc = useQueryClient()
  const [showNewUser, setShowNewUser] = useState(false)

  const { data: peritos = [], isLoading } = useQuery({
    queryKey: ['admin-peritos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, telefone, numero_cmvm, seguro_rc_apolice, seguro_rc_validade, seguradora, assinatura_path')
        .eq('role', 'perito')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // Projectos alocados a cada perito, derivado de properties.perito_avaliador
  // (a atribuição é feita por imóvel, não existe uma tabela de alocação directa).
  const { data: allocations = [] } = useQuery({
    queryKey: ['admin-peritos-allocations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('perito_avaliador, portfolios(id, name, clients(name))')
        .not('perito_avaliador', 'is', null)
      if (error) throw error
      return data || []
    },
  })

  function projectsFor(nome: string | null) {
    if (!nome) return []
    const map = new Map<string, string>()
    allocations
      .filter((a: any) => a.perito_avaliador === nome && a.portfolios?.id)
      .forEach((a: any) => {
        const label = a.portfolios?.clients?.name ? `${a.portfolios.clients.name} | ${a.portfolios.name}` : a.portfolios.name
        map.set(a.portfolios.id, label)
      })
    return [...map.values()]
  }

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from('profiles').update({ [field]: value || null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-peritos'] }),
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title="Gestão de Peritos Avaliadores"
        subtitle="Dados profissionais, assinaturas e projectos alocados"
        actions={
          <button className="btn btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowNewUser(true)}>
            <Plus size={14} /> Novo perito
          </button>
        }
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : peritos.length === 0 ? (
          <EmptyState message="Ainda não há peritos registados." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  {PROFILE_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                  <th>Assinatura</th>
                  <th>Projectos alocados</th>
                </tr>
              </thead>
              <tbody>
                {peritos.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-medium text-gray-800 whitespace-nowrap">{p.name || '—'}</td>
                    {PROFILE_FIELDS.map(f => (
                      <td key={f.key}>
                        <InlineField value={p[f.key]} type={(f as any).type}
                          onSave={val => updateField.mutate({ id: p.id, field: f.key, value: val })} />
                      </td>
                    ))}
                    <td>
                      <SignatureCell peritoId={p.id} path={p.assinatura_path} onUploaded={() => qc.invalidateQueries({ queryKey: ['admin-peritos'] })} />
                    </td>
                    <td className="max-w-[240px]">
                      {projectsFor(p.name).length === 0 ? (
                        <span className="text-xs text-gray-300">Sem projectos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {projectsFor(p.name).map(label => (
                            <span key={label} className="badge badge-gray">{label}</span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewUser && <NewUserModal onClose={() => setShowNewUser(false)} />}
    </div>
  )
}
