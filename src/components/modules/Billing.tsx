import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'
import { Link } from 'react-router-dom'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Settings } from 'lucide-react'
import { getSavedPerito, savePerito } from '@/lib/userPrefs'

const BILLING_LABELS: Record<string,string> = {
  no_po:'Sem PO', awaiting_po:'A aguardar PO', po_received:'PO recebida',
  invoice_pending:'Fatura por emitir', invoice_issued:'Fatura emitida', paid:'Pago'
}
const STAGES = ['no_po','awaiting_po','po_received','invoice_pending','invoice_issued','paid']

export default function Billing() {
  const [myPerito,    setMyPerito]    = useState(getSavedPerito)
  const [editingPerito, setEditingPerito] = useState(false)
  const [peritoInput, setPeritoInput] = useState(getSavedPerito)

  function saveAndClose() {
    savePerito(peritoInput)
    setMyPerito(peritoInput)
    setEditingPerito(false)
  }

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['billing', myPerito],
    queryFn: async () => {
      let q = supabase
        .from('properties')
        .select('id, ref, address, municipality, district, visit_status, billing_status, fee_amount, po_number, invoice_number, payment_date, perito_avaliador, clients(name)')
        .order('ref')
      if (myPerito) q = q.eq('perito_avaliador', myPerito)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as any[]
    }
  })

  // Get all unique peritos for autocomplete
  const { data: allPeritos = [] } = useQuery({
    queryKey: ['peritos-list'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('perito_avaliador').not('perito_avaliador','is',null)
      const unique = [...new Set((data||[]).map((p: any) => p.perito_avaliador).filter(Boolean))].sort()
      return unique as string[]
    }
  })

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = properties.filter((p: any) => p.billing_status === s)
    return acc
  }, {} as Record<string, any[]>)

  const total    = properties.reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const received = properties.filter((p: any) => p.billing_status === 'paid').reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
  const pending  = total - received

  const STAGE_COLORS: Record<string, string> = {
    no_po:           'border-l-4 border-red-400',
    awaiting_po:     'border-l-4 border-orange-400',
    po_received:     'border-l-4 border-purple-400',
    invoice_pending: 'border-l-4 border-sky-400',
    invoice_issued:  'border-l-4 border-blue-400',
    paid:            'border-l-4 border-emerald-400',
  }

  return (
    <div>
      <PageHeader title="Faturação" subtitle="Pipeline financeiro pessoal"/>

      {/* Perito config bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <Settings size={14} className="text-gray-400"/>
        <span className="text-sm text-gray-500">A mostrar imóveis do perito:</span>
        {editingPerito ? (
          <div className="flex items-center gap-2">
            <input
              className="input py-1 text-sm w-56"
              value={peritoInput}
              onChange={e => setPeritoInput(e.target.value)}
              list="peritos-list"
              placeholder="Nome exacto do perito…"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveAndClose() }}
            />
            <datalist id="peritos-list">
              {allPeritos.map(p => <option key={p} value={p}/>)}
            </datalist>
            <button className="btn btn-primary text-xs py-1" onClick={saveAndClose}>Guardar</button>
            <button className="btn text-xs py-1" onClick={() => setEditingPerito(false)}>Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {myPerito
              ? <span className="text-sm font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">{myPerito}</span>
              : <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Todos os peritos</span>
            }
            <button className="btn text-xs py-1" onClick={() => { setPeritoInput(myPerito); setEditingPerito(true) }}>
              Alterar
            </button>
            {myPerito && (
              <button className="btn text-xs py-1 text-gray-400" onClick={() => { savePerito(''); setMyPerito('') }}>
                Ver todos
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total honorários</p>
          <p className="text-xl font-semibold text-gray-900">{formatCurrency(total)}</p>
          <p className="text-xs text-gray-400">{properties.length} imóveis</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Recebido</p>
          <p className="text-xl font-semibold text-emerald-600">{formatCurrency(received)}</p>
          <p className="text-xs text-gray-400">{byStage['paid']?.length || 0} processos</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Por receber</p>
          <p className="text-xl font-semibold text-amber-600">{formatCurrency(pending)}</p>
          <p className="text-xs text-gray-400">{properties.length - (byStage['paid']?.length || 0)} processos</p>
        </div>
      </div>

      {!myPerito && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          A mostrar todos os imóveis. Define o teu nome de perito acima para ver apenas os teus processos.
        </div>
      )}

      <div className="p-6 space-y-4">
        {isLoading ? <p className="text-sm text-gray-400">A carregar…</p> : (
          STAGES.map(stage => {
            const items = byStage[stage] || []
            if (!items.length) return null
            const stageTotal = items.reduce((s: number, p: any) => s + (p.fee_amount || 0), 0)
            return (
              <div key={stage} className={`bg-white rounded-xl overflow-hidden shadow-sm ${STAGE_COLORS[stage]}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{BILLING_LABELS[stage]}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{formatCurrency(stageTotal)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Ref.</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Localização</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Perito</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Honorário</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">PO</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Fatura</th>
                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <Link to={`/properties/${p.id}`} className="text-brand-600 hover:underline font-medium">{p.ref}</Link>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{p.municipality || p.address || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{p.perito_avaliador || '—'}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{p.fee_amount ? formatCurrency(p.fee_amount) : '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.po_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.invoice_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-400">{p.payment_date ? formatDate(p.payment_date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
