/**
 * HISAB — one clean screen per welder for all money. Rule the owner asked for:
 *   • The OPEN (unfinalized) month absorbs ALL advances/payments up to today.
 *   • On Finalize: snapshot + LOCK (admin password to change), and only the
 *     net CARRY-FORWARD moves into the next month as its opening.
 * Production is always counted in its own calendar month; advances/payments are
 * counted from the last finalized cut-off up to today (or this month's cut-off
 * if already finalized). Reuses pay.js rateOn — same numbers, simple view.
 */
import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, FieldLabel, NumberInput, Select, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { computeHisab, lockedOn, nextPaymentSlip, newPayment, paidByLabel } from '../logic/pay'
import { ADMIN_PASSWORD, PAYMENT_MODES } from '../config'

const num = (v) => Number(v) || 0
const money = (n) => '₹' + fmtNum(Math.round(num(n)))
const rate$ = (n) => '₹' + (Math.round(num(n) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) }

export default function Hisab({ owner = false, by = 'admin' }) {
  const { dispatches, products, rates, payments, ledger, settlements, welders, log } = useWelder()
  const { msg, show } = useToast()
  const myRole = owner ? 'Owner' : 'Manager'

  const [welder, setWelder] = useState(welders.list[0]?.name || '')
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [showEarn, setShowEarn] = useState(false)
  const [form, setForm] = useState(null)
  const [finalizing, setFinalizing] = useState(false)

  const isCurrentMonth = month >= todayStr().slice(0, 7)
  const refProducts = useMemo(() => new Set(products.list.filter(p => p.referenceOnly).map(p => p.name)), [products.list])
  const h = useMemo(() => computeHisab({ dispatches: dispatches.list, rates: rates.list, payments: payments.list, ledger: ledger.list, settlements: settlements.list, refProducts, welder, month, today: todayStr() }),
    [dispatches.list, rates.list, payments.list, ledger.list, settlements.list, refProducts, welder, month])

  const refPcs = refProducts.size
    ? dispatches.list.filter(d => d.welder === welder && num(d.qty) > 0 && refProducts.has(d.productName) && d.date >= `${month}-01` && d.date <= `${month}-31`).reduce((s, d) => s + num(d.qty), 0)
    : 0

  // ---- actions ----
  const lockGuard = (date) => {
    const s = lockedOn(settlements?.list, welder, date)
    if (!s) return true
    const pwd = prompt(`${welder}'s ${s.month} hisab is finalized & locked (up to ${s.cutoffDate}).\nAdmin password to change:`)
    if (pwd === null) return false
    if (pwd !== ADMIN_PASSWORD) { show('Wrong password — locked', 2500); return false }
    return true
  }
  const addAdvance = ({ amount, date, note }) => {
    const v = num(amount); if (v <= 0) return show('Enter amount', 2000)
    if (!lockGuard(date)) return
    ledger.insert({ contractor: welder, date, type: 'advance', direction: 'credit', amount: v, note: (note || '').trim(), createdBy: paidByLabel('', myRole), reversed: false })
    log('ADVANCE', `${welder} advance -${money(v)}${note ? ' · ' + note : ''} (${myRole})`, by)
    show('Advance added ✓'); setForm(null)
  }
  const addPayment = ({ amount, date, mode, note }) => {
    const v = num(amount); if (v <= 0) return show('Enter amount', 2000)
    if (!lockGuard(date)) return
    const slip = nextPaymentSlip(payments.list)
    payments.insert(newPayment({ slip, contractor: welder, amount: v, date, mode, remark: note, paidByUser: '', paidByRole: myRole }))
    log('PAYMENT', `${slip} · ${welder} ${money(v)} (${mode || 'Cash'})`, by, slip)
    show(`Payment ${slip} recorded ✓`); setForm(null)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('UNICO — Welder Hisab', 14, 16)
    doc.setFontSize(12); doc.text(`${welder}`, 14, 25); doc.setFontSize(10); doc.text(`${monthLabel(month)}${h.locked ? '  (finalized)' : ''}`, 14, 31)
    let y = 37
    if (h.opening) { doc.setFontSize(10); doc.text(`Opening balance b/f: ${money(h.opening)} ${h.opening >= 0 ? 'payable' : 'advance'}`, 14, y); y += 4 }
    // Earnings
    const body = [
      ...h.pieceProducts.map(p => [p.product, fmtNum(p.qty), p.mixed ? 'mixed' : rate$(p.rate), money(p.amount)]),
      ...h.matLines.map(l => [l.desc + '  (material)', '', '', money(l.amount)]),
    ]
    autoTable(doc, { startY: y + 3, head: [['Product', 'Qty', 'Rate', 'Amount']], body, foot: [['', '', 'Total earned', money(h.earned)]],
      theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [217, 119, 6] }, footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' } })
    y = doc.lastAutoTable.finalY + 6
    // Advances + payments
    const ap = [...h.advList.map(a => [fmtDate(a.date), a.label + (a.note ? ' · ' + a.note : ''), money(a.amount)]),
      ...h.payList.map(p => [fmtDate(p.date), 'Payment' + (p.slip ? ' · ' + p.slip : ''), money(p.amount)])]
    if (ap.length) {
      autoTable(doc, { startY: y, head: [['Date', 'Advance / Payment', 'Amount']], body: ap, foot: [['', 'Total given', money(h.advTotal + h.payTotal)]],
        theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [13, 148, 136] }, footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' } })
      y = doc.lastAutoTable.finalY + 6
    }
    doc.setFontSize(12); doc.setFont(undefined, 'bold')
    doc.text(h.net >= 0 ? `NET PAYABLE to ${welder}: ${money(h.net)}` : `ADVANCE carried forward: ${money(-h.net)}`, 14, y)
    y += 14; doc.setFont(undefined, 'normal'); doc.setFontSize(9)
    doc.text('Welder sign: __________________', 14, y); doc.text('Owner sign: __________________', 110, y)
    doc.save(`hisab-${welder}-${month}.pdf`); show('PDF ready ✓')
  }

  const finalize = ({ dayPay }) => {
    if (h.locked) return show('Already finalized', 2000)
    const dp = num(dayPay), cutoff = todayStr()
    if (dp > 0) {
      const slip = nextPaymentSlip(payments.list)
      payments.insert(newPayment({ slip, contractor: welder, amount: dp, date: cutoff, mode: 'Cash', remark: 'Hisab settlement', paidByUser: '', paidByRole: myRole }))
      log('PAYMENT', `${slip} · ${welder} ${money(dp)} (settlement)`, by, slip)
    }
    const net = h.net - dp
    settlements.insert({ welder, month, periodFrom: `${month}-01`, periodTo: cutoff, cutoffDate: cutoff, opening: h.opening, earned: h.earned, advances: h.advTotal, payments: h.payTotal + dp, dayPayment: dp, net, finalizedBy: by, locked: true })
    log('SETTLEMENT_FINALIZE', `${welder} ${month} · earned ${money(h.earned)} net ${money(net)} (lock ≤ ${cutoff})`, by)
    show('Hisab finalized & locked ✓'); setFinalizing(false); exportPDF()
  }
  const reopen = () => {
    const pwd = prompt(`Reopen ${welder}'s ${month} hisab?\nAdmin password:`)
    if (pwd === null) return
    if (pwd !== ADMIN_PASSWORD) return show('Wrong password', 2500)
    settlements.update(h.settlement.id, { locked: false }); log('SETTLEMENT_REOPEN', `${welder} ${month}`, by); show('Reopened ✓')
  }

  // ---- render ----
  return (
    <div className="space-y-3 pb-24">
      <div className="grid grid-cols-2 gap-2">
        {welders.list.map(w => (
          <button key={w.name} onClick={() => setWelder(w.name)}
            className={`py-3 rounded-2xl font-bold text-base ${welder === w.name ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-600 border-2 border-slate-200'}`}>👷 {w.name}</button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-200 p-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-12 h-12 rounded-xl bg-slate-100 text-2xl font-bold active:bg-slate-200">◀</button>
        <div className="text-center"><div className="font-bold text-slate-800">{monthLabel(month)}</div>{h.locked && <div className="text-[11px] text-rose-600 font-bold">🔒 finalized · locked ≤ {fmtDate(h.advUpper)}</div>}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} className={`w-12 h-12 rounded-xl text-2xl font-bold ${isCurrentMonth ? 'bg-slate-50 text-slate-300' : 'bg-slate-100 active:bg-slate-200'}`}>▶</button>
      </div>

      <Card className={`p-5 text-center ${h.net >= 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div className="text-xs text-slate-500 font-semibold">{h.net >= 0 ? `PAYABLE to ${welder}` : `ADVANCE with ${welder}`}</div>
        <div className={`text-4xl font-extrabold mt-1 ${h.net >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{money(Math.abs(h.net))}</div>
        {h.opening !== 0 && <div className="text-[11px] text-slate-400 mt-1">includes carry-forward {money(h.opening)}</div>}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Earned" value={money(h.earned)} tone="text-slate-800" />
        <Stat label="Advances" value={money(h.advTotal)} tone="text-amber-700" />
        <Stat label="Paid" value={money(h.payTotal)} tone="text-emerald-700" />
      </div>

      <Card className="p-4">
        <button onClick={() => setShowEarn(s => !s)} className="w-full flex items-center justify-between font-bold text-slate-700">
          <span>📦 What {welder} made — {money(h.earned)}</span><span className="text-slate-400">{showEarn ? '▲' : '▼'}</span>
        </button>
        {showEarn && (
          <div className="mt-3 space-y-1 text-sm">
            {h.pieceProducts.length === 0 && h.matLines.length === 0 && <p className="text-slate-400">No production this month.</p>}
            {h.pieceProducts.map(p => (
              <div key={p.product} className="flex justify-between"><span className="text-slate-600">{p.product} <span className="text-slate-400">× {fmtNum(p.qty)} @ {p.mixed ? 'mixed' : rate$(p.rate)}</span></span><span className="font-mono font-semibold">{money(p.amount)}</span></div>
            ))}
            {h.matLines.length > 0 && <div className="text-[11px] font-bold text-slate-500 pt-1">Material (from dispatch)</div>}
            {h.matLines.map((l, i) => (<div key={i} className="flex justify-between"><span className="text-slate-600">{l.desc}</span><span className="font-mono font-semibold">{money(l.amount)}</span></div>))}
            {refPcs > 0 && <p className="text-[11px] text-amber-600 pt-1">📦 {fmtNum(refPcs)} material pcs entered by welder = reference only (paid via dispatch).</p>}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-bold text-slate-700">💵 Advances & Payments {h.locked ? '(locked)' : '— till today'}</div>
        {h.advList.length === 0 && h.payList.length === 0 && <p className="text-sm text-slate-400">None.</p>}
        {[...h.advList.map(a => ({ ...a, kind: a.label })), ...h.payList.map(p => ({ date: p.date, kind: 'Payment', note: p.slip, amount: p.amount }))].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((l, i) => (
          <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-1">
            <span className="text-slate-600">{fmtDate(l.date)} · <b>{l.kind === 'Payment' ? '💸 Paid' : l.kind === 'Opening' ? '⏪ Opening' : '🟠 ' + l.kind}</b>{l.note ? ` · ${l.note}` : ''}</span>
            <span className="font-mono font-bold text-slate-700">{money(l.amount)}</span>
          </div>
        ))}
        {!h.locked && (
          <div className={`grid ${owner ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
            {owner && <Button size="sm" className="!bg-amber-500 !text-white" onClick={() => setForm('advance')}>＋ Advance</Button>}
            <Button size="sm" variant="success" onClick={() => setForm('payment')}>＋ Payment</Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="neutral" onClick={exportPDF}>📄 Hisab PDF</Button>
        {owner && !h.locked && <Button variant="primary" onClick={() => setFinalizing(true)}>🔒 Finalize Month</Button>}
        {owner && h.locked && <Button variant="neutral" onClick={reopen}>🔓 Reopen Month</Button>}
      </div>

      {form === 'advance' && <EntryForm title={`Advance to ${welder}`} tone="amber" withMode={false} onSave={addAdvance} onCancel={() => setForm(null)} />}
      {form === 'payment' && <EntryForm title={`Payment to ${welder}`} tone="emerald" withMode onSave={addPayment} onCancel={() => setForm(null)} />}
      {finalizing && <FinalizeForm welder={welder} month={monthLabel(month)} closing={h.net} onConfirm={finalize} onCancel={() => setFinalizing(false)} />}
      <Toast msg={msg} />
    </div>
  )
}

function Stat({ label, value, tone }) {
  return <div className="bg-white rounded-2xl border-2 border-slate-100 p-3 text-center"><div className={`text-base font-bold ${tone}`}>{value}</div><div className="text-[11px] text-slate-500">{label}</div></div>
}

function EntryForm({ title, tone, withMode, onSave, onCancel }) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayStr()); const [mode, setMode] = useState('Cash'); const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-lg text-slate-800">{title}</div>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Amount ₹</FieldLabel><NumberInput inputMode="decimal" className="mt-1 text-2xl text-center font-bold !py-3" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        {withMode && <div><FieldLabel>Mode</FieldLabel><Select className="mt-1" value={mode} onChange={e => setMode(e.target.value)} options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} /></div>}
        <div><FieldLabel>Note (optional)</FieldLabel><TextInput className="mt-1" placeholder="e.g. PF, ONLINE" value={note} onChange={e => setNote(e.target.value)} /></div>
        <div className="flex gap-2 pt-1">
          <Button variant="neutral" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant={tone === 'emerald' ? 'success' : 'primary'} className={`flex-1 ${tone === 'emerald' ? '' : '!bg-amber-500 !text-white'}`} onClick={() => onSave({ amount, date, mode, note })}>Save</Button>
        </div>
      </div>
    </div>
  )
}

function FinalizeForm({ welder, month, closing, onConfirm, onCancel }) {
  const [dayPay, setDayPay] = useState('')
  const net = closing - (Number(dayPay) || 0)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-lg text-slate-800">🔒 Finalize {month} — {welder}</div>
        <div className="text-xs text-slate-500">Counts all advances up to today, then LOCKS this month (admin password to change later). Only the carry-forward moves to next month.</div>
        <div><FieldLabel>Paid to {welder} today (optional)</FieldLabel><NumberInput inputMode="decimal" className="mt-1 !py-3 text-xl text-center font-bold" placeholder="0" value={dayPay} onChange={e => setDayPay(e.target.value)} /></div>
        <div className="bg-amber-50 rounded-xl p-3 text-sm font-bold text-amber-800">Carry forward: {money(Math.abs(net))} {net >= 0 ? `payable to ${welder}` : `advance with ${welder}`}</div>
        <div className="flex gap-2 pt-1">
          <Button variant="neutral" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onConfirm({ dayPay })}>Finalize & Lock</Button>
        </div>
      </div>
    </div>
  )
}
