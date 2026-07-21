import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'name',                  label: 'Nome' },
  { key: 'telefone',              label: 'Telefone' },
  { key: 'nif',                   label: 'NIF' },
  { key: 'ordem_profissional',    label: 'Ordem profissional (ex: Arq., Eng.)' },
  { key: 'cedula_profissional',   label: 'Nº de cédula profissional' },
  { key: 'numero_cmvm',           label: 'N.º CMVM' },
  { key: 'seguro_rc_apolice',     label: 'Apólice N.º (seguro resp. civil)' },
  { key: 'seguro_rc_validade',    label: 'Data de validade do seguro', type: 'date' },
  { key: 'seguradora',            label: 'Seguradora' },
  { key: 'zonas_atuacao',         label: 'Zonas de actuação' },
  { key: 'iban',                  label: 'IBAN para pagamentos' },
]

const SIGNATURE_BUCKET = 'perito-assinaturas'

export default function PeritoProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
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
      FIELDS.forEach(f => { initial[f.key] = profile[f.key] || '' })
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
      FIELDS.forEach(f => { patch[f.key] = form[f.key] || null })
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Perfil actualizado'); qc.invalidateQueries({ queryKey: ['perito-profile'] }) },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSaving(false),
  })

  return (
    <div>
      <PageHeader title="O meu perfil" subtitle="Dados profissionais usados nos relatórios e certificações" />
      <div className="p-6 max-w-2xl">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : (
          <div className="card space-y-3">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input className="input text-sm" type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}/>
              </div>
            ))}

            <div>
              <label className="label">Assinatura (usada para assinar relatórios)</label>
              <div className="flex items-center gap-3">
                {signedUrl ? (
                  <img src={signedUrl} alt="Assinatura" className="h-12 max-w-[160px] object-contain bg-white border border-gray-200 rounded" />
                ) : (
                  <span className="text-xs text-gray-400">Ainda não carregaste uma assinatura.</span>
                )}
                <label className="btn text-sm flex items-center gap-1.5 cursor-pointer">
                  <Upload size={13} /> {uploading ? 'A carregar…' : 'Carregar imagem'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleSignatureUpload(f); e.target.value = '' }} />
                </label>
              </div>
            </div>

            <button className="btn btn-primary text-sm" disabled={saving} onClick={() => { setSaving(true); save.mutate() }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
