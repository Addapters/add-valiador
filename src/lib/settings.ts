// Configuração local do utilizador — guardada no localStorage do browser
// Não requer login nem base de dados

const KEY = 'addvaliador_settings'

export interface AppSettings {
  peritoName: string // nome do perito avaliador para filtrar faturação
}

const defaults: AppSettings = { peritoName: '' }

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch { return defaults }
}

export function saveSettings(s: Partial<AppSettings>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getSettings(), ...s }))
  } catch {}
}
