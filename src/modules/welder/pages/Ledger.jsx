/**
 * Contractor Ledger (accounting view).
 *   • Manager (In-Charge): view ledger, record PAYMENTS, export. No edit/reverse,
 *     no advances/adjustments/opening, no rate access.
 *   • Owner: full — add any entry, edit/reverse payments (with audit log).
 * Columns: Date | Slip No | Type | Remark | Paid By | Debit | Credit | Balance.
 * Production = Debit (owed↑), Payment/Advance = Credit (owed↓). Running balance
 * positive = payable to contractor. Everything is derived & single-sourced.
 */
import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, FieldLabel, NumberInput, Select, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { buildLedger, nextPaymentSlip, newPayment, paidByLabel, lockedOn } from '../logic/pay'
import { ADMIN_PASSWORD } from '../config'
import { PAYMENT_MODES, MANAGER_HISTORY_MONTHS } from '../config'

/** First selectable date for a Manager (owner unlimited). */
function managerFloorDate() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - MANAGER_HISTORY_MONTHS)
  return d.toISOString().slice(0, 10)
}

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))
const signed = (n) => (n < 0 ? '-' : '') + money(Math.abs(n))
const balLabel = (n) => n > 0 ? `${money(n)} payable` : n < 0 ? `${money(-n)} advance/credit` : '₹0 settled'

// dir: how a manual entry affects the balance ('debit' = increases owed).
const ENTRY_TYPES = [
  { key: 'payment',    label: 'Payment',         dir: 'credit' },
  { key: 'advance',    label: 'Advance',         dir: 'credit' },
  { key: 'adjustment', label: 'Adjustment',      dir: 'debit'  },
  { key: 'opening',    label: 'Opening Balance', dir: 'debit'  },
]

