/**
 * Raw Material Stock (Manager + Admin) — view balance, add incoming stock,
 * (Admin) set-off / adjust to a physical count, and view the immutable
 * transaction history. Balance is ALWAYS derived from transactions
 * (receipts − production usage + adjustments); nothing is overwritten.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, TextInput, DateInput, SearchBar, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { computeStock, piecesFromWeight, weightFromPieces, avgDeviationPct, stockTransactions } from '../logic/stock'
import { AVG_WEIGHT_TOLERANCE_PCT, STOCK_ADJUST_REASONS } from '../config'

const onlyInt = (v) => String(v).replace(/[^\d]/g, '')   // pieces are never decimals

export default function RawMaterialStock({ by = 'user', owner = false }) {
  const { components, receipts, dispatches, products, adjustments, log } = useWelder()
  const { msg, show } = useToast()
  const [adding, setAdding] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [history, setHistory] = useState(false)

  const stock = useMemo(
    () => computeStock(components.list, receipts.list, dispatches.list, products.list, adjustments.list),
    [components.list, receipts.list, dispatches.list, products.list, adjustments.list])
  const rows = Object.values(stock).sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))

  const closeAll = () => { setAdding(false); setAdjusting(false); setHistory(false) }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Button variant="success" className="w-full" onClick={() => { const v = !adding; closeAll(); setAdding(v) }}>{adding ? 'Close' : '+ Add incoming stock'}</Button>
      {adding && <IncomingForm components={components.list} onDone={() => setAdding(false)} receipts={receipts} log={log} show={show} by={by} />}

      {owner && <Button variant="neutral" className="w-full" onClick={() => { const v = !adjusting; closeAll(); setAdjusting(v) }}>{adjusting ? 'Close' : '⚖ Stock set-off / adjust'}</Button>}
      {owner && adjusting && <AdjustForm components={components.list} stock={stock} onDone={() => setAdjusting(false)} adjustments={adjustments} log={log} show={show} by={by} />}

      <Button variant="neutral" className="w-full" onClick={() => { const v = !history; closeAll(); setHistory(v) }}>{history ? 'Close' : '📜 Transaction history'}</Button>
      {history && <TransactionHistory components={components.list} receipts={receipts.list} dispatches={dispatches.list} products={products.list} adjustments={adjustments.list} />}

      <Card className="p-4">
        <FieldLabel>Current Balance ({rows.length} materials)</FieldLabel>
        {rows.length === 0 ? <p className="text-sm text-slate-400 mt-2">No raw materials yet — Admin adds them in Materials & Recipe.</p> : (
          <div className="mt-2 space-y-1.5 max-h-[60vh] overflow-auto">
            {rows.map(m => (
              <div key={m.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${m.negative ? 'bg-red-50' : m.reorder ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{m.name}{m.negative ? <span className="ml-1 text-[10px] font-bold text-red-600">⚠ negative</span> : (m.reorder && <span className="ml-1 text-[10px] font-bold text-amber-600">● low</span>)}</div>
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
        <div><FieldLabel>Pieces received</FieldLabel><NumberInput className="mt-1" inputMode="numeric" value={pieces} onChange={e => setPieces(onlyInt(e.target.value))} /></div>
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
  const [reason, setReason] = useState(STOCK_ADJUST_REASONS[0])
  const [reasonOther, setReasonOther] = useState('')
  const [date, setDate] = useState(todayStr())
  const delta = (Number(counted) || 0) - system
  const finalReason = reason === 'Other' ? reasonOther.trim() : reason

  const save = () => {
    if (!cid) return show('Pick a material', 2000)
    if (counted === '') return show('Enter the counted stock', 2000)
    if (delta === 0) return show('No change — counted equals system', 2200)
    if (!finalReason) return show('Enter a reason', 2000)
    adjustments.insert({ date, componentId: cid, componentName: comp?.name || '', counted: Number(counted) || 0, systemBefore: system, delta, reason: finalReason, by })
    log('STOCK_ADJUST', `${comp?.name}: ${system}→${Number(counted) || 0} (${delta > 0 ? '+' : ''}${delta}) · ${finalReason}`, by)
    show('Stock adjusted ✓'); onDone()
  }

  return (
    <Card className="p-4 space-y-3 border border-violet-200">
      <FieldLabel>Stock Set-off / Adjust</FieldLabel>
      <p className="text-[11px] text-slate-400 -mt-1">Enter the actual physical count; the difference is recorded as an adjustment (with a reason).</p>
      <div><FieldLabel>Material</FieldLabel>
        <Select className="mt-1" value={cid} onChange={e => setCid(e.target.value)} options={components.map(c => ({ value: c.id, label: c.name }))} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>System stock</FieldLabel><div className="mt-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-base font-bold text-slate-600 bg-slate-50">{fmtNum(system)} pcs</div></div>
        <div><FieldLabel>Actual counted</FieldLabel><NumberInput className="mt-1" inputMode="numeric" value={counted} onChange={e => setCounted(onlyInt(e.target.value))} /></div>
      </div>
      {counted !== '' && <div className={`text-xs font-semibold ${delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Adjustment: {delta > 0 ? '+' : ''}{fmtNum(delta)} pcs</div>}
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><FieldLabel>Reason</FieldLabel>
          <Select className="mt-1" value={reason} onChange={e => setReason(e.target.value)} options={[...STOCK_ADJUST_REASONS.map(r => ({ value: r, label: r })), { value: 'Other', label: 'Other…' }]} /></div>
      </div>
      {reason === 'Other' && <TextInput placeholder="Reason" value={reasonOther} onChange={e => setReasonOther(e.target.value)} />}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>Cancel</Button>
        <Button variant="primary" className="flex-1 !bg-violet-600" onClick={save}>Record adjustment</Button>
      </div>
    </Card>
  )
}

const TXN_BADGE = {
  INCOMING: 'bg-emerald-100 text-emerald-700',
  AUTO_DEDUCT: 'bg-slate-200 text-slate-600',
  MANUAL_ADJUSTMENT: 'bg-violet-100 text-violet-700',
  CORRECTION: 'bg-amber-100 text-amber-700',
}

/** Immutable, derived transaction log — every stock movement, filterable. */
function TransactionHistory({ components, receipts, dispatches, products, adjustments }) {
  const [mat, setMat] = useState('all')
  const [type, setType] = useState('all')
  const txns = useMemo(() => stockTransactions(components, receipts, dispatches, products, adjustments),
    [components, receipts, dispatches, products, adjustments])
  const shown = txns.filter(t => (mat === 'all' || t.materialId === mat) && (type === 'all' || t.transactionType === type))

  return (
    <Card className="p-4 space-y-2">
      <FieldLabel>Transaction History ({shown.length})</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        <Select value={mat} onChange={e => setMat(e.target.value)} options={[{ value: 'all', label: 'All materials' }, ...components.map(c => ({ value: c.id, label: c.name }))]} />
        <Select value={type} onChange={e => setType(e.target.value)} options={[{ value: 'all', label: 'All types' }, ...Object.keys(TXN_BADGE).map(t => ({ value: t, label: t.replace('_', ' ') }))]} />
      </div>
      {shown.length === 0 ? <p className="text-sm text-slate-400">No transactions.</p> : (
        <div className="space-y-1.5 max-h-[55vh] overflow-auto">
          {shown.map(t => (
            <div key={t.id} className="bg-slate-50 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 truncate">{t.material}</span>
                <span className={`font-mono font-bold text-sm ${t.qty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{t.qty > 0 ? '+' : ''}{fmtNum(t.qty)} {t.unit}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TXN_BADGE[t.transactionType] || 'bg-slate-100'}`}>{t.transactionType.replace('_', ' ')}</span>
                {t.createdAt && <span className="text-[10px] text-slate-400">{fmtDate(String(t.createdAt).slice(0, 10))}</span>}
                {t.referenceProduct && <span className="text-[10px] text-slate-500">· {t.referenceProduct}</span>}
                {t.referenceChallan && <span className="text-[10px] text-slate-400">· {t.referenceChallan}</span>}
                {t.createdBy && <span className="text-[10px] text-slate-400">· {t.createdBy}</span>}
                {t.remark && <span className="text-[10px] text-slate-500 italic">· {t.remark}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
