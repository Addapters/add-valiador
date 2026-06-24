// Persiste os filtros da tab Imóveis durante a sessão (sessionStorage)
// Quando o utilizador navega para um imóvel e regressa, os filtros mantêm-se

const KEY = 'addvaliador_property_filters'

export interface PropertyFilters {
  search: string
  visitFilter: string
  billingFilter: string
  districtFilter: string[]
  parishFilter: string[]
  peritoFilter: string
  collapsed: Record<string, boolean>
}

const defaults: PropertyFilters = {
  search: '', visitFilter: '', billingFilter: '',
  districtFilter: [], parishFilter: [], peritoFilter: '',
  collapsed: {}
}

export function getFilters(): PropertyFilters {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch { return defaults }
}

export function saveFilters(f: Partial<PropertyFilters>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...getFilters(), ...f }))
  } catch {}
}

export function clearFilters() {
  try { sessionStorage.removeItem(KEY) } catch {}
}