export default function Ledger({ owner = false, by = 'owner' }) {
  const { dispatches, rates, payments, ledger, welders, products, settlements, log } = useWelder()
  const { msg, show } = useToast()
  const myRole = owner ? 'Owner' : 'Manager'

  const [contractor, setContractor] = useState(welders.list[0]?.name || '')
  const [mode, setMode] = useState('month')                 // 'month' | 'range'
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01')
  const [to, setTo] = useState(todayStr())
  const mgrMinDate = owner ? undefined : managerFloorDate()
  const mgrMinMonth = owner ? undefined : managerFloorDate().slice(0, 7)
  const mgrMaxDate = owner ? undefined : todayStr()
  const mgrMaxMonth = owner ? undefined : todayStr().slice(0, 7)
  const [form, setForm] = useState(null)                    // { type, dir } when adding
  const [editPay, setEditPay] = useState(null)              // payment record being edited

  const periodFrom = mode === 'month' ? `${month}-01` : from
  const periodTo   = mode === 'month' ? `${month}-31` : to
  const periodLabel = mode === 'month' ? month : `${fmtDate(from)} – ${fmtDate(to)}`

  const refProducts = useMemo(() => new Set(products.list.filter(p => p.referenceOnly).map(p => p.name)), [products.list])
  const led = useMemo(
    () => buildLedger(dispatches.list, rates.list, payments.list, ledger.list, contractor, periodFrom, periodTo, refProducts),
    [dispatches.list, rates.list, payments.list, ledger.list, contractor, periodFrom, periodTo, refProducts])

  // Block adding/changing entries inside a finalized (locked) hisab without the admin password.
  const lockGuard = (date) => {
    const s = lockedOn(settlements?.list, contractor, date)
    if (!s) return true
    const pwd = prompt(`${contractor}'s ${s.month} hisab is FINALIZED & locked (entries up to ${s.cutoffDate}).\nEnter admin password to change:`)
    if (pwd === null) return false
    if (pwd !== ADMIN_PASSWORD) { show('Wrong password — locked', 2500); return false }
    return true
  }

  const saveEntry = (type, { amount, date, mode: payMode, remark, name, direction }) => {
    const v = Number(amount) || 0
    if (v <= 0) return show('Enter an amount', 2000)
    if (!contractor) return show('Pick a contractor', 2000)
    if (!lockGuard(date)) return
    if (type === 'payment') {
      const slip = nextPaymentSlip(payments.list)
      payments.insert(newPayment({ slip, contractor, amount: v, date, mode: payMode, remark, paidByUser: name, paidByRole: myRole }))
      log('PAYMENT', `${slip} · ${contractor} ${money(v)} (${payMode || 'Cash'})${name ? ' · ' + name : ''} (${myRole})`, by, slip)
      show(`Payment ${slip} recorded ✓`)
    } else {
      ledger.insert({ contractor, date, type, direction, amount: v, note: (remark || '').trim(), createdBy: paidByLabel(name, myRole), reversed: false })
      log(type.toUpperCase(), `${contractor} ${type} ${direction === 'debit' ? '+' : '-'}${money(v)}${remark ? ' · ' + remark : ''} (${myRole})`, by)
      show('Entry added ✓')
    }
    setForm(null)
  }

  // Owner: reverse (never delete) — keeps history, drops it from the balance.
  const reverseLine = (line) => {
    if (!lockGuard(line.date)) return
    const reason = prompt(`Reverse ${line.type} ${line.slipNo || ''} (${money(line.credit || line.debit)})?\nReason:`)
    if (reason === null) return
    if (line.source === 'payment') { payments.update(line.refId, { reversed: true }); log('PAYMENT_REVERSE', `${line.slipNo} ${money(line.credit)} reversed · ${reason}`, by, line.refId) }
    else { ledger.update(line.refId, { reversed: true }); log('LEDGER_REVERSE', `${line.type} ${money(line.debit || line.credit)} reversed · ${reason}`, by, line.refId) }
    show('Reversed ✓')
  }
  const openEdit = (line) => { const p = payments.list.find(x => x.id === line.refId); if (p) setEditPay(p) }
  const saveEditPay = (patch, reason) => {
    const p = editPay
    payments.update(p.id, { ...patch, date: patch.paymentDate, note: patch.remark })
    log('PAYMENT_EDIT', `${p.paymentSlipNo}: ${money(p.amount)}→${money(patch.amount)} · ${p.paymentMode}→${patch.paymentMode}${reason ? ' · ' + reason : ''}`, by, p.id)
    show('Payment updated ✓'); setEditPay(null)
  }

  // ---- exports -------------------------------------------------------------
  const exportLedgerPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(15); doc.text('UNICO — Contractor Ledger', 14, 15)
    doc.setFontSize(10); doc.text(`${contractor}   ·   ${periodLabel}`, 14, 22)
    const body = [
      [fmtDate(periodFrom), '', 'Opening Balance', 'Brought forward', '', '', '', money(led.opening)],
      ...led.lines.map(l => [fmtDate(l.date), l.slipNo, l.type, l.description, l.paidBy, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '', money(l.runningBalance)]),
    ]
    autoTable(doc, {
      startY: 27, head: [['Date', 'Slip No', 'Type', 'Remark', 'Paid By', 'Debit', 'Credit', 'Balance']], body,
      foot: [['', '', 'Closing', '', '', money(led.summary.production), money(led.summary.payment + led.summary.advance), money(led.closing)]],
      theme: 'grid', headStyles: { fillColor: [13, 148, 136] }, footStyles: { fillColor: [241, 245, 249], textColor: 20 },
      styles: { fontSize: 8 }, columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    })
    doc.save(`ledger-${contractor}-${periodLabel}.pdf`)
  }

  const exportSettlementPDF = () => {
    const s = led.summary
    const doc = new jsPDF()
    doc.setFontSize(15); doc.text('UNICO — Monthly Settlement Statement', 14, 16)
    doc.setFontSize(10); doc.text(`Contractor: ${contractor}`, 14, 25); doc.text(`Period: ${periodLabel}`, 14, 31)
    autoTable(doc, {
      startY: 37, theme: 'plain', styles: { fontSize: 11 }, columnStyles: { 1: { halign: 'right' } },
      body: [
        ['Opening balance', money(s.opening)],
        ['Add: Production payable', money(s.production)],
        ['Less: Payments', '- ' + money(s.payment)],
        ['Less: Advances', '- ' + money(s.advance)],
        ['Adjustments', signed(s.adjustment)],
      ],
      foot: [['Closing balance', balLabel(led.closing)]],
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    })
    let y = doc.lastAutoTable.finalY + 28
    doc.setFontSize(10); doc.line(14, y, 80, y); doc.line(120, y, 186, y)
    doc.text('Contractor signature', 14, y + 6); doc.text('Owner signature', 120, y + 6)
    doc.save(`settlement-${contractor}-${periodLabel}.pdf`)
  }

  const entryButtons = owner ? ENTRY_TYPES : ENTRY_TYPES.filter(t => t.key === 'payment')

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div><FieldLabel>Contractor</FieldLabel>
          <Select className="mt-1" value={contractor} onChange={e => setContractor(e.target.value)} options={welders.list.map(w => ({ value: w.name, label: w.name }))} /></div>
        <div className="flex gap-2">
          {[['month', 'Month'], ['range', 'Date range']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`flex-1 py-2 rounded-xl font-bold text-sm ${mode === k ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {mode === 'month'
          ? <input type="month" value={month} min={mgrMinMonth} max={mgrMaxMonth} onChange={e => setMonth(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold" />
          : <div className="grid grid-cols-2 gap-2">
              <div><FieldLabel>From</FieldLabel><DateInput className="mt-1" value={from} min={mgrMinDate} max={mgrMaxDate} onChange={e => setFrom(e.target.value)} /></div>
              <div><FieldLabel>To</FieldLabel><DateInput className="mt-1" value={to} min={mgrMinDate} max={mgrMaxDate} onChange={e => setTo(e.target.value)} /></div>
            </div>}
        {!owner && <p className="text-[10px] text-slate-400">Manager view: this month + last {MANAGER_HISTORY_MONTHS} months</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="neutral" onClick={exportLedgerPDF}>📄 Ledger PDF</Button>
          <Button size="sm" variant="neutral" onClick={exportSettlementPDF}>🧾 Settlement PDF</Button>
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Sum label="Opening" v={led.opening} />
          <Sum label="Production" v={led.summary.production} tone="text-amber-700" />
          <Sum label="Paid" v={led.summary.payment} tone="text-emerald-600" />
          <Sum label="Advance" v={led.summary.advance} tone="text-emerald-600" />
          <Sum label="Adjust" v={led.summary.adjustment} />
          <Sum label="Closing" v={led.closing} tone={led.closing > 0 ? 'text-red-600' : 'text-slate-700'} strong />
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">Closing: <b>{balLabel(led.closing)}</b></p>
      </Card>

      <p className="text-center text-[11px] text-slate-400">This is a read-only running ledger. Add advances & payments in the <b>Hisab</b> screen. Adjustments: use ＋ below (owner).</p>
      {owner && (
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ENTRY_TYPES.filter(t => t.key === 'adjustment' || t.key === 'opening').map(t => (
              <button key={t.key} onClick={() => setForm({ type: t.key, dir: t.dir })}
                className="py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold active:scale-95">+ {t.label}</button>
            ))}
          </div>
        </Card>
      )}

      {/* Ledger table */}
      <Card className="p-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-1 pr-2">Date</th><th className="pr-2">Slip No</th><th className="pr-2">Type</th><th className="pr-2">Remark</th>
              <th className="pr-2">Paid By</th><th className="pr-2 text-right">Debit</th><th className="pr-2 text-right">Credit</th><th className="text-right">Balance</th>{owner && <th></th>}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100 bg-slate-50">
              <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(periodFrom)}</td><td className="pr-2"></td>
              <td className="pr-2 font-semibold text-slate-500" colSpan={4}>Opening Balance (b/f)</td>
              <td></td><td className="text-right font-mono font-bold">{money(led.opening)}</td>{owner && <td></td>}
            </tr>
            {led.lines.map((l, i) => (
              <tr key={i} className={`border-t border-slate-100 ${l.reversed ? 'text-slate-300 line-through' : ''}`}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="pr-2 font-mono whitespace-nowrap">{l.slipNo}</td>
                <td className="pr-2"><TypeBadge type={l.type} /></td>
                <td className="pr-2 text-slate-600">{l.description}</td>
                <td className="pr-2 text-slate-500 whitespace-nowrap">{l.paidBy}</td>
                <td className="pr-2 text-right font-mono text-amber-700">{l.debit ? money(l.debit) : ''}</td>
                <td className="pr-2 text-right font-mono text-emerald-600">{l.credit ? money(l.credit) : ''}</td>
                <td className="text-right font-mono font-semibold">{money(l.runningBalance)}</td>
                {owner && (
                  <td className="pl-1 whitespace-nowrap">
                    {!l.reversed && l.source === 'payment' && <button onClick={() => openEdit(l)} className="text-blue-600 font-bold px-1" title="Edit">✎</button>}
                    {!l.reversed && (l.source === 'payment' || l.source === 'ledger') && <button onClick={() => reverseLine(l)} className="text-red-500 font-bold px-1" title="Reverse">↩</button>}
                  </td>
                )}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-bold">
              <td className="py-1.5 pr-2" colSpan={7}>Closing Balance</td>
              <td className="text-right font-mono">{money(led.closing)}</td>{owner && <td></td>}
            </tr>
          </tbody>
        </table>
        {led.lines.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No entries in this period.</p>}
        <p className="text-[11px] text-slate-400 mt-2">Production = Debit (owed↑) · Payment/Advance = Credit (owed↓). Reversed entries stay in history (struck-through) and never affect the balance.</p>
      </Card>

      {form && <EntryForm form={form} role={myRole} onSave={saveEntry} onCancel={() => setForm(null)} />}
      {editPay && <EditPaymentForm payment={editPay} onSave={saveEditPay} onCancel={() => setEditPay(null)} />}
    </div>
  )
}

function Sum({ label, v, tone = 'text-slate-700', strong }) {
  return (
    <div className="bg-slate-50 rounded-xl py-2">
      <div className={`font-bold ${tone} ${strong ? 'text-base' : 'text-sm'}`}>{money(v)}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}

function TypeBadge({ type }) {
  const c = { Production: 'bg-amber-100 text-amber-700', Payment: 'bg-emerald-100 text-emerald-700', Advance: 'bg-blue-100 text-blue-700', Adjustment: 'bg-violet-100 text-violet-700', 'Opening Balance': 'bg-slate-100 text-slate-600' }[type] || 'bg-slate-100 text-slate-600'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${c}`}>{type}</span>
}

