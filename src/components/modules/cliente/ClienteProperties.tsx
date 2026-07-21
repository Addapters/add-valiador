import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader, VisitBadge, EmptyState } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

export default function ClienteProperties() {
  const { clientId } = useAuth()
  const [search, setSearch] = useState('')

  // RLS já garante que só vemos imóveis dos nossos próprios portfolios.
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['cliente-properties', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, external_ref, address, municipality, typology, area_m2, visit_status, campos_extra, portfolios(name)')
        .order('external_ref')
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
  })

  const filtered = search
    ? properties.filter((p: any) => [p.external_ref, p.address, p.municipality].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    : properties

  return (
    <div>
      <PageHeader title="Os meus imóveis" subtitle="Consulta do estado de cada imóvel"
        actions={<input className="input text-sm w-56" placeholder="Pesquisar…" value={search} onChange={e => setSearch(e.target.value)}/>}
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">A carregar…</p>
        ) : filtered.length === 0 ? (
          <EmptyState message="Ainda não há imóveis carregados." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="table-base text-sm">
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Morada</th>
                  <th>Concelho</th>
                  <th>Tipologia</th>
                  <th>Área (m²)</th>
                  <th>Projecto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.external_ref || '—'}</td>
                    <td>{p.address || '—'}</td>
                    <td>{p.municipality || '—'}</td>
                    <td>{p.typology || '—'}</td>
                    <td>{p.area_m2 || '—'}</td>
                    <td>{p.portfolios?.name || '—'}</td>
                    <td><VisitBadge status={p.visit_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
