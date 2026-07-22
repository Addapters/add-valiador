import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

export type DeadlineItem = { date: string; label: string }

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Calendário mensal, sem dependências externas, com marcadores nos dias que
// têm prazos associados (entrega de projectos, etc). Reutilizável em
// qualquer dashboard (admin, perito, cliente).
export default function DeadlineCalendar({ items }: { items: DeadlineItem[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>()
    items.forEach(it => {
      if (!it.date) return
      const key = it.date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    })
    return map
  }, [items])

  const weeks = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const startOffset = (first.getDay() + 6) % 7 // semana começa à Segunda
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cursor])

  const hoje = toKey(new Date())
  const upcoming = [...items]
    .filter(it => it.date && it.date.slice(0,10) >= hoje)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const selectedItems = selected ? (byDay.get(selected) || []) : []

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
        <CalendarDays size={15} className="text-brand-500" /> Calendário de prazos
      </h2>
      <div className="flex items-center justify-between mb-3">
        <button className="p-1 rounded hover:bg-gray-100 text-gray-400" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth()-1, 1))}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-gray-600 text-center">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button className="p-1 rounded hover:bg-gray-100 text-gray-400" onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth()+1, 1))}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
        {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="space-y-1">
        {weeks.map((row, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {row.map((day, j) => {
              if (!day) return <div key={j} />
              const key = toKey(day)
              const has = byDay.has(key)
              const isToday = key === hoje
              return (
                <button key={j} onClick={() => setSelected(selected === key ? null : key)}
                  className={`relative h-8 rounded-lg text-xs flex items-center justify-center transition-colors
                    ${selected === key ? 'bg-brand-400 text-white' : isToday ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {day.getDate()}
                  {has && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${selected === key ? 'bg-white' : 'bg-red-400'}`} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {selected && selectedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {selectedItems.map((it, i) => (
            <p key={i} className="text-xs text-gray-600">• {it.label}</p>
          ))}
        </div>
      )}

      {!selected && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Próximos prazos</p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400">Sem prazos agendados.</p>
          ) : upcoming.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{it.label}</span>
              <span className="text-gray-400">{new Date(it.date).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
