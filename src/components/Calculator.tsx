import { useState, useEffect, useCallback } from 'react'
import { X, Calculator as CalcIcon } from 'lucide-react'

function fmt(n: number): string {
  if (isNaN(n)) return 'Erro'
  const s = parseFloat(n.toPrecision(10))
  const parts = String(s).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return parts.join(',')
}

function compute(a: string, op: string, b: string): number {
  const na = parseFloat(a), nb = parseFloat(b)
  if (op === '+') return na + nb
  if (op === '−') return na - nb
  if (op === '×') return na * nb
  if (op === '÷') return nb === 0 ? NaN : na / nb
  return nb
}

interface HistoryItem { expr: string; result: number }

function CalcWindow({ onClose }: { onClose: () => void }) {
  const [cur,   setCur]   = useState('0')
  const [prev,  setPrev]  = useState<string|null>(null)
  const [op,    setOp]    = useState<string|null>(null)
  const [fresh, setFresh] = useState(true)
  const [mem,   setMem]   = useState<number|null>(null)
  const [expr,  setExpr]  = useState('—')
  const [hist,  setHist]  = useState<HistoryItem[]>([])

  function addHist(e: string, r: number) {
    setHist(h => [{ expr: e, result: r }, ...h].slice(0, 8))
  }

  const doDigit = useCallback((v: string) => {
    setCur(c => {
      if (fresh) { setFresh(false); return v }
      if (c === '0') return v
      if (c.length >= 12) return c
      return c + v
    })
  }, [fresh])

  const doDot = useCallback(() => {
    setCur(c => {
      if (fresh) { setFresh(false); return '0.' }
      return c.includes('.') ? c : c + '.'
    })
  }, [fresh])

  const doOp = useCallback((o: string) => {
    setCur(c => {
      setPrev(prev => {
        if (op && !fresh && prev) {
          const res = compute(prev, op, c)
          addHist(fmt(parseFloat(prev)) + ' ' + op + ' ' + fmt(parseFloat(c)), res)
          setExpr(fmt(res) + ' ' + o)
          setFresh(true)
          setOp(o)
          return String(res)
        }
        setExpr(fmt(parseFloat(c)) + ' ' + o)
        setFresh(true)
        setOp(o)
        return c
      })
      return c
    })
  }, [op, fresh])

  const doEq = useCallback(() => {
    setCur(c => {
      if (!op || !prev) return c
      const res = compute(prev, op, c)
      const e = fmt(parseFloat(prev)) + ' ' + op + ' ' + fmt(parseFloat(c)) + ' ='
      addHist(fmt(parseFloat(prev)) + ' ' + op + ' ' + fmt(parseFloat(c)), res)
      setExpr(e)
      setPrev(null)
      setOp(null)
      setFresh(true)
      return String(res)
    })
  }, [op, prev])

  const doClear = useCallback(() => {
    setCur('0'); setPrev(null); setOp(null); setFresh(true); setExpr('—')
  }, [])

  const doBack = useCallback(() => {
    setCur(c => {
      if (fresh) return '0'
      if (c.length <= 1) return '0'
      return c.slice(0, -1) || '0'
    })
  }, [fresh])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key >= '0' && e.key <= '9') doDigit(e.key)
      else if (e.key === '.' || e.key === ',') doDot()
      else if (e.key === '+') doOp('+')
      else if (e.key === '-') doOp('−')
      else if (e.key === '*') doOp('×')
      else if (e.key === '/') { e.preventDefault(); doOp('÷') }
      else if (e.key === 'Enter' || e.key === '=') doEq()
      else if (e.key === 'Escape') doClear()
      else if (e.key === 'Backspace') doBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doDigit, doDot, doOp, doEq, doClear, doBack])

  const displayVal = cur.length > 12 ? parseFloat(cur).toExponential(4) : cur.replace('.', ',')

  const Btn = ({ label, action, wide, color }: { label: string; action: () => void; wide?: boolean; color?: string }) => (
    <button
      onClick={action}
      className={`h-14 flex items-center justify-center text-base font-medium rounded-lg transition-colors hover:opacity-80 active:scale-95 ${wide ? 'col-span-2' : ''} ${color || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
      {label}
    </button>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl shadow-xl border border-gray-200 bg-white overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalcIcon size={13}/>
          <span>Calculadora</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
          <X size={14}/>
        </button>
      </div>

      {/* Display */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        {mem !== null && <p className="text-[10px] text-blue-500 text-right font-mono">M = {fmt(mem)}</p>}
        <p className="text-xs text-gray-400 text-right font-mono truncate min-h-[16px]">{expr}</p>
        <p className="text-3xl font-medium text-gray-900 text-right font-mono leading-tight mt-1 break-all">{displayVal}</p>
      </div>

      {/* History */}
      {hist.length > 0 && (
        <div className="max-h-20 overflow-y-auto px-4 py-1.5 border-b border-gray-100">
          {hist.map((h, i) => (
            <p key={i} className="text-[11px] text-gray-400 text-right font-mono">{h.expr} = {fmt(h.result)}</p>
          ))}
        </div>
      )}

      {/* Keypad */}
      <div className="p-3 grid grid-cols-4 gap-1.5">
        {/* Memory row */}
        {['MC','MR','MS','M+'].map(k => (
          <button key={k} onClick={() => {
            if (k==='MC') setMem(null)
            else if (k==='MR' && mem!==null) { setCur(String(mem)); setFresh(false) }
            else if (k==='MS') setMem(parseFloat(cur))
            else if (k==='M+') setMem(m => (m||0) + parseFloat(cur))
          }} className="h-10 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium">
            {k}
          </button>
        ))}
        {/* Row 2 */}
        <button onClick={doClear} className="h-12 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-semibold">C</button>
        <button onClick={() => setCur(c => String(-parseFloat(c)))} className="h-12 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">±</button>
        <button onClick={() => setCur(c => String(parseFloat(c)/100))} className="h-12 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">%</button>
        <button onClick={() => doOp('÷')} className="h-12 text-lg text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-semibold">÷</button>
        {/* Digits */}
        {['7','8','9'].map(d => <button key={d} onClick={() => doDigit(d)} className="h-12 text-base bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium">{d}</button>)}
        <button onClick={() => doOp('×')} className="h-12 text-lg text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-semibold">×</button>
        {['4','5','6'].map(d => <button key={d} onClick={() => doDigit(d)} className="h-12 text-base bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium">{d}</button>)}
        <button onClick={() => doOp('−')} className="h-12 text-lg text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-semibold">−</button>
        {['1','2','3'].map(d => <button key={d} onClick={() => doDigit(d)} className="h-12 text-base bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium">{d}</button>)}
        <button onClick={() => doOp('+')} className="h-12 text-lg text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-semibold">+</button>
        <button onClick={() => doDigit('0')} className="col-span-2 h-12 text-base bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium">0</button>
        <button onClick={doDot} className="h-12 text-base bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium">,</button>
        <button onClick={doEq} className="h-12 text-lg bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-semibold">=</button>
      </div>
    </div>
  )
}

export function useCalculator() {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen(o => !o)
  const el = open ? <CalcWindow onClose={() => setOpen(false)}/> : null
  return { toggle, open, el }
}

export default CalcWindow
