import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import toast from 'react-hot-toast'

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: 'name',                  label: 'Nome' },
  { key: 'telefone',              label: 'Telefone' },
  { key: 'nif',                   label: 'NIF' },
  { key: 'ordem_profissional',    label: 'Ordem profissional (ex: Arq., Eng.)' },
  { key: 'cedula_profissional',   label: 'Nº de cédula profissional' },
  { key: 'seguro_rc_apolice',     label: 'Apólice de seguro de resp. civil' },
  { key: 'seguro_rc_validade',    label: 'Validade do seguro', type: 'date' },
  { key: 'zonas_atuacao',         label: 'Zonas de actuação' },
  { key: 'iban',                  label: 'IBAN para pagamentos' },
]

export default function PeritoProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

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
            <button className="btn btn-primary text-sm" disabled={saving} onClick={() => { setSaving(true); save.mutate() }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
