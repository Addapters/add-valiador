import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Plus, Upload, X, Pencil, Check, UserCircle, Briefcase } from 'lucide-react'
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

// ── Modal de perfil do perito — dados completos + atribuição de projectos ──
function PeritoProfileModal({ perito, projects, portfolios, onClose, onChanged }: {
  perito: any; projects: string[]; portfolios: { id: string; label: string }[]; onClose: () => void; onChanged: () => void
}) {
  const [selectedPortfolio, setSelectedPortfolio] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  if (perito.assinatura_path && signedUrl === null) {
    supabase.storage.from(SIGNATURE_BUCKET).createSignedUrl(perito.assinatura_path, 300)
      .then(({ data }) => setSignedUrl(data?.signedUrl || ''))
  }

  async function assignProject() {
    if (!selectedPortfolio || !perito.name) return
    setAssigning(true)
    const { error } = await supabase.from('properties').update({ perito_avaliador: perito.name }).eq('portfolio_id', selectedPortfolio)
    setAssigning(false)
    if (error) { toast.error(error.message); return }
    toast.success('Projecto atribuído')
    setSelectedPortfolio('')
    onChanged()
  }

  const CONTACT_FIELDS = [
    { key: 'telefone', label: 'Telefone' },
    { key: 'nif',      label: 'NIF' },
    { key: 'iban',     label: 'IBAN' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(perito.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">{perito.name || '—'}</h2>
              <p className="text-xs text-gray-400">Perito Avaliador</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Contacto</p>
            <div className="space-y-1.5">
              {CONTACT_FIELDS.map(f => (
                <p key={f.key} className="text-xs text-gray-600 flex justify-between">
                  <span className="text-gray-400">{f.label}</span>{perito[f.key] || '—'}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Dados profissionais</p>
            <div className="space-y-1.5">
              {PROFILE_FIELDS.map(f => (
                <p key={f.key} className="text-xs text-gray-600 flex justify-between">
                  <span className="text-gray-400">{f.label}</span>
                  {perito[f.key] ? ((f as any).type === 'date' ? formatDate(perito[f.key]) : perito[f.key]) : '—'}
                </p>
              ))}
            </div>
          </div>
        </div>

        {perito.zonas_atuacao && (
          <p className="text-xs text-gray-500 mb-4"><span className="text-gray-400">Zonas de actuação: </span>{perito.zonas_atuacao}</p>
        )}

        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Assinatura</p>
          {signedUrl ? (
            <img src={signedUrl} alt="Assinatura" className="h-10 max-w-[140px] object-contain bg-white border border-gray-100 rounded" />
          ) : (
            <span className="text-xs text-gray-300">Sem assinatura</span>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
            <Briefcase size={11}/> Projectos atribuídos
          </p>
          {projects.length === 0 ? (
            <p className="text-xs text-gray-300 mb-3">Sem projectos atribuídos.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {projects.map(label => <span key={label} className="badge badge-gray">{label}</span>)}
            </div>
          )}
          <div className="flex gap-1.5">
            <select className="input text-xs flex-1" value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)}>
              <option value="">Seleccionar projecto para atribuir…</option>
              {portfolios.map(pf => <option key={pf.id} value={pf.id}>{pf.label}</option>)}
            </select>
            <button className="btn btn-primary text-xs whitespace-nowrap" disabled={!selectedPortfolio || assigning} onClick={assignProject}>
              {assigning ? 'A atribuir…' : 'Atribuir'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Atribui todos os imóveis desse projecto a este perito.</p>
        </div>
      </div>
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
  const [selectedPerito, setSelectedPerito] = useState<any>(null)

  const { data: peritos = [], isLoading } = useQuery({
    queryKey: ['admin-peritos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, telefone, nif, iban, zonas_atuacao, numero_cmvm, seguro_rc_apolice, seguro_rc_validade, seguradora, assinatura_path')
        .eq('role', 'perito')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // Todos os projectos existentes, para a atribuição a partir do perfil do perito.
  const { data: allPortfolios = [] } = useQuery({
    queryKey: ['admin-peritos-portfolios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('portfolios').select('id, name, clients(name)').order('name')
      if (error) throw error
      return (data || []).map((pf: any) => ({
        id: pf.id,
        label: pf.clients?.name ? `${pf.clients.name} | ${pf.name}` : pf.name,
      }))
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
                    <td className="font-medium text-gray-800 whitespace-nowrap">
                      <button className="flex items-center gap-1.5 hover:text-brand-600" onClick={() => setSelectedPerito(p)} title="Ver perfil">
                        <UserCircle size={14} className="text-gray-300"/>{p.name || '—'}
                      </button>
                    </td>
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

      {selectedPerito && (
        <PeritoProfileModal
          perito={selectedPerito}
          projects={projectsFor(selectedPerito.name)}
          portfolios={allPortfolios}
          onClose={() => setSelectedPerito(null)}
          onChanged={() => { qc.invalidateQueries({ queryKey: ['admin-peritos-allocations'] }); qc.invalidateQueries({ queryKey: ['admin-peritos'] }) }}
        />
      )}
    </div>
  )
}
