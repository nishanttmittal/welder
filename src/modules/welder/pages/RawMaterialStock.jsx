/**
 * Raw Material Stock (Manager + Admin) — view current balance and add incoming
 * stock. Incoming can be entered by PIECES or by WEIGHT (converted to pieces via
 * the avg weight). Balance is derived: receipts − consumption by production.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { computeStock, piecesFromWeight, weightFromPieces } from '../logic/stock'

export default function RawMaterialStock({ by = 'user' }) {
  const { components, receipts, dispatches, products, log } = useWelder()
  const { msg, show } = useToast()
  const [adding, setAdding] = useState(false)

  const stock = useMemo(
    () => computeStock(components.list, receipts.list, dispatches.list, products.list),
    [components.list, receipts.list, dispatches.list, products.list])
  const rows = Object.values(stock).sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Button variant="success" className="w-full" onClick={() => setAdding(s => !s)}>{adding ? 'Close' : '+ Add incoming stock'}</Button>
      {adding && <IncomingForm components={components.list} onDone={() => setAdding(false)} receipts={receipts} log={log} show={show} by={by} />}

      <Card className="p-4">
        <FieldLabel>Current Balance ({rows.length} materials)</FieldLabel>
        {rows.length === 0 ? <p className="text-sm text-slate-400 mt-2">No raw materials yet — Admin adds them in Materials & Recipe.</p> : (
          <div className="mt-2 space-y-1.5 max-h-[60vh] overflow-auto">
            {rows.map(m => (
              <div key={m.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${m.negative ? 'bg-red-50' : m.reorder ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{m.name}{(m.reorder || m.negative) && <span className="ml-1 text-[10px] font-bold text-amber-600">● low</span>}</div>
                  <div className="text-[11px] text-slate-400">in {fmtNum(m.received)} · used {fmtNum(m.used)}{m.measureBy === 'weight' && m.avgWeight ? ` · ≈ ${Number(m.weightEquiv.toFixed(3))} ${m.weightUnit}` : ''}</div>
                </div>
                <div className={`text-right font-mono font-bold ${m.negative ? 'text-red-600' : m.reorder ? 'text-amber-700' : 'text-slate-700'}`}>
                  {fmtNum(m.stock)} <span className="text-[11px] font-normal text-slate-400">pcs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function IncomingForm({ components, onDone, receipts, log, show, by }) {
  const [cid, setCid] = useState(components[0]?.id || '')
  const comp = components.find(c => c.id === cid)
  const [mode, setMode] = useState('number')   // number | weight
  const [pieces, setPieces] = useState('')
  const [weight, setWeight] = useState('')
  const [avg, setAvg] = useState(String(comp?.avgWeight || ''))
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')

  // keep avg synced to the picked component
  const onComp = (id) => { setCid(id); const c = components.find(x => x.id === id); setAvg(String(c?.avgWeight || '')) }

  const derivedPieces = mode === 'weight' ? piecesFromWeight(avg, weight) : (Number(pieces) || 0)

  const save = () => {
    if (!cid) return show('Pick a material', 2000)
    if (derivedPieces <= 0) return show('Enter a valid quantity', 2000)
    receipts.insert({
      date, componentId: cid, componentName: comp?.name || '',
      qty: derivedPieces, weight: mode === 'weight' ? (Number(weight) || 0) : weightFromPieces(avg, derivedPieces),
      avgWeightUsed: Number(avg) || 0, enteredAs: mode, by, note: note.trim(),
    })
    log('STOCK_IN', `${comp?.name}: +${derivedPieces} pcs (${mode})`, by)
    show('Incoming stock added ✓'); onDone()
  }

  return (
    <Card className="p-4 space-y-3 border border-emerald-200">
      <FieldLabel>Add Incoming Stock</FieldLabel>
      <div><FieldLabel>Material</FieldLabel>
        <Select className="mt-1" value={cid} onChange={e => onComp(e.target.value)} options={components.map(c => ({ value: c.id, label: c.name }))} /></div>
      <div className="flex gap-2">
        {[['number', 'By pieces'], ['weight', 'By weight']].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {mode === 'number' ? (
        <div><FieldLabel>Pieces received</FieldLabel><NumberInput className="mt-1" value={pieces} onChange={e => setPieces(e.target.value)} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Weight received ({comp?.weightUnit || 'kg'})</FieldLabel><NumberInput className="mt-1" inputMode="decimal" step="0.001" placeholder="0.000" value={weight} onChange={e => setWeight(e.target.value)} /></div>
          <div><FieldLabel>Avg / piece ({comp?.weightUnit || 'kg'})</FieldLabel><NumberInput className="mt-1" inputMode="decimal" step="0.001" value={avg} onChange={e => setAvg(e.target.value)} /></div>
          <div className="col-span-2 text-xs text-slate-500">= <b>{fmtNum(derivedPieces)}</b> pieces {Number(avg) > 0 ? '' : '(set avg weight)'}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><FieldLabel>Note</FieldLabel><TextInput className="mt-1" value={note} onChange={e => setNote(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button variant="success" className="flex-1" onClick={save}>Save incoming</Button>
      </div>
    </Card>
  )
}
