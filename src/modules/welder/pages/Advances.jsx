/**
 * Advances — OWNER ONLY. Manage money paid to welders (Payments + Advances):
 *   • Modify amount / date / mode / remark
 *   • Delete an entry made by mistake (admin-password gated)
 *   • Reassign (interchange) the contractor if the name was entered wrong
 *   • Per-contractor summary: paid (period) + outstanding (all-time) + 1-tap Settle
 * The Ledger page records new advances/payments; this page fixes & settles them.
 * Every action is written to the audit log.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, NumberInput, Select, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { PAYMENT_MODES, ADMIN_PASSWORD } from '../config'
import { buildLedger, nextPaymentSlip, newPayment } from '../logic/pay'

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))

// Unify a payment doc and a ledger-advance doc into one display row.
const fromPayment = (p) => ({ source: 'payment', id: p.id, contractor: p.contractor || '', amount: Number(p.amount) || 0, date: p.paymentDate || p.date || '', mode: p.paymentMode || 'Cash', remark: p.remark || p.note || '', slip: p.paymentSlipNo || '', reversed: !!p.reversed })
const fromLedger = (l) => ({ source: 'ledger', id: l.id, contractor: l.contractor || '', amount: Number(l.amount) || 0, date: l.date || '', mode: '', remark: l.note || '', slip: '', reversed: !!l.reversed })

export default function Advances({ owner = false, by = 'owner' }) {
  const { dispatches, rates, payments, ledger, welders, log } = useWelder()
  const { msg, show } = useToast()
  const [filter, setFilter] = useState('')          // contractor name or '' = all
  const [periodMode, setPeriodMode] = useState('all')   // 'all' | 'month'
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [edit, setEdit] = useState(null)            // row being edited
  const role = owner ? 'Owner' : 'Manager'

  const rows = useMemo(() => {
    const inPeriod = (date) => periodMode === 'all' || (date || '').slice(0, 7) === month
    const pays = payments.list.map(fromPayment)
    const advs = ledger.list.filter(l => l.type === 'advance').map(fromLedger)
    return [...pays, ...advs]
      .filter(r => !filter || r.contractor === filter)
      .filter(r => inPeriod(r.date))
      .sort((x, y) => (y.date || '').localeCompare(x.date || ''))
  }, [payments.list, ledger.list, filter, periodMode, month])

  // Per-contractor summary (only when one contractor is selected).
  const summary = useMemo(() => {
    if (!filter) return null
    const paidPeriod = rows.filter(r => !r.reversed).reduce((s, r) => s + r.amount, 0)
    const led = buildLedger(dispatches.list, rates.list, payments.list, ledger.list, filter, '', todayStr())
    return { paidPeriod, outstanding: led.closing }
  }, [filter, rows, dispatches.list, rates.list, payments.list, ledger.list])

  const coll = (src) => (src === 'payment' ? payments : ledger)

  const reassign = (r, name) => {
    if (!name || name === r.contractor) return
    if (!confirm(`Move ${money(r.amount)} from "${r.contractor}" to "${name}"?`)) return
    coll(r.source).update(r.id, { contractor: name })
    log('ADV_REASSIGN', `${r.slip || r.source} ${money(r.amount)}: ${r.contractor} → ${name} (${role})`, by)
    show('Reassigned ✓')
  }

  const del = (r) => {
    if (!confirm(`Delete this ${r.source === 'payment' ? 'payment' : 'advance'} of ${money(r.amount)} for ${r.contractor}? This cannot be undone.`)) return
    const pass = prompt('Enter admin password to permanently delete:')
    if (pass === null) return
    if (pass !== ADMIN_PASSWORD) return show('Wrong admin password — not deleted', 2500)
    coll(r.source).remove(r.id)
    log('ADV_DELETE', `${r.slip || r.source} ${money(r.amount)} · ${r.contractor} deleted (${role})`, by)
    show('Deleted ✓')
  }

  const saveEdit = (patch) => {
    const r = edit
    if (r.source === 'payment') coll('payment').update(r.id, { amount: patch.amount, paymentDate: patch.date, date: patch.date, paymentMode: patch.mode, remark: patch.remark, note: patch.remark })
    else coll('ledger').update(r.id, { amount: patch.amount, date: patch.date, note: patch.remark })
    log('ADV_EDIT', `${r.slip || r.source} ${money(r.amount)}→${money(patch.amount)} · ${r.contractor} (${role})`, by)
    show('Updated ✓'); setEdit(null)
  }

  const settle = () => {
    if (!filter || !summary || summary.outstanding <= 0) return
    const amt = Math.round(summary.outstanding)
    if (!confirm(`Record a settlement payment of ${money(amt)} to ${filter}? This clears the outstanding balance.`)) return
    const slip = nextPaymentSlip(payments.list)
    payments.insert(newPayment({ slip, contractor: filter, amount: amt, date: todayStr(), mode: 'Cash', remark: 'Settlement', paidByUser: '', paidByRole: role }))
    log('PAYMENT', `${slip} · ${filter} ${money(amt)} settlement (${role})`, by, slip)
    show(`Settled ${money(amt)} → ${slip} ✓`)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Card className="p-4 space-y-3">
        <div><FieldLabel>Contractor</FieldLabel>
          <Select className="mt-1" value={filter} onChange={e => setFilter(e.target.value)}
            options={[{ value: '', label: 'All contractors' }, ...welders.list.map(w => ({ value: w.name, label: w.name }))]} /></div>
        <div className="flex gap-2">
          {[['all', 'All time'], ['month', 'Month']].map(([k, l]) => (
            <button key={k} onClick={() => setPeriodMode(k)} className={`flex-1 py-2 rounded-xl font-bold text-sm ${periodMode === k ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {periodMode === 'month' && (
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold" />
        )}
        <p className="text-[11px] text-slate-400">Fix money paid to welders — edit amount/date, delete a wrong entry (admin password), or move it to the correct contractor (change the Contractor dropdown in the row).</p>
      </Card>

      {/* Per-contractor summary + Settle */}
      {summary && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-slate-800">{filter}</div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${summary.outstanding > 0 ? 'bg-red-100 text-red-700' : summary.outstanding < 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {summary.outstanding > 0 ? `${money(summary.outstanding)} outstanding` : summary.outstanding < 0 ? `${money(-summary.outstanding)} advance/credit` : 'Settled'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl py-2"><div className="font-bold text-emerald-600">{money(summary.paidPeriod)}</div><div className="text-[10px] text-slate-400">Paid ({periodMode === 'all' ? 'all time' : month})</div></div>
            <div className="bg-slate-50 rounded-xl py-2"><div className={`font-bold ${summary.outstanding > 0 ? 'text-red-600' : 'text-slate-700'}`}>{money(Math.abs(summary.outstanding))}</div><div className="text-[10px] text-slate-400">{summary.outstanding < 0 ? 'Advance/credit' : 'Outstanding (all-time)'}</div></div>
          </div>
          {summary.outstanding > 0 && (
            <Button size="sm" variant="success" className="w-full mt-3" onClick={settle}>💸 Settle {money(summary.outstanding)} (record payment)</Button>
          )}
        </Card>
      )}

      <Card className="p-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left">
              <th className="py-1 pr-2">Date</th><th className="pr-2">Type</th><th className="pr-2">Contractor</th>
              <th className="pr-2 text-right">Amount</th><th className="pr-2">Remark</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.source + r.id} className={`border-t border-slate-100 ${r.reversed ? 'text-slate-300 line-through' : ''}`}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="pr-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${r.source === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{r.source === 'payment' ? 'Payment' : 'Advance'}</span></td>
                <td className="pr-2">
                  <Select value={r.contractor} onChange={e => reassign(r, e.target.value)}
                    options={welders.list.map(w => ({ value: w.name, label: w.name }))} className="!py-1 !px-1.5 text-xs" />
                </td>
                <td className="pr-2 text-right font-mono font-semibold whitespace-nowrap">{money(r.amount)}</td>
                <td className="pr-2 text-slate-500">{r.remark}{r.slip ? <span className="text-slate-300 font-mono"> · {r.slip}</span> : ''}</td>
                <td className="pl-1 whitespace-nowrap">
                  {!r.reversed && <button onClick={() => setEdit(r)} className="text-blue-600 font-bold px-1" title="Edit">✎</button>}
                  <button onClick={() => del(r)} className="text-red-500 font-bold px-1" title="Delete">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No advances or payments{periodMode === 'month' ? ' in ' + month : ''}.</p>}
        <p className="text-[11px] text-slate-400 mt-2">Changing the Contractor dropdown moves the entry to that welder. Reversed entries show struck-through. All changes are logged.</p>
      </Card>

      {edit && <EditForm row={edit} onSave={saveEdit} onCancel={() => setEdit(null)} />}
    </div>
  )
}

function EditForm({ row, onSave, onCancel }) {
  const [amount, setAmount] = useState(String(row.amount ?? ''))
  const [date, setDate] = useState(row.date || todayStr())
  const [mode, setMode] = useState(row.mode || 'Cash')
  const [remark, setRemark] = useState(row.remark || '')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={onCancel}>
      <Card className="p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-slate-800">Edit {row.source === 'payment' ? 'Payment' : 'Advance'} <span className="text-xs font-normal text-slate-400">· {row.contractor}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Amount ₹</FieldLabel><NumberInput className="mt-1 !py-2" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1 !py-2" value={date} onChange={e => setDate(e.target.value)} /></div>
          {row.source === 'payment' && <div><FieldLabel>Mode</FieldLabel><Select className="mt-1" value={mode} onChange={e => setMode(e.target.value)} options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} /></div>}
        </div>
        <TextInput placeholder="Remark" value={remark} onChange={e => setRemark(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1 !bg-emerald-600" onClick={() => onSave({ amount: Number(amount) || 0, date, mode, remark })}>Save</Button>
        </div>
      </Card>
    </div>
  )
}
