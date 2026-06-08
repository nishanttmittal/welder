/**
 * Raw Material Stock (Manager + Admin) — view balance, add incoming stock, and
 * (Admin) set-off / adjust stock to match a physical count.
 * Balance is derived: receipts − consumption + adjustments. Incoming can be by
 * PIECES or by WEIGHT; a lot whose avg weight deviates > tolerance from the
 * material's standard is accepted but FLAGGED.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { computeStock, piecesFromWeight, weightFromPieces, avgDeviationPct } from '../logic/stock'
import { AVG_WEIGHT_TOLERANCE_PCT } from '../config'

export default function RawMaterialStock({ by = 'user', owner = false }) {
  const { components, receipts, dispatches, products, adjustments, log } = useWelder()
  const { msg, show } = useToast()
  const [adding, setAdding] = useState(false)
  const [adjusting, setAdjusting] = useState(false)

  const stock = useMemo(
    () => computeStock(components.list, receipts.list, dispatches.list, products.list, adjustments.list),
    [components.list, receipts.list, dispatches.list, products.list, adjustments.list])
  const rows = Object.values(stock).sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Button variant="success" className="w-full" onClick={() => { setAdding(s => !s); setAdjusting(false) }}>{adding ? 'Close' : '+ Add incoming stock'}</Button>
      {adding && <IncomingForm components={components.list} onDone={() => setAdding(false)} receipts={receipts} log={log} show={show} by={by} />}

      {owner && <Button variant="neutral" className="w-full" onClick={() => { setAdjusting(s => !s); setAdding(false) }}>{adjusting ? 'Close' : '⚖ Stock set-off / adjust'}</Button>}
      {owner && adjusting && <AdjustForm components={components.list} stock={stock} onDone={() => setAdjusting(false)} adjustments={adjustments} log={log} show={show} by={by} />}

      <Card className="p-4">
        <FieldLabel>Current Balance ({rows.length} materials)</FieldLabel>
        {rows.length === 0 ? <p className="text-sm text-slate-400 mt-2">No raw materials yet — Admin adds them in Materials & Recipe.</p> : (
          <div className="mt-2 space-y-1.5 max-h-[60vh] overflow-auto">
            {rows.map(m => (
              <div key={m.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${m.negative ? 'bg-red-50' : m.reorder ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{m.name}{(m.reorder || m.negative) && <span className="ml-1 text-[10px] font-bold text-amber-600">● low</span>}</div>
                  <div className="text-[11px] text-slate-400">in {fmtNum(m.received)} · used {fmtNum(m.used)}{m.adjusted ? ` · adj ${m.adjusted > 0 ? '+' : ''}${fmtNum(m.adjusted)}` : ''}{m.measureBy === 'weight' && m.avgWeight ? ` · ≈ ${Number(m.weightEquiv.toFixed(3))} ${m.weightUnit}` : ''}</div>
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

  const onComp = (id) => { setCid(id); const c = components.find(x => x.id === id); setAvg(String(c?.avgWeight || '')) }
  const derivedPieces = mode === 'weight' ? piecesFromWeight(avg, weight) : (Number(pieces) || 0)

  // Avg-weight deviation flag (weight mode): compare this lot's avg to the standard.
  const dev = mode === 'weight' ? avgDeviationPct(comp?.avgWeight, avg) : 0
  const flagged = mode === 'weight' && Number(comp?.avgWeight) > 0 && Number(avg) > 0 && dev > AVG_WEIGHT_TOLERANCE_PCT

  const save = () => {
    if (!cid) return show('Pick a material', 2000)
    if (derivedPieces <= 0) return show('Enter a valid quantity', 2000)
    receipts.insert({
      date, componentId: cid, componentName: comp?.name || '',
      qty: derivedPieces, weight: mode === 'weight' ? (Number(weight) || 0) : weightFromPieces(avg, derivedPieces),
      avgWeightUsed: Number(avg) || 0, flagged, enteredAs: mode, by, note: note.trim(),
    })
    log('STOCK_IN', `${comp?.name}: +${derivedPieces} pcs (${mode})${flagged ? ` · ⚑ avg-wt ${dev.toFixed(1)}%` : ''}`, by)
    show(flagged ? 'Added — flagged for avg weight ⚑' : 'Incoming stock added ✓'); onDone()
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
      {flagged && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs text-amber-700 font-semibold">
          ⚑ This lot's avg weight ({avg}{comp?.weightUnit}) differs <b>{dev.toFixed(1)}%</b> from the standard ({comp?.avgWeight}{comp?.weightUnit}). Entry is allowed but will be flagged.
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

/** Stock set-off (Admin): record a physical count; stored as a delta vs system. */
function AdjustForm({ components, stock, onDone, adjustments, log, show, by }) {
  const [cid, setCid] = useState(components[0]?.id || '')
  const comp = components.find(c => c.id === cid)
  const system = Number(stock[cid]?.stock || 0)
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayStr())
  const delta = (Number(counted) || 0) - system

  const save = () => {
    if (!cid) return show('Pick a material', 2000)
    if (counted === '') return show('Enter the counted stock', 2000)
    if (delta === 0) return show('No change — counted equals system', 2200)
    if (!reason.trim()) return show('Enter a reason', 2000)
    adjustments.insert({ date, componentId: cid, componentName: comp?.name || '', counted: Number(counted) || 0, systemBefore: system, delta, reason: reason.trim(), by })
    log('STOCK_ADJUST', `${comp?.name}: ${system}→${Number(counted) || 0} (${delta > 0 ? '+' : ''}${delta}) · ${reason.trim()}`, by)
    show('Stock adjusted ✓'); onDone()
  }

  return (
    <Card className="p-4 space-y-3 border border-violet-200">
      <FieldLabel>Stock Set-off / Adjust</FieldLabel>
      <p className="text-[11px] text-slate-400 -mt-1">Enter the actual physical count; the difference is recorded as an adjustment.</p>
      <div><FieldLabel>Material</FieldLabel>
        <Select className="mt-1" value={cid} onChange={e => setCid(e.target.value)} options={components.map(c => ({ value: c.id, label: c.name }))} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>System stock</FieldLabel><div className="mt-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-base font-bold text-slate-600 bg-slate-50">{fmtNum(system)} pcs</div></div>
        <div><FieldLabel>Actual counted</FieldLabel><NumberInput className="mt-1" value={counted} onChange={e => setCounted(e.target.value)} /></div>
      </div>
      {counted !== '' && <div className={`text-xs font-semibold ${delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Adjustment: {delta > 0 ? '+' : ''}{fmtNum(delta)} pcs</div>}
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><FieldLabel>Reason</FieldLabel><TextInput className="mt-1" placeholder="count / breakage…" value={reason} onChange={e => setReason(e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button variant="primary" className="flex-1 !bg-violet-600" onClick={save}>Record adjustment</Button>
      </div>
    </Card>
  )
}
