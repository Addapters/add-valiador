export function formatCurrency(value: number, currency = 'EUR', locale = 'pt-PT') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function formatDate(iso: string | null | undefined, locale = 'pt-PT') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}
