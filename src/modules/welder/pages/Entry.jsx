/**
 * Material Sent — the welder contractor's screen. Pick (your name) → product →
 * finish → who it's sent to → quantity → SAVE (with confirmation). The product
 * is recorded with the finish AFTER the name (e.g. "Spider Chrome").
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberStepper, TextInput, SearchBar, useToast, Toast } from '../../../core/ui'
import { todayStr, daysAgoStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { FINISHES, finishedName, QUICK_QTYS } from '../config'

export default function Entry({ floor = false }) {
  const { dispatches, products, welders, parties, log, lastUsed } = useWelder()
  const { msg, show } = useToast()

  const productList = useMemo(() => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)), [products.list])
  const remembered = lastUsed.get()

  const [welder, setWelder] = useState(remembered.welder || welders.list[0]?.name || '')
  const [date, setDate] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [productName, setProductName] = useState('')
  const [finish, setFinish] = useState('chrome')
  const [party, setParty] = useState('')
  const [qty, setQty] = useState('')
  const [remarks, setRemarks] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [fixing, setFixing] = useState(null)
  const [fixQty, setFixQty] = useState('')

  const n = Number(qty) || 0
  const finalName = productName ? finishedName(productName, finish) : ''
  const term = search.trim().toLowerCase()
  const tiles = productList.filter(p => !term || p.name.toLowerCase().includes(term))

  const todays = dispatches.list
    .filter(d => d.date === date && (!welder || d.welder === welder))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  // Worker self-correction: only the most recent entry, same day, can be fixed.
  const editableId = date === todayStr() ? todays[0]?.id : null
  const openFix = (d) => { setFixing(d); setFixQty(String(d.qty)) }
  const saveFix = () => {
    const v = Number(fixQty) || 0
    dispatches.update(fixing.id, { qty: v })
    log('FIX', `${fixing.finishedName || fixing.productName}: ${fixing.qty}→${v} (welder, same-day)`, floor ? 'welder' : 'admin')
    show('Corrected ✓'); setFixing(null)
  }
  const cancelEntry = (d) => {
    if (!confirm(`Cancel this entry (${d.finishedName || d.productName} × ${d.qty})? It will be voided to 0.`)) return
    dispatches.update(d.id, { qty: 0 })
    log('VOID', `${d.finishedName || d.productName} × ${d.qty} → 0 (welder cancel)`, floor ? 'welder' : 'admin')
    show('Entry cancelled ✓')
  }

  const pickProduct = (name) => {
    setProductName(name)
    const f = FINISHES.find(x => x.key === finish)
    if (f && !party) setParty(f.defaultParty)
  }
  const pickFinish = (key) => {
    setFinish(key)
    const f = FINISHES.find(x => x.key === key)
    if (f) setParty(f.defaultParty) // suggest the usual party for this finish
  }

  const requestSave = () => {
    if (!welder) return show('Pick your name', 2000)
    if (!productName) return show('Pick a product', 2000)
    if (n <= 0) return show('Enter a quantity', 2000)
    if (!party) return show('Pick where it is sent', 2000)
    setConfirming(true)
  }

  const doSave = () => {
    setConfirming(false)
    dispatches.insert({ date, welder, productName, finish, finishedName: finalName, party, qty: n, remarks: remarks.trim() })
    log('SENT', `${welder}: ${finalName} × ${n} → ${party} on ${fmtDate(date)}`, floor ? 'welder' : 'admin')
    lastUsed.set({ ...lastUsed.get(), welder })
    show(`Saved: ${finalName} × ${fmtNum(n)} ✓`)
    setProductName(''); setQty(''); setRemarks(''); setSearch('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Welder</FieldLabel>
            <Select className="mt-1" value={welder} onChange={e => setWelder(e.target.value)}
              options={welders.list.map(w => ({ value: w.name, label: w.name }))} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={floor ? daysAgoStr(2) : undefined} max={floor ? todayStr() : undefined}
              className="mt-1 w-full border-2 border-slate-300 rounded-2xl px-3 py-2.5 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-amber-200 focus:border-amber-500" />
          </div>
        </div>
      </Card>

      {/* product */}
      {!productName ? (
        <Card className="p-4 space-y-3">
          <FieldLabel>Tap the product</FieldLabel>
          {productList.length > 6 && <SearchBar value={search} onChange={setSearch} placeholder="Search product…" />}
          <div className="grid grid-cols-2 gap-2">
            {tiles.map(p => (
              <button key={p.id} onClick={() => pickProduct(p.name)}
                className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-4 font-bold text-slate-700 active:scale-95 hover:border-amber-300 transition-transform">
                {p.name}
              </button>
            ))}
            {tiles.length === 0 && <p className="text-sm text-slate-400 col-span-2">No products.</p>}
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-800 text-lg">{productName}</div>
            <button onClick={() => { setProductName(''); setQty('') }} className="text-sm text-amber-600 font-semibold">← Change</button>
          </div>

          <div>
            <FieldLabel>Finish</FieldLabel>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {FINISHES.map(f => (
                <button key={f.key} onClick={() => pickFinish(f.key)}
                  className={`py-3 rounded-2xl font-bold text-sm transition-colors ${finish === f.key ? 'bg-amber-500 text-white shadow' : 'bg-slate-100 text-slate-600'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {finalName && <p className="text-xs text-amber-700 font-semibold mt-2">Will be recorded as: <b>{finalName}</b></p>}
          </div>

          <div>
            <FieldLabel>Sent to</FieldLabel>
            <Select className="mt-1.5" value={party} onChange={e => setParty(e.target.value)}
              options={[{ value: '', label: '— select —' }, ...parties.list.map(p => ({ value: p.name, label: p.name }))]} />
          </div>

          <div>
            <FieldLabel>Quantity</FieldLabel>
            <div className="mt-1.5"><NumberStepper value={qty} onChange={setQty} quickAdds={QUICK_QTYS} /></div>
          </div>

          <div>
            <FieldLabel>Remarks (optional)</FieldLabel>
            <TextInput className="mt-1.5" placeholder="Any note…" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <Button variant="primary" size="lg" className="w-full text-lg py-5 !bg-amber-600 !shadow-amber-300" onClick={requestSave}>SAVE</Button>
        </Card>
      )}

      {/* today list */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <FieldLabel>Sent on {fmtDate(date)}{welder ? ` · ${welder}` : ''}</FieldLabel>
          <span className="text-sm font-bold text-slate-400">{fmtNum(todays.reduce((s, d) => s + (Number(d.qty) || 0), 0))} pcs</span>
        </div>
        {todays.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing sent yet.</p>
        ) : (
          <div className="space-y-2">
            {todays.map(d => (
              <div key={d.id} className="bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold ${d.qty === 0 ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{d.finishedName || d.productName}</div>
                    <div className="text-xs text-slate-400">→ {d.party}</div>
                  </div>
                  <span className={`font-mono font-bold ${d.qty === 0 ? 'text-slate-400' : 'text-amber-700'}`}>{d.qty === 0 ? 'cancelled' : `× ${fmtNum(d.qty)}`}</span>
                </div>
                {d.id === editableId && d.qty > 0 && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openFix(d)} className="flex-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg py-1.5">✎ Fix qty</button>
                    <button onClick={() => cancelEntry(d)} className="flex-1 text-xs font-bold text-red-600 bg-red-50 rounded-lg py-1.5">✕ Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* fix last entry (worker, same-day) */}
      {fixing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setFixing(null)}>
          <Card className="p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Fix last entry · {fixing.finishedName || fixing.productName}</FieldLabel>
            <div><FieldLabel>Quantity</FieldLabel><div className="mt-1.5"><NumberStepper value={fixQty} onChange={setFixQty} quickAdds={QUICK_QTYS} /></div></div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setFixing(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 !bg-amber-600" onClick={saveFix}>Save</Button>
            </div>
          </Card>
        </div>
      )}

      {/* confirm */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setConfirming(false)}>
          <Card className="p-6 w-full max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-bold text-slate-800">Save this entry?</div>
            <div className="text-2xl font-bold text-amber-600">{fmtNum(n)} × {finalName}</div>
            <div className="text-sm font-semibold text-slate-600">by {welder} → {party}<br />{fmtDate(date)}</div>
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="primary" className="flex-1 !bg-amber-600" onClick={doSave}>Yes, Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
