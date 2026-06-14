/**
 * HISAB — one clean screen per welder for all money: earnings (piece + material),
 * advances, payments, running balance, PDF, and month-end finalize/lock.
 * Replaces the day-to-day need to bounce between Contractor Pay / Ledger /
 * Manage Advances. Reuses the proven pay.js engine — same numbers, simpler view.
 * NOTHING here changes stored data except the entries the owner explicitly adds.
 */
import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, FieldLabel, NumberInput, Select, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { statement, buildLedger, rateOn, lockedOn, nextPaymentSlip, newPayment, paidByLabel } from '../logic/pay'
import { ADMIN_PASSWORD, PAYMENT_MODES } from '../config'

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))
const rate$ = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) }

export default function Hisab({ owner = false, by = 'admin' }) {
  const { dispatches, products, rates, payments, ledger, settlements, welders, log } = useWelder()
  const { msg, show } = useToast()
  const myRole = owner ? 'Owner' : 'Manager'

  const [welder, setWelder] = useState(welders.list[0]?.name || '')
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [showEarn, setShowEarn] = useState(false)
  const [form, setForm] = useState(null)        // 'advance' | 'payment'
  const [finalizing, setFinalizing] = useState(false)

  const from = `${month}-01`, to = `${month}-31`
  const isCurrentMonth = month >= todayStr().slice(0, 7)
  const cutoff = isCurrentMonth ? todayStr() : to
  const refProducts = useMemo(() => new Set(products.list.filter(p => p.referenceOnly).map(p => p.name)), [products.list])

  const led = useMemo(
    () => buildLedger(dispatches.list, rates.list, payments.list, ledger.list, welder, from, to, refProducts),
    [dispatches.list, rates.list, payments.list, ledger.list, welder, from, to, refProducts])

  // Piece product breakdown for the month (material is shown from ledger lines).
  const st = useMemo(
    () => statement(dispatches.list, rates.list, payments.list, welder, from, to, { exclude: refProducts }),
    [dispatches.list, rates.list, payments.list, welder, from, to, refProducts])

  const matLines = led.lines.filter(l => l.type === 'Material (dispatch)')
  const earnedPiece = led.lines.filter(l => l.type === 'Production').reduce((s, l) => s + l.debit, 0)
  const earnedMaterial = matLines.reduce((s, l) => s + l.debit, 0)
  const earned = earnedPiece + earnedMaterial
  const advLines = led.lines.filter(l => l.type === 'Advance' || l.type === 'Opening Balance')
  const payLines = led.lines.filter(l => l.type === 'Payment')
  const advTotal = advLines.reduce((s, l) => s + l.credit, 0)
  const payTotal = payLines.reduce((s, l) => s + l.credit, 0)
  const closing = led.closing
  const settled = settlements.list.find(s => s.welder === welder && s.month === month && s.locked !== false)
  const refPcs = refProducts.size
    ? dispatches.list.filter(d => d.welder === welder && Number(d.qty) > 0 && refProducts.has(d.productName) && d.date >= from && d.date <= to).reduce((s, d) => s + Number(d.qty), 0)
    : 0

  // ---- actions ---------------------------------------------------------
  const lockGuard = (date) => {
    const s = lockedOn(settlements?.list, welder, date)
    if (!s) return true
    const pwd = prompt(`${welder}'s ${s.month} hisab is finalized & locked (up to ${s.cutoffDate}).\nAdmin password to change:`)
    if (pwd === null) return false
    if (pwd !== ADMIN_PASSWORD) { show('Wrong password — locked', 2500); return false }
    return true
  }

  const addAdvance = ({ amount, date, note }) => {
    const v = Number(amount) || 0
    if (v <= 0) return show('Enter amount', 2000)
    if (!lockGuard(date)) return
    ledger.insert({ contractor: welder, date, type: 'advance', direction: 'credit', amount: v, note: (note || '').trim(), createdBy: paidByLabel('', myRole), reversed: false })
    log('ADVANCE', `${welder} advance -${money(v)}${note ? ' · ' + note : ''} (${myRole})`, by)
    show('Advance added ✓'); setForm(null)
  }
  const addPayment = ({ amount, date, mode, note }) => {
    const v = Number(amount) || 0
    if (v <= 0) return show('Enter amount', 2000)
    if (!lockGuard(date)) return
    const slip = nextPaymentSlip(payments.list)
    payments.insert(newPayment({ slip, contractor: welder, amount: v, date, mode, remark: note, paidByUser: '', paidByRole: myRole }))
    log('PAYMENT', `${slip} · ${welder} ${money(v)} (${mode || 'Cash'})`, by, slip)
    show(`Payment ${slip} recorded ✓`); setForm(null)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('UNICO — Welder Hisab', 14, 16)
    doc.setFontSize(11); doc.text(welder, 14, 24); doc.text(monthLabel(month), 14, 30)
    doc.setFontSize(10); doc.text(`Opening b/f: ${money(led.opening)}`, 14, 37)
    autoTable(doc, {
      startY: 41, head: [['Date', 'Type', 'Details', 'Earned', 'Given', 'Balance']],
      body: led.lines.map(l => [fmtDate(l.date), l.type, l.description, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '', money(l.runningBalance)]),
      foot: [['', '', 'Closing', money(earned), money(advTotal + payTotal), money(closing)]],
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [217, 119, 6] }, footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    })
    let y = doc.lastAutoTable.finalY + 8; doc.setFontSize(11); doc.setFont(undefined, 'bold')
    doc.text(closing >= 0 ? `Net PAYABLE to ${welder}: ${money(closing)}` : `Advance carried forward: ${money(-closing)}`, 14, y)
    y += 12; doc.setFont(undefined, 'normal'); doc.setFontSize(9)
    doc.text('Welder sign: __________________', 14, y); doc.text('Owner sign: __________________', 110, y)
    doc.save(`hisab-${welder}-${month}.pdf`); show('PDF ready ✓')
  }

  const finalize = ({ dayPay }) => {
    if (settled) return show('Already finalized', 2000)
    const dp = Number(dayPay) || 0
    if (dp > 0) {
      const slip = nextPaymentSlip(payments.list)
      payments.insert(newPayment({ slip, contractor: welder, amount: dp, date: cutoff, mode: 'Cash', remark: 'Hisab settlement', paidByUser: '', paidByRole: myRole }))
      log('PAYMENT', `${slip} · ${welder} ${money(dp)} (settlement)`, by, slip)
    }
    const net = closing + dp
    settlements.insert({ welder, month, periodFrom: from, periodTo: cutoff, cutoffDate: cutoff, opening: led.opening, earned, advances: advTotal, payments: payTotal + dp, dayPayment: dp, net, finalizedBy: by, locked: true })
    log('SETTLEMENT_FINALIZE', `${welder} ${month} · earned ${money(earned)} net ${money(net)} (lock ≤ ${cutoff})`, by)
    show('Hisab finalized & locked ✓'); setFinalizing(false); exportPDF()
  }
  const reopen = () => {
    const pwd = prompt(`Reopen ${welder}'s ${settled.month} hisab?\nAdmin password:`)
    if (pwd === null) return
    if (pwd !== ADMIN_PASSWORD) return show('Wrong password', 2500)
    settlements.update(settled.id, { locked: false }); log('SETTLEMENT_REOPEN', `${welder} ${settled.month}`, by); show('Reopened ✓')
  }

  // ---- render ----------------------------------------------------------
  return (
    <div className="space-y-3 pb-24">
      {/* Welder picker */}
      <div className="grid grid-cols-2 gap-2">
        {welders.list.map(w => (
          <button key={w.name} onClick={() => setWelder(w.name)}
            className={`py-3 rounded-2xl font-bold text-base ${welder === w.name ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-600 border-2 border-slate-200'}`}>
            👷 {w.name}
          </button>
        ))}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-200 p-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-12 h-12 rounded-xl bg-slate-100 text-2xl font-bold active:bg-slate-200">◀</button>
        <div className="text-center"><div className="font-bold text-slate-800">{monthLabel(month)}</div>{settled && <div className="text-[11px] text-rose-600 font-bold">🔒 finalized</div>}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} className={`w-12 h-12 rounded-xl text-2xl font-bold ${isCurrentMonth ? 'bg-slate-50 text-slate-300' : 'bg-slate-100 active:bg-slate-200'}`}>▶</button>
      </div>

      {/* Balance headline */}
      <Card className={`p-5 text-center ${closing >= 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div className="text-xs text-slate-500 font-semibold">{closing >= 0 ? `PAYABLE to ${welder}` : `ADVANCE with ${welder}`}</div>
        <div className={`text-4xl font-extrabold mt-1 ${closing >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{money(Math.abs(closing))}</div>
        {led.opening !== 0 && <div className="text-[11px] text-slate-400 mt-1">includes b/f {money(led.opening)}</div>}
      </Card>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Earned" value={money(earned)} tone="text-slate-800" />
        <Stat label="Advances" value={money(advTotal)} tone="text-amber-700" />
        <Stat label="Paid" value={money(payTotal)} tone="text-emerald-700" />
      </div>

      {/* Earnings detail */}
      <Card className="p-4">
        <button onClick={() => setShowEarn(s => !s)} className="w-full flex items-center justify-between font-bold text-slate-700">
          <span>📦 What {welder} made — {money(earned)}</span><span className="text-slate-400">{showEarn ? '▲' : '▼'}</span>
        </button>
        {showEarn && (
          <div className="mt-3 space-y-1 text-sm">
            {st.products.length === 0 && matLines.length === 0 && <p className="text-slate-400">No production this month.</p>}
            {st.products.map(p => (
              <div key={p.product} className="flex justify-between"><span className="text-slate-600">{p.product} <span className="text-slate-400">× {fmtNum(p.qty)} @ {p.mixed ? 'mixed' : rate$(p.rate)}</span></span><span className="font-mono font-semibold">{money(p.amount)}</span></div>
            ))}
            {matLines.length > 0 && <div className="text-[11px] font-bold text-slate-500 pt-1">Material (from dispatch)</div>}
            {matLines.map((l, i) => (
              <div key={i} className="flex justify-between"><span className="text-slate-600">{l.description}</span><span className="font-mono font-semibold">{money(l.debit)}</span></div>
            ))}
            {refPcs > 0 && <p className="text-[11px] text-amber-600 pt-1">📦 {fmtNum(refPcs)} material pcs entered by welder = reference only (paid via dispatch, not counted here).</p>}
          </div>
        )}
      </Card>

      {/* Advances & payments */}
      <Card className="p-4 space-y-2">
        <div className="font-bold text-slate-700">💵 Advances & Payments — {monthLabel(month)}</div>
        {advLines.length === 0 && payLines.length === 0 && <p className="text-sm text-slate-400">None this month.</p>}
        {[...advLines, ...payLines].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((l, i) => (
          <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-1">
            <span className="text-slate-600">{fmtDate(l.date)} · <b>{l.type === 'Payment' ? '💸 Paid' : l.type === 'Opening Balance' ? '⏪ Opening' : '🟠 Advance'}</b>{l.description && l.type !== 'Payment' ? ` · ${l.description}` : ''}{l.slipNo ? ` · ${l.slipNo}` : ''}</span>
            <span className="font-mono font-bold text-slate-700">{money(l.credit)}</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button size="sm" className="!bg-amber-500 !text-white" onClick={() => setForm('advance')}>＋ Advance</Button>
          <Button size="sm" variant="success" onClick={() => setForm('payment')}>＋ Payment</Button>
        </div>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="neutral" onClick={exportPDF}>📄 Hisab PDF</Button>
        {owner && !settled && <Button variant="primary" onClick={() => setFinalizing(true)}>🔒 Finalize Month</Button>}
        {owner && settled && <Button variant="neutral" onClick={reopen}>🔓 Reopen Month</Button>}
      </div>

      {form === 'advance' && <EntryForm title={`Advance to ${welder}`} tone="amber" withMode={false} onSave={addAdvance} onCancel={() => setForm(null)} />}
      {form === 'payment' && <EntryForm title={`Payment to ${welder}`} tone="emerald" withMode onSave={addPayment} onCancel={() => setForm(null)} />}
      {finalizing && <FinalizeForm welder={welder} month={monthLabel(month)} cutoff={cutoff} closing={closing} onConfirm={finalize} onCancel={() => setFinalizing(false)} />}
      <Toast msg={msg} />
    </div>
  )
}

function Stat({ label, value, tone }) {
  return <div className="bg-white rounded-2xl border-2 border-slate-100 p-3 text-center"><div className={`text-base font-bold ${tone}`}>{value}</div><div className="text-[11px] text-slate-500">{label}</div></div>
}

function EntryForm({ title, tone, withMode, onSave, onCancel }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [mode, setMode] = useState('Cash')
  const [note, setNote] = useState('')
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

function FinalizeForm({ welder, month, cutoff, closing, onConfirm, onCancel }) {
  const [dayPay, setDayPay] = useState('')
  const net = closing + (Number(dayPay) || 0)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-lg text-slate-800">🔒 Finalize {month} — {welder}</div>
        <div className="text-xs text-slate-500">Locks all entries up to {fmtDate(cutoff)} (admin password to change later). Current balance: <b>{money(Math.abs(closing))} {closing >= 0 ? 'payable' : 'advance'}</b>.</div>
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
