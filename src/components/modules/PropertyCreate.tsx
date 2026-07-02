import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import toast from 'react-hot-toast'

const PROPERTY_TYPES = ['Apartamento','Armazém','Arrumos','Concessão administrativa','Direitos de superfície','Edifício','Fundo de comércio','Garagem','Loja','Moradia','Navio','Outro anexo','Terreno','Aeronave']

async function generateRef(): Promise<string> {
  const { data } = await supabase
    .from('properties')
    .select('ref')
    .like('ref', 'AV-%')
  const max = (data || []).reduce((acc, row) => {
    const n = parseInt((row.ref || '').replace('AV-', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `AV-${String(max + 1).padStart(4, '0')}`
}

export default function PropertyCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    portfolio_id: searchParams.get('portfolio') || '',
    external_ref: '',
    property_type: '',
    typology: '',
    street: '',
    number: '',
    postal_code: '',
    municipality: '',
    district: '',
  })

  const { data: portfolios = [] } = useQuery({
    queryKey: ['portfolios-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, name, client_id, clients(name)')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const create = useMutation({
    mutationFn: async () => {
      if (!form.portfolio_id) throw new Error('Selecciona um portfólio')

      const portfolio = portfolios.find((p: any) => p.id === form.portfolio_id)
      const clientId = (portfolio as any)?.client_id ?? null

      const ref = await generateRef()   // sempre auto-gerada, não exposta ao utilizador

      const { data, error } = await supabase
        .from('properties')
        .insert({
          portfolio_id: form.portfolio_id,
          client_id: clientId,
          ref,
          external_ref: form.external_ref.trim() || null,
          property_type: form.property_type || null,
          typology: form.typology.trim() || null,
          street: form.street.trim() || null,
          number: form.number.trim() || null,
          postal_code: form.postal_code.trim() || null,
          municipality: form.municipality.trim() || null,
          district: form.district.trim() || null,
          visit_status: 'pending',
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    },
    onSuccess: (id) => {
      toast.success('Imóvel criado')
      navigate(`/properties/${id}`)
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar imóvel'),
  })

  return (
    <div>
      <PageHeader title="Novo imóvel" subtitle="Preenche os campos — todos são opcionais excepto o portfólio" />

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        <div>
          <label className="label">Portfólio *</label>
          <select className="input w-full" value={form.portfolio_id} onChange={e => set('portfolio_id', e.target.value)}>
            <option value="">— selecciona —</option>
            {portfolios.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.clients?.name ? `${p.clients.name} | ${p.name}` : p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Ref. externa (cliente)</label>
          <input className="input w-full" value={form.external_ref} onChange={e => set('external_ref', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo de imóvel</label>
            <select className="input w-full" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
              <option value="">—</option>
              {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipologia</label>
            <input className="input w-full" placeholder="ex: T2" value={form.typology} onChange={e => set('typology', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Rua</label>
            <input className="input w-full" value={form.street} onChange={e => set('street', e.target.value)} />
          </div>
          <div>
            <label className="label">Número</label>
            <input className="input w-full" value={form.number} onChange={e => set('number', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Código Postal</label>
            <input className="input w-full" placeholder="1234-567" maxLength={8}
              value={form.postal_code}
              onChange={e => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 7)
                set('postal_code', d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d)
              }}
            />
          </div>
          <div>
            <label className="label">Município</label>
            <input className="input w-full" value={form.municipality} onChange={e => set('municipality', e.target.value)} />
          </div>
          <div>
            <label className="label">Distrito</label>
            <input className="input w-full" value={form.district} onChange={e => set('district', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            className="btn btn-primary"
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.portfolio_id}
          >
            {create.isPending ? 'A guardar…' : 'Criar imóvel'}
          </button>
          <button className="btn" onClick={() => navigate('/properties')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
