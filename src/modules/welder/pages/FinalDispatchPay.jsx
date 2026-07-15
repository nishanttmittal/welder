/**
 * Add to Hisab (Final Dispatch) — OWNER ONLY.
 *
 * For a few particular FINISHED items, Jitender isn't paid at the welding stage;
 * he's paid on how many finished pieces are actually DISPATCHED (post coating /
 * fitting / packing). The owner books that here. Each save is a pay-only dispatch
 * record (payBasis:'final-dispatch'): it flows into the welder's hisab/ledger at
 * the item's date-based piece rate, but NEVER pushes to plating and is EXCLUDED
 * from physical production reports (see report.js / stock.js / Dashboard).
 *
 * Attribution is by DATE → the entry lands in that date's calendar-month hisab.
 * A finalized (locked) month is blocked — reopen it first, or the money won't
 * carry forward correctly (CTO review).
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, DateInput, TextInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { rateOn, lockedOn } from '../logic/pay'
import { makeId } from '../../../core/db/repository'
import { FREEZE_BEFORE, SOURCE_APP, DEFAULT_FACTORY_ID } from '../config'

const monthLabel = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export default function FinalDispatchPay({ owner = false, by = 'Owner' }) {
  const { dispatches, products, welders, rates, settlements, log } = useWelder()
  const { msg, show } = useToast()

  const [welder, setWelder] = useState(welders.list[0]?.name || '')
  const [date, setDate] = useState(todayStr())
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState('')
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  // Only tagged (finalDispatchOnly) items, common or this welder's.
  const itemOpts = useMemo(() => {
    const list = products.list
      .filter(p => p.finalDispatchOnly && (!p.welder || p.welder === welder))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [{ value: '', label: '— pick item —' }, ...list.map(p => ({ value: p.name, label: p.code ? `${p.name} (${p.code})` : p.name }))]
  }, [products.list, welder])

  const month = (date || '').slice(0, 7)
  const rate = product ? rateOn(rates.list, product, welder, date) : 0
  const amount = (Number(qty) || 0) * rate
  const frozen = !!date && date < FREEZE_BEFORE
  const lockedS = welder && date ? lockedOn(settlements.list, welder, date) : null

  // Recent final-dispatch pay entries for this welder (confidence list).
  const recent = useMemo(() =>
    dispatches.list
      .filter(d => d.payBasis === 'final-dispatch' && d.welder === welder && Number(d.qty) > 0)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 12),
    [dispatches.list, welder])

  const save = () => {
    if (saving) return
    if (!owner) return show('Owner only', 2500)
    if (!welder) return show('Pick the welder', 2000)
    if (!product) return show('Pick the item', 2000)
    if (!(Number(qty) > 0)) return show('Enter the dispatched quantity', 2000)
    if (frozen) return show(`🔒 Dates before ${FREEZE_BEFORE} are locked history. Pick 1 June 2026 or later.`, 3500)
    if (lockedS) return show(`🔒 ${monthLabel(lockedS.month)} hisab is FINALIZED. Reopen it first, add this, then re-finalize.`, 4500)
    setSaving(true)
    const rec = dispatches.insert({
      date, welder, productName: product, finish: 'raw', finishedName: product,
      party: '', qty: Number(qty), gaadi: '', welderChallan: '', dispatched: false,
      remarks: remark.trim(),
      batchId: makeId('fdpay'), productId: products.list.find(p => p.name === product)?.id || '',
      workflowStage: 'dispatch', sourceApp: SOURCE_APP, destinationApp: '',
      linkedChallanId: '', parentTransactionId: '',
      createdByRole: 'owner', updatedAt: new Date().toISOString(), factoryId: DEFAULT_FACTORY_ID,
      payBasis: 'final-dispatch',
    })
    log('FINAL_DISPATCH_PAY', `${welder}: ${product} × ${Number(qty)} @ ₹${rate} → ${monthLabel(month)} hisab${remark.trim() ? ' · ' + remark.trim() : ''}`, by, rec?.id)
    show(`Added to ${monthLabel(month)} hisab ✓`)
    setQty(''); setRemark(''); setSaving(false)
  }

  if (!owner) {
    return <div className="max-w-lg mx-auto p-8 text-center text-slate-400">Owner only.</div>
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800">
        Book pay for a <b>final-dispatch item</b> (paid on finished pieces dispatched, not at welding). Added to the welder's hisab for the <b>date's month</b>. Never sent to plating. Only tagged items appear here — tag them in <b>Admin → Products</b> and set their rate in <b>Rates</b>.
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Welder</FieldLabel>
            <Select className="mt-1" value={welder} onChange={e => setWelder(e.target.value)} options={welders.list.map(w => ({ value: w.name, label: w.name }))} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DateInput className="mt-1" value={date} min={FREEZE_BEFORE} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Live month attribution — so it never lands in the wrong hisab. */}
        <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${lockedS ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {frozen
            ? `🔒 Before ${FREEZE_BEFORE} — locked history`
            : lockedS
              ? `🔒 → ${monthLabel(month)} hisab is FINALIZED — reopen it first`
              : `→ adds to ${monthLabel(month)} hisab`}
        </div>

        <div>
          <FieldLabel>Item (tagged final-dispatch only)</FieldLabel>
          <Select className="mt-1" value={product} onChange={e => setProduct(e.target.value)} options={itemOpts} />
          {itemOpts.length === 1 && <p className="text-xs text-amber-600 mt-1">No items tagged yet — tag them in Admin → Products (Owner-only / final dispatch).</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Qty dispatched</FieldLabel>
            <NumberInput className="mt-1" placeholder="pcs" value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, '').slice(0, 5))} />
          </div>
          <div>
            <FieldLabel>Rate / piece</FieldLabel>
            <div className={`mt-1 border-2 rounded-2xl px-4 py-2.5 text-base font-bold ${product && rate === 0 ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              {product ? `₹${fmtNum(rate)}` : '—'}
            </div>
          </div>
        </div>
        {product && rate === 0 && <p className="text-xs text-red-600 -mt-2">No rate set for this item on {fmtDate(date)} — set it in Rates first, or it will pay ₹0.</p>}

        <div>
          <FieldLabel>Remark (optional)</FieldLabel>
          <TextInput className="mt-1" placeholder="e.g. dispatched to Kala Engineers" value={remark} onChange={e => setRemark(e.target.value)} />
        </div>

        {Number(qty) > 0 && product && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{fmtNum(qty)} × ₹{fmtNum(rate)}</span>
            <span className="text-lg font-bold text-emerald-700">₹{fmtNum(amount)}</span>
          </div>
        )}

        <Button variant="primary" size="lg" className="w-full !bg-purple-600 !shadow-purple-300"
          disabled={saving || !!frozen || !!lockedS} onClick={save}>
          {saving ? 'Adding…' : 'Add to Hisab'}
        </Button>
      </Card>

      <Card className="p-5">
        <FieldLabel>Recent final-dispatch pay · {welder}</FieldLabel>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">Nothing booked yet.</p>
        ) : (
          <div className="space-y-2 mt-2">
            {recent.map(d => (
              <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{d.productName}</div>
                  <div className="text-[11px] text-slate-400">{fmtDate(d.date)}{d.remarks ? ` · ${d.remarks}` : ''}</div>
                </div>
                <span className="font-mono font-bold text-purple-700 flex-shrink-0">× {fmtNum(d.qty)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">Correct or void any of these in <b>Entries</b> (owner-only edit).</p>
      </Card>
    </div>
  )
}
