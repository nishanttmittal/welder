/**
 * Material Sent — simple challan-style entry for the welder.
 * One screen: pick (your name) → date → finish → who it's sent to → GAADI no →
 * add 4–5 products (more if needed) → SAVE. That one save records everything
 * AND auto-generates the combined plating challan (no separate dispatch step).
 * Welders only PICK products from the list; only the owner can add products.
 */
import { useMemo, useState, useEffect, useRef } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, TextInput, useToast, Toast } from '../../../core/ui'
import { todayStr, daysAgoStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { FINISHES, finishedName, isPlatingFinish, SOURCE_APP, WORKFLOW_STAGE, DEFAULT_FACTORY_ID, PLATING_SYNC_FROM, FREEZE_BEFORE } from '../config'
import { nextWelderChallan, last4 } from '../logic/platingBridge'
import { computeStock, recipeOf } from '../logic/stock'
import { makeId } from '../../../core/db/repository'
import { pushPlatingIncoming } from '../../../core/db/firebase'

export default function Entry({ floor = false, operator = '', by = '' }) {
  const { dispatches, products, welders, parties, components, receipts, adjustments, counters, log, lastUsed } = useWelder()
  const { msg, show } = useToast()
  const remembered = lastUsed.get()

  const [welder, setWelder] = useState(operator || remembered.welder || welders.list[0]?.name || '')
  const [date, setDate] = useState(todayStr())
  const [finish, setFinish] = useState(remembered.finish || 'chrome')
  const [party, setParty] = useState(remembered.party || FINISHES.find(f => f.key === (remembered.finish || 'chrome'))?.defaultParty || '')
  const [gaadi, setGaadi] = useState('')
  const [items, setItems] = useState([{ product: '', qty: '' }])
  const [confirming, setConfirming] = useState(false)
  const [dupWarn, setDupWarn] = useState('') // products already entered today for this gaadi
  const [stockWarn, setStockWarn] = useState('') // materials that would go short (non-blocking)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false) // hard guard against a fast double-tap on Save
  const [fixing, setFixing] = useState(null)
  const [fixQty, setFixQty] = useState('')

  const who = by || operator || (floor ? 'welder' : 'admin')
  // Per-welder product list: common products (welder='') + this welder's own
  // products (e.g. Jitender's mechanism parts). Naveen never sees Jitender's.
  const productList = useMemo(() =>
    [...products.list]
      .filter(p => !p.welder || p.welder === welder)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [products.list, welder])
  const prodOpts = [{ value: '', label: '— product —' }, ...productList.map(p => ({ value: p.name, label: p.name }))]
  const partyOpts = [{ value: '', label: '— select —' }, ...parties.list.map(p => ({ value: p.name, label: p.name }))]

  const setItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  const addItem = () => setItems([...items, { product: '', qty: '' }])
  const delItem = (i) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items)
  const pickFinish = (key) => { setFinish(key); const f = FINISHES.find(x => x.key === key); if (f) setParty(f.defaultParty) }
  // Default the destination from the finish once parties are loaded.
  useEffect(() => {
    if (!party && parties.list.length) { const f = FINISHES.find(x => x.key === finish); if (f) setParty(f.defaultParty) }
  }, [parties.list.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const filled = items.filter(it => it.product && Number(it.qty) > 0)
  const totalQty = filled.reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const plating = isPlatingFinish(finish)

  const todays = dispatches.list
    .filter(d => d.date === date && (!welder || d.welder === welder))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const canEditDay = date >= daysAgoStr(2)
  // Manager date rule: the last 7 days. Owner & shop floor have their own windows.
  const managerDateOk = floor || by === 'Owner' || date >= daysAgoStr(7)
  // History freeze: nobody (incl. owner) may create/back-date before the cutoff.
  const frozen = date < FREEZE_BEFORE

  // This welder's own entries over the last 15 days, grouped by date (newest
  // first) — a read-only review list so Jitender/Naveen can check what they
  // entered and flag anything wrong to the owner.
  const last15ByDate = useMemo(() => {
    const cutoff = daysAgoStr(14)
    const map = new Map()
    dispatches.list
      .filter(d => welder && d.welder === welder && (d.date || '') >= cutoff && Number(d.qty) > 0)
      .forEach(d => { if (!map.has(d.date)) map.set(d.date, []); map.get(d.date).push(d) })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [dispatches.list, welder])

  const openFix = (d) => { setFixing(d); setFixQty(String(d.qty)) }
  const saveFix = () => {
    const v = Number(fixQty) || 0, old = fixing.qty
    dispatches.update(fixing.id, { qty: v })
    log('FIX', `${fixing.finishedName || fixing.productName}: ${old}→${v}`, who, fixing.id)
    show('Corrected ✓'); setFixing(null)
  }
  const cancelEntry = (d) => {
    if (!confirm(`Cancel this entry (${d.finishedName || d.productName} × ${d.qty})? It will be voided to 0.`)) return
    log('VOID', `${d.finishedName || d.productName} × ${d.qty} → 0 (cancelled)`, who, d.id)
    dispatches.update(d.id, { qty: 0 }); show('Entry cancelled ✓')
  }

  const requestSave = () => {
    if (!welder) return show('Pick your name', 2000)
    if (!party) return show('Pick where it is sent', 2000)
    if (plating && !gaadi.trim()) return show('Enter the gaadi (vehicle) number', 2500)
    if (filled.length === 0) return show('Add at least one product + quantity', 2500)
    if (frozen) return show(`🔒 Dates before ${FREEZE_BEFORE} are locked (verified history). Pick 1 June 2026 or later.`, 3500)
    if (!managerDateOk) return show('That date is locked — use the last 7 days', 3000)
    // Duplicate alarm: same product + same gaadi already entered today.
    const g = gaadi.trim()
    const dups = g ? filled.filter(it => dispatches.list.some(d => d.date === date && (d.gaadi || '') === g && d.productName === it.product && Number(d.qty) > 0)).map(it => it.product) : []
    setDupWarn(dups.join(', '))
    // Insufficient-stock warning (non-blocking): does this production drop any
    // raw material below zero? Sum the recipe need across all lines first.
    const stock = computeStock(components.list, receipts.list, dispatches.list, products.list, adjustments.list)
    const need = {}
    filled.forEach(it => {
      const p = products.list.find(x => x.name === it.product)
      recipeOf(p).forEach(r => { need[r.componentId] = (need[r.componentId] || 0) + Number(r.qty) * Number(it.qty) })
    })
    const short = Object.entries(need)
      .filter(([cid, q]) => stock[cid] && (stock[cid].stock - q) < 0)
      .map(([cid, q]) => `${stock[cid].name} (have ${fmtNum(stock[cid].stock)}, need ${fmtNum(q)})`)
    setStockWarn(short.join(' · '))
    savingRef.current = false; setSaving(false) // fresh attempt
    setConfirming(true)
  }

  const doSave = () => {
    if (savingRef.current) return // already saving this challan — ignore double-tap
    savingRef.current = true; setSaving(true)
    setConfirming(false)
    // EVERY dispatch gets its own welder challan number (NAV-001) — chrome, gold,
    // rose, powder, or any future finish. (Only plating finishes also flow to the
    // plating app below.) The number is derived from synced data so it stays
    // unique across phones and survives a crash.
    const r = nextWelderChallan(counters.get(), welder, dispatches.list)
    const code = r.code
    const cur = counters.get() || {}
    counters.set({ ...cur, challan: { ...(cur.challan || {}), [welder]: r.n } })
    // Future-compat values (hidden, optional) computed once for this save.
    const batchId = makeId('batch')                                  // groups this gaadi-load's lines
    const productIdByName = Object.fromEntries(products.list.map(p => [p.name, p.id]))
    const destinationApp = isPlatingFinish(finish) ? 'platingjobwork' : '' // powder = in-house, no destination
    const createdByRole = floor ? 'welder' : (by === 'Owner' ? 'owner' : 'incharge')
    const stamp = new Date().toISOString()
    filled.forEach(it => {
      dispatches.insert({
        date, welder, productName: it.product, finish, finishedName: finishedName(it.product, finish),
        party, qty: Number(it.qty), gaadi: gaadi.trim(), welderChallan: code, dispatched: true,
        // future-compatibility (hidden; auto-filled where known)
        batchId, productId: productIdByName[it.product] || '',
        workflowStage: WORKFLOW_STAGE, sourceApp: SOURCE_APP, destinationApp,
        linkedChallanId: code, parentTransactionId: '',
        createdByRole, updatedAt: stamp, factoryId: DEFAULT_FACTORY_ID,
      })
    })
    // Plating-eligible items (exclude "not for plating" products). The old
    // Plating Outbox preview is removed — material flows to the Plating app via
    // the Incoming queue below.
    const noPlatingSet = new Set(products.list.filter(p => p.noPlating).map(p => p.name))
    const platingItems = filled.filter(it => !noPlatingSet.has(it.product))
    // REAL plating integration: queue an "Incoming From Welder" item in the
    // Plating app (no challan yet — they Accept it there). Plating finishes only,
    // dated on/after the cutoff. Idempotent by id (one per welder challan).
    if (plating && code && platingItems.length && date >= PLATING_SYNC_FROM) {
      pushPlatingIncoming({
        id: `feed_${code}`, status: 'pending',
        date, party, gaadi: gaadi.trim(),
        items: platingItems.map(it => ({ product: it.product, quantity: Number(it.qty) })),
        welderChallanNo: code, linkedChallanId: code, batchId,
        sourceApp: SOURCE_APP, destinationApp: 'platingjobwork', parentTransactionId: '',
        createdAt: stamp, createdBy: who,
      }).catch(() => {})
    }
    log('SENT', `${welder}: ${filled.length} product/s${code ? ' · ' + code : ''} → ${party}${gaadi.trim() ? ' · gaadi …' + last4(gaadi) : ''}`, who)
    lastUsed.set({ ...lastUsed.get(), welder, finish, party })
    show(`Saved ${filled.length} product/s${code ? ' · ' + code : ''} ✓`)
    setItems([{ product: '', qty: '' }]); setGaadi('')
  }

  return (
    <div className={`max-w-lg mx-auto p-4 space-y-4 ${floor ? 'pb-28' : ''}`}>
      <Toast msg={msg} />

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Welder</FieldLabel>
            {operator
              ? <div className="mt-1 w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 text-base font-bold text-slate-700 bg-slate-50">{operator}</div>
              : <Select className="mt-1" value={welder} onChange={e => setWelder(e.target.value)} options={welders.list.map(w => ({ value: w.name, label: w.name }))} />}
          </div>
          <div>
            <FieldLabel>Date {floor ? <span className="text-slate-400 font-normal normal-case">(today or last 2 days)</span> : (by !== 'Owner' && <span className="text-slate-400 font-normal normal-case">(last 7 days)</span>)}</FieldLabel>
            {/* Date window by role: shop floor = today + last 2 days; Manager =
                last 7 days (managerDateOk is the real guard on save); Owner = back
                to the freeze cutoff only. NOTHING before FREEZE_BEFORE (=1 June,
                the verified history & the Plating sync cutoff) can be entered. */}
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={floor ? daysAgoStr(2) : (by === 'Owner' ? FREEZE_BEFORE : daysAgoStr(7))}
              max={by === 'Owner' ? undefined : todayStr()}
              className="mt-1 w-full border-2 border-slate-300 rounded-2xl px-3 py-2.5 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-amber-200 focus:border-amber-500" />
            {frozen && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 font-semibold">
                🔒 Locked — dates before {FREEZE_BEFORE} are the verified history. Pick 1 June 2026 or later.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <FieldLabel>Finish</FieldLabel>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {FINISHES.map(f => (
              <button key={f.key} onClick={() => pickFinish(f.key)}
                className={`py-3 rounded-2xl font-bold text-sm transition-colors ${finish === f.key ? 'bg-amber-500 text-white shadow' : 'bg-slate-100 text-slate-600'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Sent to</FieldLabel>
          <Select className="mt-1.5" value={party} onChange={e => setParty(e.target.value)} options={partyOpts} />
        </div>
        <div>
          <FieldLabel>Gaadi No {plating ? <span className="text-red-400 font-normal normal-case">(required for plating)</span> : <span className="text-slate-400 font-normal normal-case">(optional)</span>}</FieldLabel>
          <TextInput className="mt-1.5 !w-32 text-center text-xl tracking-[0.3em] font-bold" inputMode="numeric" placeholder="1234" value={gaadi} onChange={e => setGaadi(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <FieldLabel>Products {finish && <span className="text-amber-600 normal-case">→ {FINISHES.find(f => f.key === finish)?.suffix}</span>}</FieldLabel>
        {items.map((it, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <div className="flex-1 min-w-0"><Select className="!w-full" value={it.product} onChange={e => setItem(i, { product: e.target.value })} options={prodOpts} /></div>
            <NumberInput className="!w-20 text-center flex-shrink-0 !px-2" placeholder="qty" value={it.qty} onChange={e => setItem(i, { qty: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            <button onClick={() => delItem(i)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 font-bold flex-shrink-0">✕</button>
          </div>
        ))}
        <Button variant="neutral" className="w-full" onClick={addItem}>+ Add product</Button>
      </Card>

      {floor ? (
        // Shop floor: SAVE pinned to the bottom so it's always reachable.
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 z-20 no-print" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="max-w-lg mx-auto">
            <Button variant="primary" size="lg" className="w-full text-lg py-4 !bg-amber-600 !shadow-amber-300" onClick={requestSave}>
              SAVE{filled.length > 0 ? ` · ${filled.length} product/s · ${fmtNum(totalQty)} pcs` : ''}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="w-full text-lg py-5 !bg-amber-600 !shadow-amber-300" onClick={requestSave}>
          SAVE{filled.length > 0 ? ` · ${filled.length} product/s · ${fmtNum(totalQty)} pcs` : ''}
        </Button>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <FieldLabel>Sent on {fmtDate(date)}{welder ? ` · ${welder}` : ''}</FieldLabel>
          <span className="text-sm font-bold text-slate-400">{fmtNum(todays.reduce((s, d) => s + (Number(d.qty) || 0), 0))} pcs</span>
        </div>
        {todays.length === 0 ? <p className="text-sm text-slate-400">Nothing sent yet.</p> : (
          <div className="space-y-2">
            {todays.map(d => (
              <div key={d.id} className="bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold ${d.qty === 0 ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{d.finishedName || d.productName}</div>
                    <div className="text-xs text-slate-400">→ {d.party}{d.welderChallan ? ` · ${d.welderChallan}` : ''}{d.gaadi ? ` · …${last4(d.gaadi)}` : ''}</div>
                  </div>
                  <span className={`font-mono font-bold ${d.qty === 0 ? 'text-slate-400' : 'text-amber-700'}`}>{d.qty === 0 ? 'cancelled' : `× ${fmtNum(d.qty)}`}</span>
                </div>
                {/* Welder entries are LOCKED for the welder — only Manager (≤2 days)
                    and Admin (anytime) correct them in Entries/History. */}
                {!floor && canEditDay && d.qty > 0 && (
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

      {/* Your last 15 days — read-only review so the welder can check their own
          entries and ask the owner about anything that looks wrong. */}
      {welder && last15ByDate.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <FieldLabel>📅 Your last 15 days · {welder}</FieldLabel>
            <span className="text-sm font-bold text-slate-400">
              {fmtNum(last15ByDate.reduce((s, [, ds]) => s + ds.reduce((t, d) => t + (Number(d.qty) || 0), 0), 0))} pcs
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Check your entries. If anything looks wrong, tell the owner.</p>
          <div className="space-y-3">
            {last15ByDate.map(([d, ds]) => (
              <div key={d}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-500">{fmtDate(d)}</span>
                  <span className="text-xs font-semibold text-slate-400">{fmtNum(ds.reduce((s, x) => s + (Number(x.qty) || 0), 0))} pcs</span>
                </div>
                <div className="space-y-1">
                  {ds.map(x => (
                    <div key={x.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-700 truncate">{x.finishedName || x.productName}</div>
                        <div className="text-[11px] text-slate-400 truncate">→ {x.party}{x.welderChallan ? ` · ${x.welderChallan}` : ''}{x.gaadi ? ` · …${last4(x.gaadi)}` : ''}</div>
                      </div>
                      <span className="font-mono font-bold text-amber-700 flex-shrink-0">× {fmtNum(x.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {fixing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setFixing(null)}>
          <Card className="p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Fix · {fixing.finishedName || fixing.productName}</FieldLabel>
            <div><FieldLabel>Quantity</FieldLabel><NumberInput className="mt-1.5" value={fixQty} onChange={e => setFixQty(e.target.value)} /></div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setFixing(null)}>Close</Button>
              <Button variant="success" className="flex-1" onClick={saveFix}>Save</Button>
            </div>
          </Card>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setConfirming(false)}>
          <Card className="p-6 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-slate-800">Save this challan?</div>
            {dupWarn && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 text-sm text-red-700 font-semibold">
                ⚠ Already entered today for gaadi {gaadi.trim()}: <b>{dupWarn}</b>. This may be a double entry — save again only if it's really a new load.
              </div>
            )}
            {stockWarn && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-sm text-amber-700 font-semibold">
                ⚠ Insufficient stock: {stockWarn}. You can still save (not blocked) — but check the raw material.
              </div>
            )}
            <div className="text-sm text-slate-500">
              {welder} → <b>{party}</b> ({FINISHES.find(f => f.key === finish)?.suffix}){gaadi.trim() ? ` · gaadi …${last4(gaadi)}` : ''}
            </div>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1 max-h-44 overflow-auto">
              {filled.map((it, i) => <div key={i} className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{it.product}</span><span className="font-mono">{fmtNum(it.qty)}</span></div>)}
            </div>
            {plating && gaadi.trim() && <p className="text-xs text-blue-600">→ also generates the plating challan for {party}.</p>}
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Yes, Save'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
