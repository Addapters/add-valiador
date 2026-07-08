// Separador de milhar: espaço (estilo português) — ex: 106 784 €, 1 234 567 €
export function formatCurrency(value: number, currency = 'EUR') {
  const n    = Math.round(Math.abs(value))
  const fmtd = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return (value < 0 ? '-' : '') + fmtd + '\u00A0€'
}

export function formatDate(iso: string | null | undefined, locale = 'pt-PT') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}