function EntryForm({ form, role, onSave, onCancel }) {
  const t = ENTRY_TYPES.find(x => x.key === form.type)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [payMode, setPayMode] = useState('Cash')
  const [remark, setRemark] = useState('')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState(form.dir)
  const isPayment = form.type === 'payment'
  const adjustable = form.type === 'adjustment' || form.type === 'opening'
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={onCancel}>
      <Card className="p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-slate-800">Add {t.label} <span className="text-xs font-normal text-slate-400">· as {role}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Amount ₹</FieldLabel><NumberInput className="mt-1 !py-2" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1 !py-2" value={date} onChange={e => setDate(e.target.value)} /></div>
          {isPayment && <div><FieldLabel>Mode</FieldLabel><Select className="mt-1" value={payMode} onChange={e => setPayMode(e.target.value)} options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} /></div>}
          <div><FieldLabel>Your name</FieldLabel><TextInput className="mt-1" placeholder="(optional)" value={name} onChange={e => setName(e.target.value)} /></div>
        </div>
        {adjustable && (
          <div>
            <FieldLabel>Effect on balance</FieldLabel>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setDirection('debit')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${direction === 'debit' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>Increase owed (＋)</button>
              <button onClick={() => setDirection('credit')} className={`flex-1 py-2 rounded-xl text-sm font-bold ${direction === 'credit' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Decrease owed (－)</button>
            </div>
          </div>
        )}
        <TextInput placeholder={isPayment ? 'Remark (e.g. June welding payment)' : 'Note / reason'} value={remark} onChange={e => setRemark(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="success" className="flex-1" onClick={() => onSave(form.type, { amount, date, mode: payMode, remark, name, direction })}>Save</Button>
        </div>
      </Card>
    </div>
  )
}

function EditPaymentForm({ payment, onSave, onCancel }) {
  const [amount, setAmount] = useState(String(payment.amount ?? ''))
  const [paymentMode, setPaymentMode] = useState(payment.paymentMode || 'Cash')
  const [remark, setRemark] = useState(payment.remark || payment.note || '')
  const [paymentDate, setPaymentDate] = useState(payment.paymentDate || payment.date || todayStr())
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={onCancel}>
      <Card className="p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-slate-800">Edit Payment <span className="font-mono text-xs text-slate-400">{payment.paymentSlipNo}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Amount ₹</FieldLabel><NumberInput className="mt-1 !py-2" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1 !py-2" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
          <div><FieldLabel>Mode</FieldLabel><Select className="mt-1" value={paymentMode} onChange={e => setPaymentMode(e.target.value)} options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} /></div>
        </div>
        <TextInput placeholder="Remark" value={remark} onChange={e => setRemark(e.target.value)} />
        <TextInput placeholder="Reason for change (audit log)" value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1 !bg-emerald-600" onClick={() => onSave({ amount: Number(amount) || 0, paymentMode, remark, paymentDate }, reason)}>Save change</Button>
        </div>
      </Card>
    </div>
  )
}
