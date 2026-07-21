import type { ReactNode } from 'react'

export type VisitStatus   = 'pending' | 'scheduled' | 'visited' | 'report_done'
export type BillingStatus = 'no_po' | 'awaiting_po' | 'po_received' | 'invoice_pending' | 'invoice_issued' | 'paid'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  pending:     'Por visitar',
  scheduled:   'Agendado',
  visited:     'Visitado',
  report_done: 'Report OK',
}
export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  no_po:           'Sem PO',
  awaiting_po:     'A aguardar PO',
  po_received:     'PO recebida',
  invoice_pending: 'Fatura por emitir',
  invoice_issued:  'Fatura emitida',
  paid:            'Pago',
}

const VISIT_STYLES: Record<VisitStatus, string> = {
  pending:     'bg-gray-100    text-gray-600    border border-gray-300',
  scheduled:   'bg-blue-100    text-blue-700    border border-blue-300',
  visited:     'bg-amber-100   text-amber-700   border border-amber-300',
  report_done: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
}
const BILLING_STYLES: Record<BillingStatus, string> = {
  no_po:           'bg-red-100    text-red-700    border border-red-300',
  awaiting_po:     'bg-orange-100 text-orange-700 border border-orange-300',
  po_received:     'bg-purple-100 text-purple-700 border border-purple-300',
  invoice_pending: 'bg-sky-100    text-sky-700    border border-sky-300',
  invoice_issued:  'bg-blue-100   text-blue-700   border border-blue-300',
  paid:            'bg-emerald-100 text-emerald-700 border border-emerald-300',
}

export function VisitBadge({ status }: { status: string }) {
  const s = status as VisitStatus
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VISIT_STYLES[s] || 'bg-gray-100 text-gray-600'}`}>{VISIT_STATUS_LABELS[s] || status}</span>
}
export function BillingBadge({ status }: { status: string }) {
  const s = status as BillingStatus
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BILLING_STYLES[s] || 'bg-gray-100 text-gray-600'}`}>{BILLING_STATUS_LABELS[s] || status}</span>
}

type BadgeVariant = 'green'|'amber'|'blue'|'gray'|'red'|'purple'|'orange'|'teal'
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  amber:  'bg-amber-100   text-amber-700   border border-amber-200',
  blue:   'bg-blue-100    text-blue-700    border border-blue-200',
  gray:   'bg-gray-100    text-gray-600    border border-gray-200',
  red:    'bg-red-100     text-red-700     border border-red-200',
  purple: 'bg-purple-100  text-purple-700  border border-purple-200',
  orange: 'bg-orange-100  text-orange-700  border border-orange-200',
  teal:   'bg-teal-100    text-teal-700    border border-teal-200',
}
export function Badge({ variant='gray', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_STYLES[variant]}`}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-white">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function KpiCard({ label, value, sub, color='default' }: { label:string; value:string|number; sub?:string; color?:'default'|'green'|'amber'|'red' }) {
  const c = { default:'text-gray-900', green:'text-emerald-600', amber:'text-amber-600', red:'text-red-600' }[color]
  return (
    <div className="card">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${c}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="flex flex-col items-center justify-center py-16 text-gray-400"><p className="text-sm">{message}</p></div>
}

// Saudação inicial usada no topo dos dashboards de todos os papéis (admin,
// perito, cliente) — dá contexto imediato de quem está autenticado.
export function WelcomeBanner({ name, subtitle }: { name: string | null; subtitle?: string }) {
  const hour = new Date().getHours()
  const saudacao = hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite'
  const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white px-6 py-5 flex items-center justify-between flex-wrap gap-2">
      <div>
        <p className="text-xs uppercase tracking-wider text-white/70">{hoje}</p>
        <h1 className="text-xl font-semibold mt-0.5">{saudacao}, {name || ''} 👋</h1>
        {subtitle && <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// Banner de alerta reutilizável (urgências, mensagens novas, etc.)
export function AlertBanner({ variant, children }: { variant: 'red'|'amber'|'blue'; children: ReactNode }) {
  const styles = {
    red:   'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
  }[variant]
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${styles}`}>
      {children}
    </div>
  )
}
