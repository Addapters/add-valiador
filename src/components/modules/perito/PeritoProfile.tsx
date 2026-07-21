import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatDate } from '@/lib/utils'
import { Upload, Pencil, X, Check, Phone, CreditCard, Landmark, BadgeCheck, FileText, CalendarDays, Shield, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

// Campos editáveis, agrupados como no separador visual (contacto vs. dados
// profissionais). "name" é tratado à parte, no cabeçalho do perfil.
const CONTACT_FIELDS = [
  { key: 'telefone', label: 'Telefone', icon: Phone },
  { key: 'nif',      label: 'NIF',      icon: CreditCard },
  { key: 'iban',     label: 'IBAN',     icon: Landmark },
] as const

const PROFESSIONAL_FIELDS = [
  { key: 'numero_cmvm',        label: 'N.º CMVM',                    icon: BadgeCheck },
  { key: 'seguro_rc_apolice',  label: 'Apólice de seguro (resp. civil)', icon: FileText },
  { key: 'seguro_rc_validade', label: 'Validade do seguro', type: 'date', icon: CalendarDays },
  { key: 'seguradora',         label: 'Seguradora',                  icon: Shield },
  { key: 'zonas_atuacao',      label: 'Zonas de actuação',            icon: MapPin },
] as const

const ALL_FIELDS = [{ key: 'name', label: 'Nome' }, ...CONTACT_FIELDS, ...PROFESSIONAL_FIELDS]

const SIGNATURE_BUCKET = 'perito-assinaturas'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase()
}

// ── Separador "Dados profissionais" ─────────────────────────────────────────
function DadosProfissionais() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['perito-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (profile) {
      const initial: Record<string, string> = {}
      ALL_FIELDS.forEach(f => { initial[f.key] = profile[f.key] || '' })
      setForm(initial)
    }
  }, [profile])

  useEffect(() => {
    if (!profile?.assinatura_path) { setSignedUrl(null); return }
    supabase.storage.from(SIGNATURE_BUCKET).createSignedUrl(profile.assinatura_path, 300)
      .then(({ data }) => setSignedUrl(data?.signedUrl || null))
  }, [profile?.assinatura_path])

  async function handleSignatureUpload(file: File) {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/assinatura.${ext}`
    const { error } = await supabase.storage.from(SIGNATURE_BUCKET).upload(path, file, { upsert: true })
    if (!error) {
      const { error: profErr } = await supabase.from('profiles').update({ assinatura_path: path }).eq('id', user.id)
      if (profErr) toast.error(profErr.message)
      else { toast.success('Assinatura actualizada'); qc.invalidateQueries({ queryKey: ['perito-profile'] }) }
    } else {
      toast.error(error.message)
    }
    setUploading(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return
      const patch: Record<string, any> = {}
      ALL_FIELDS.forEach(f => { patch[f.key] = form[f.key] || null })
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Perfil actualizado'); qc.invalidateQueries({ queryKey: ['perito-profile'] }); setEditing(false) },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSaving(false),
  })

  function cancelEdit() {
    if (profile) {
      const initial: Record<string, string> = {}
      ALL_FIELDS.forEach(f => { initial[f.key] = profile[f.key] || '' })
      setForm(initial)
    }
    setEditing(false)
  }

  if (isLoading) return <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>

  // Uma linha de informação: ícone + label + valor (ou input, em modo edição)
  function InfoRow({ field }: { field: { key: string; label: string; type?: string; icon: any } }) {
    const Icon = field.icon
    const value = profile?.[field.key]
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-400">{field.label}</p>
          {editing ? (
            <input className="input text-sm mt-1" type={field.type || 'text'}
              value={form[field.key] || ''}
              onChange={e => setForm(v => ({ ...v, [field.key]: e.target.value }))} />
          ) : (
            <p className={value ? 'text-sm text-gray-800 truncate' : 'text-sm text-gray-300'}>
              {value ? (field.type === 'date' ? formatDate(value) : value) : '—'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Cabeçalho: avatar (iniciais), nome e acções */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-semibold flex-shrink-0">
              {initials(profile?.name)}
            </div>
            <div className="min-w-0">
              {editing ? (
                <input className="input text-sm font-semibold w-56" value={form.name || ''}
                  onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Nome" />
              ) : (
                <h2 className="text-lg font-semibold text-gray-900 truncate">{profile?.name || '—'}</h2>
              )}
              <p className="text-sm text-gray-500">Perito Avaliador</p>
              {profile?.zonas_atuacao && !editing && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {profile.zonas_atuacao}</p>
              )}
            </div>
          </div>
          {!editing ? (
            <button className="btn text-xs flex items-center gap-1.5 flex-shrink-0" onClick={() => setEditing(true)}>
              <Pencil size={12} /> Editar perfil
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Informação de contacto</p>
          <div className="divide-y divide-gray-50">
            {CONTACT_FIELDS.map(f => <InfoRow key={f.key} field={f} />)}
          </div>
        </div>
        <div className="card">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Dados profissionais</p>
          <div className="divide-y divide-gray-50">
            {PROFESSIONAL_FIELDS.map(f => <InfoRow key={f.key} field={f} />)}
          </div>
        </div>
      </div>

      <div className="card">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Assinatura</p>
        <p className="text-xs text-gray-400 mb-3">Imagem usada para assinar os relatórios gerados na plataforma.</p>
        <div className="flex items-center gap-4">
          {signedUrl ? (
            <img src={signedUrl} alt="Assinatura" className="h-14 max-w-[180px] object-contain bg-white border border-gray-200 rounded-lg px-3" />
          ) : (
            <div className="h-14 w-44 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
              Sem assinatura
            </div>
          )}
          <label className="btn text-xs flex items-center gap-1.5 cursor-pointer">
            <Upload size={11} /> {uploading ? 'A carregar…' : 'Carregar imagem'}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSignatureUpload(f); e.target.value = '' }} />
          </label>
        </div>
      </div>
    </div>
  )
}

export default function PeritoProfile() {
  return (
    <div>
      <PageHeader title="O meu perfil" subtitle="Dados profissionais usados nos relatórios e certificações" />
      <div className="p-6">
        <DadosProfissionais />
      </div>
    </div>
  )
}
