/**
 * Contractor Payment (owner edit · User1 view) — auto piece-rate payouts.
 * Owner sets per-product rates (per process, optionally per contractor) and
 * records payments; owner + User1 see the daily/monthly statement. Welders
 * never see this page. All amounts are DERIVED from dispatches × rates.
 *
 * Filters (requirement #3): Month or any single Day, by contractor, product
 * and finish type. Export each contractor as PDF, or all as Excel (CSV).
 * Rates are future-proofed (requirement #7): pick a process (welding today;
 * plating/powder/assembly/packing/dispatch ready for later) and, optionally,
 * a single contractor for a special rate.
 */
import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, FieldLabel, NumberInput, Select, TextInput, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { FINISHES, PROCESSES, processLabel, PAYMENT_MODES, MANAGER_HISTORY_MONTHS, ADMIN_PASSWORD } from '../config'

/** First selectable date for a Manager (owner has no limit): first day of the
 *  month MANAGER_HISTORY_MONTHS back. */
function managerFloorDate() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - MANAGER_HISTORY_MONTHS)
  return d.toISOString().slice(0, 10)
}
import { rateOn, currentOpenRate, dayBefore, rateTimeline, isRateActiveNow, statement, statementsCSV, today as todayCalc, nextPaymentSlip, newPayment, buildLedger, lockedOn } from '../logic/pay'

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))
// Piece RATES may carry up to 2 decimals (e.g. ₹8.50, ₹13.25). Money TOTALS stay whole-rupee.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const rate$ = (n) => '₹' + round2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const rProductName = (r) => r.productName || r.product || '' // tolerate legacy rate records

export default function ContractorPay({ owner = false, by = 'owner' }) {
  const { dispatches, products, welders, rates, payments, ledger, settlements, log } = useWelder()
  const { msg, show } = useToast()

  // Period: month view (default) or a single day.
  const [mode, setMode] = useState('month')        // 'month' | 'day'
  const [month, setMonth] = useState(todayStr().slice(0, 7)) // YYYY-MM
  const [day, setDay] = useState(todayStr())
  // Filters.
  const [filter, setFilter] = useState('')         // contractor name or '' = all
  const [prodFilter, setProdFilter] = useState('') // product or '' = all
  const [finishFilter, setFinishFilter] = useState('') // finish key or '' = all
  // Rates panel (owner).
  const [showRates, setShowRates] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [rateProcess, setRateProcess] = useState('welding')
  const [rateContractor, setRateContractor] = useState('') // '' = all contractors
  const [effFrom, setEffFrom] = useState(todayStr())       // new rate starts this date (today or future)
  const [editRate, setEditRate] = useState(null)   // rate record being edited (fix date/value)
  const [pay, setPay] = useState(null)             // {contractor}
  const [finalizing, setFinalizing] = useState(null) // contractor name when finalizing hisab

  const mgrMinDate = owner ? undefined : managerFloorDate()
  const mgrMinMonth = owner ? undefined : managerFloorDate().slice(0, 7)
  const mgrMaxDate = owner ? undefined : todayStr()                 // no future for manager
  const mgrMaxMonth = owner ? undefined : todayStr().slice(0, 7)
  const from = mode === 'day' ? day : `${month}-01`
  const to   = mode === 'day' ? day : `${month}-31`
  const periodLabel = mode === 'day' ? fmtDate(day) : month
  const periodShort = mode === 'day' ? 'Day' : 'Month'
  // Material/reference products (paid via the material/dispatch flow) are excluded from hisab.
  const refProducts = useMemo(() => new Set(products.list.filter(p => p.referenceOnly).map(p => p.name)), [products.list])
  const opts = useMemo(() => ({ product: prodFilter, finish: finishFilter, exclude: refProducts }), [prodFilter, finishFilter, refProducts])

  const list = welders.list.filter(w => !filter || w.name === filter)
  const sortedProducts = useMemo(() => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [products.list])

  // Rate in effect for a product at the chosen "effective from" date (what the
  // owner is about to supersede). Used as the input's shown value.
  const effectiveRate = (product) => rateOn(rates.list, product, rateContractor, effFrom, rateProcess)

  /**
   * HISTORICAL rate change — never overwrites. Closes the rate currently in
   * effect (sets effectiveTo = day before the new start) and inserts a new
   * record. Supports future-dated (scheduled) changes via `effFrom`.
   */
  const applyRateChange = (product, productId, value) => {
    const v = round2(value)   // allow up to 2 decimals (₹8.50), block longer fractions
    if (v === effectiveRate(product)) return // no real change → don't create a record
    const cur = currentOpenRate(rates.list, product, rateContractor, rateProcess, effFrom)
    if (cur) {
      const to = dayBefore(effFrom)
      // If the new start is after the old start, close it cleanly; otherwise the
      // new rate would start before/at the old one, so retire the old record.
      if (!cur.effectiveFrom || cur.effectiveFrom <= to) rates.update(cur.id, { effectiveTo: to })
      else rates.update(cur.id, { isActive: false })
    }
    rates.insert({
      process: rateProcess, productId: productId || '', productName: product, contractor: rateContractor,
      rate: v, effectiveFrom: effFrom, effectiveTo: '', isActive: true, createdBy: by,
    })
    log('RATE', `[${processLabel(rateProcess)}] ${product}${rateContractor ? ' · ' + rateContractor : ''} = ₹${v}/pc from ${effFrom}`, by)
    show(effFrom > todayStr() ? `Scheduled ₹${v} from ${fmtDate(effFrom)} ✓` : 'Rate updated ✓')
  }

  const deactivateRate = (r) => {
    if (!confirm(`Deactivate this rate (${rProductName(r)} · ₹${r.rate})? It stays in history but stops applying.`)) return
    rates.update(r.id, { isActive: false })
    log('RATE_OFF', `${rProductName(r)}${r.contractor ? ' · ' + r.contractor : ''} ₹${r.rate} deactivated`, by)
    show('Rate deactivated ✓')
  }

  // Fix a saved rate's PERIOD (effective-from / to) or value — e.g. a rate
  // recorded "from 14 June" by mistake, change it to start 1 May. Logged.
  const saveRateEdit = ({ effectiveFrom, effectiveTo, rate }) => {
    const r = editRate
    const v = round2(rate)
    rates.update(r.id, { effectiveFrom, effectiveTo: effectiveTo || '', rate: v, isActive: true })
    log('RATE_EDIT', `${rProductName(r)}${r.contractor ? ' · ' + r.contractor : ''}: was ₹${r.rate} from ${r.effectiveFrom || '—'} → ₹${v} from ${effectiveFrom}${effectiveTo ? ' to ' + effectiveTo : ''}`, by, r.id)
    setEditRate(null); show('Rate period updated ✓')
  }

  // Permanently remove a wrong rate (owner-only, reason required, logged).
  const deleteRate = (r) => {
    const reason = prompt(`PERMANENTLY DELETE this rate?\n${rProductName(r)}${r.contractor ? ' · ' + r.contractor : ''} · ₹${r.rate} from ${r.effectiveFrom || '—'}\nThis cannot be undone. Reason (required):`)
    if (reason === null) return
    if (!reason.trim()) return show('Reason required — not deleted', 2500)
    log('RATE_DELETE', `${rProductName(r)}${r.contractor ? ' · ' + r.contractor : ''} ₹${r.rate} from ${r.effectiveFrom || '—'} deleted · reason: ${reason.trim()}`, by, r.id)
    rates.remove(r.id); show('Rate deleted ✓')
  }

  const timeline = useMemo(() => {
    const all = rateTimeline(rates.list, rateProcess)
    return rateContractor ? all.filter(r => (r.contractor || '') === rateContractor || !r.contractor) : all
  }, [rates.list, rateProcess, rateContractor])

  const statements = useMemo(
    () => list.map(w => statement(dispatches.list, rates.list, payments.list, w.name, from, to, opts)),
    [list, dispatches.list, rates.list, payments.list, from, to, opts])

  const recordPayment = (contractor, amount, date, mode, remark, name) => {
    const v = Number(amount) || 0
    if (v <= 0) return show('Enter an amount', 2000)
    const slip = nextPaymentSlip(payments.list)
    const role = owner ? 'Owner' : 'Manager'
    payments.insert(newPayment({ slip, contractor, amount: v, date, mode, remark, paidByUser: name, paidByRole: role }))
    log('PAYMENT', `${slip} · ${contractor} ${money(v)} (${mode || 'Cash'})${name ? ' · ' + name : ''} (${role})`, by, slip)
    show(`Payment ${slip} recorded ✓`); setPay(null)
  }

  const exportPDF = (st) => {
    const doc = new jsPDF()
    doc.setFontSize(15); doc.text('UNICO — Contractor Statement', 14, 16)
    doc.setFontSize(10); doc.text(`${st.contractor}   ·   ${periodLabel}`, 14, 24)
    autoTable(doc, {
      startY: 30, head: [['Product', 'Pieces', 'Rate/pc', 'Amount']],
      body: st.products.map(p => [p.product, fmtNum(p.qty), p.mixed ? 'mixed' : rate$(p.rate), money(p.amount)]),
      foot: [['Total', fmtNum(st.totalPieces), '', money(st.payable)]],
      theme: 'grid', headStyles: { fillColor: [217, 119, 6] }, footStyles: { fillColor: [241, 245, 249], textColor: 20 },
    })
    let y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(11)
    doc.text(`Payable (${periodShort.toLowerCase()}): ${money(st.payable)}`, 14, y); y += 7
    doc.text(`Paid (${periodShort.toLowerCase()}): ${money(st.paid)}`, 14, y); y += 7
    doc.text(`Balance (${periodShort.toLowerCase()}): ${money(st.balance)}`, 14, y); y += 7
    doc.text(`Outstanding (all-time): ${money(st.outstanding)}`, 14, y)
    doc.save(`statement-${st.contractor}-${periodLabel}.pdf`)
  }

  // Full month HISAB: opening b/f + piece production + material(dispatch) + advances/payments → closing.
  const generateHisab = (contractor) => {
    const led = buildLedger(dispatches.list, rates.list, payments.list, ledger.list, contractor, from, to, refProducts)
    const earned = led.summary.production + led.lines.filter(l => l.type === 'Material (dispatch)').reduce((s, l) => s + l.debit, 0)
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('UNICO — Welder Hisab', 14, 16)
    doc.setFontSize(11); doc.text(`${contractor}`, 14, 24); doc.text(`Month: ${periodLabel}`, 14, 30)
    doc.setFontSize(10); doc.text(`Opening balance b/f: ${money(led.opening)}`, 14, 37)
    autoTable(doc, {
      startY: 41,
      head: [['Date', 'Type', 'Details', 'Earned', 'Given', 'Balance']],
      body: led.lines.map(l => [fmtDate(l.date), l.type, l.description, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '', money(l.runningBalance)]),
      foot: [['', '', 'Closing balance', money(earned), money(led.summary.payment + led.summary.advance), money(led.closing)]],
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [217, 119, 6] }, footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    })
    let y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(11)
    const closing = led.closing
    doc.text(`Total earned (piece + material): ${money(earned)}`, 14, y); y += 7
    doc.text(`Advances + payments: ${money(led.summary.advance + led.summary.payment)}`, 14, y); y += 7
    doc.setFont(undefined, 'bold')
    doc.text(closing >= 0 ? `Net PAYABLE to ${contractor}: ${money(closing)}` : `Advance carried forward: ${money(-closing)}`, 14, y); y += 12
    doc.setFont(undefined, 'normal'); doc.setFontSize(9)
    doc.text('Welder sign: ____________________', 14, y); doc.text('Owner sign: ____________________', 110, y)
    doc.save(`hisab-${contractor}-${periodLabel}.pdf`)
    show('Hisab PDF generated ✓')
  }

  // Cut-off for a settlement = today if settling the current month, else month-end.
  const settleCutoff = mode === 'day' ? day : (month >= todayStr().slice(0, 7) ? todayStr() : `${month}-31`)

  // Live preview of a welder's settlement (running balance up to the cut-off).
  const settlePreview = (contractor) => {
    const led = buildLedger(dispatches.list, rates.list, payments.list, ledger.list, contractor, '', settleCutoff, refProducts)
    const earned = led.lines.filter(l => l.type === 'Production' || l.type === 'Material (dispatch)').reduce((s, l) => s + l.debit, 0)
    const advances = led.lines.filter(l => l.type === 'Advance' || l.type === 'Opening Balance').reduce((s, l) => s + l.credit, 0)
    const paid = led.lines.filter(l => l.type === 'Payment').reduce((s, l) => s + l.credit, 0)
    return { cutoff: settleCutoff, earned, advances, paid, net: led.closing }
  }

  const doFinalize = (contractor, dayPay) => {
    const already = settlements.list.find(s => s.welder === contractor && s.month === (mode === 'day' ? day.slice(0, 7) : month) && s.locked !== false)
    if (already) return show('That month is already finalized for this welder', 2500)
    const p = settlePreview(contractor)
    const dp = Number(dayPay) || 0
    if (dp > 0) {
      const slip = nextPaymentSlip(payments.list)
      payments.insert(newPayment({ slip, contractor, amount: dp, date: p.cutoff, mode: 'Cash', remark: 'Hisab settlement payment', paidByUser: '', paidByRole: myRole }))
      log('PAYMENT', `${slip} · ${contractor} ${money(dp)} (settlement)`, by, slip)
    }
    const net = p.net - dp // dp reduces what we owe (credit)
    settlements.insert({
      welder: contractor, month: mode === 'day' ? day.slice(0, 7) : month, periodFrom: from, periodTo: p.cutoff,
      cutoffDate: p.cutoff, opening: 0, earned: p.earned, advances: p.advances, payments: p.paid + dp,
      dayPayment: dp, net, finalizedBy: by, locked: true,
    })
    log('SETTLEMENT_FINALIZE', `${contractor} ${periodLabel} · earned ${money(p.earned)} − adv/paid ${money(p.advances + p.paid + dp)} = ${money(net)} (locked ≤ ${p.cutoff})`, by)
    show('Hisab finalized & locked ✓')
    setFinalizing(null)
    generateHisab(contractor)
  }

  const reopenSettlement = (s) => {
    const pwd = prompt(`Reopen ${s.welder}'s ${s.month} hisab? This unlocks its entries for editing.\nEnter admin password:`)
    if (pwd === null) return
    if (pwd !== ADMIN_PASSWORD) return show('Wrong password — not reopened', 2500)
    settlements.update(s.id, { locked: false })
    log('SETTLEMENT_REOPEN', `${s.welder} ${s.month} reopened (cutoff ${s.cutoffDate})`, by)
    show('Hisab reopened — entries editable again')
  }

  const exportExcel = () => {
    const csv = statementsCSV(statements, periodLabel)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `contractor-statement-${periodLabel}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    show('Excel file downloaded ✓')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      {/* Period + filters */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          {[['month', 'Monthly'], ['day', 'Daily']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm ${mode === k ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{mode === 'day' ? 'Date' : 'Month'}</FieldLabel>
            {mode === 'day'
              ? <DateInput className="mt-1" value={day} min={mgrMinDate} max={mgrMaxDate} onChange={e => setDay(e.target.value)} />
              : <input type="month" value={month} min={mgrMinMonth} max={mgrMaxMonth} onChange={e => setMonth(e.target.value)} className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold" />}
            {!owner && <p className="text-[10px] text-slate-400 mt-1">Manager view: this month + last {MANAGER_HISTORY_MONTHS} months</p>}
          </div>
          <div><FieldLabel>Contractor</FieldLabel>
            <Select className="mt-1" value={filter} onChange={e => setFilter(e.target.value)} options={[{ value: '', label: 'All' }, ...welders.list.map(w => ({ value: w.name, label: w.name }))]} /></div>
          <div><FieldLabel>Product</FieldLabel>
            <Select className="mt-1" value={prodFilter} onChange={e => setProdFilter(e.target.value)} options={[{ value: '', label: 'All products' }, ...sortedProducts.map(p => ({ value: p.name, label: p.name }))]} /></div>
          <div><FieldLabel>Finish</FieldLabel>
            <Select className="mt-1" value={finishFilter} onChange={e => setFinishFilter(e.target.value)} options={[{ value: '', label: 'All finishes' }, ...FINISHES.map(f => ({ value: f.key, label: f.label }))]} /></div>
        </div>
        <Button size="sm" variant="neutral" className="w-full" onClick={exportExcel}>⬇ Export Excel (all contractors)</Button>
      </Card>

      {/* Rates + Rate History — OWNER ONLY (managers don't see rates or history). */}
      {owner && <>
      <Card className="p-4">
        <button onClick={() => setShowRates(s => !s)} className="w-full flex items-center justify-between font-bold text-slate-700">
          <span>💰 Piece Rates (time-based)</span><span className="text-slate-400">{showRates ? '▲' : '▼'}</span>
        </button>
        {showRates && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><FieldLabel>Process</FieldLabel>
                <Select className="mt-1" value={rateProcess} onChange={e => setRateProcess(e.target.value)} options={PROCESSES.map(p => ({ value: p.key, label: p.label }))} /></div>
              <div><FieldLabel>Rate for</FieldLabel>
                <Select className="mt-1" value={rateContractor} onChange={e => setRateContractor(e.target.value)} options={[{ value: '', label: 'All contractors' }, ...welders.list.map(w => ({ value: w.name, label: w.name }))]} /></div>
            </div>
            {owner && (
              <div>
                <FieldLabel>Effective from (you can BACKDATE — pick a past date like 1 May)</FieldLabel>
                <DateInput className="mt-1" value={effFrom} onChange={e => setEffFrom(e.target.value)} />
                <p className="text-[11px] text-slate-400 mt-1">Pick a <b>past</b> date to backdate, today to apply now, or a future date to <b>schedule</b>. The current rate auto-closes the day before. Old rates are kept — past statements keep their old rate. To fix a rate you already saved, use ✏️ in Rate History below.</p>
              </div>
            )}
            {rateContractor && <p className="text-[11px] text-amber-600">Special rate for <b>{rateContractor}</b> — overrides the “All contractors” rate.</p>}
            {rateProcess !== 'welding' && <p className="text-[11px] text-slate-400">Rates saved here apply when the {processLabel(rateProcess)} app starts feeding production.</p>}
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {sortedProducts.map(p => {
                const eff = effectiveRate(p.name)
                const common = rateOn(rates.list, p.name, '', effFrom, rateProcess)
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-semibold text-slate-600">{p.name}</span>
                    {owner
                      ? <NumberInput key={`${rateProcess}|${rateContractor}|${effFrom}|${p.id}`} inputMode="decimal" step="0.01" min="0" className="w-24 !py-1.5 text-right" placeholder={rateContractor && common ? `${common} (all)` : '₹/pc'} defaultValue={eff || ''} onBlur={e => applyRateChange(p.name, p.id, e.target.value)} />
                      : <span className="w-24 text-right font-mono text-sm text-slate-700">{rate$(rateOn(rates.list, p.name, rateContractor || '', todayStr(), rateProcess))}</span>}
                  </div>
                )
              })}
              {sortedProducts.length === 0 && <p className="text-sm text-slate-400">No products.</p>}
            </div>
          </div>
        )}
      </Card>

      {/* Rate history timeline */}
      <Card className="p-4">
        <button onClick={() => setShowHistory(s => !s)} className="w-full flex items-center justify-between font-bold text-slate-700">
          <span>📜 Rate History · {processLabel(rateProcess)}</span><span className="text-slate-400">{showHistory ? '▲' : '▼'}</span>
        </button>
        {showHistory && (
          <div className="mt-3 overflow-x-auto">
            {timeline.length === 0 ? <p className="text-sm text-slate-400">No rates yet.</p> : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="py-1 pr-2">Product</th><th className="pr-2">Contractor</th><th className="pr-2 text-right">Rate</th>
                    <th className="pr-2">From</th><th className="pr-2">To</th><th className="pr-1 text-center">Active</th>{owner && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map(r => {
                    const active = isRateActiveNow(r)
                    return (
                      <tr key={r.id} className={`border-t border-slate-100 ${active ? '' : 'text-slate-400'}`}>
                        <td className="py-1.5 pr-2 font-semibold text-slate-600">{rProductName(r)}</td>
                        <td className="pr-2">{r.contractor || 'All'}</td>
                        <td className="pr-2 text-right font-mono">{rate$(r.rate)}</td>
                        <td className="pr-2 whitespace-nowrap">{r.effectiveFrom ? fmtDate(r.effectiveFrom) : '—'}</td>
                        <td className="pr-2 whitespace-nowrap">{r.effectiveTo ? fmtDate(r.effectiveTo) : (r.isActive === false ? 'off' : 'open')}</td>
                        <td className="pr-1 text-center">{active ? <span className="text-emerald-600 font-bold">●</span> : <span className="text-slate-300">○</span>}</td>
                        {owner && <td className="whitespace-nowrap text-right">
                          <button onClick={() => setEditRate(r)} className="px-1" title="Edit date / rate">✏️</button>
                          {active && <button onClick={() => deactivateRate(r)} className="px-1" title="Deactivate (keep in history)">⏸</button>}
                          <button onClick={() => deleteRate(r)} className="px-1" title="Delete permanently">🗑</button>
                        </td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="text-[11px] text-slate-400 mt-2">✏️ edit date/rate · ⏸ deactivate (keep in history) · 🗑 delete permanently. ● = in effect today.</p>
          </div>
        )}
      </Card>
      </>}

      {/* Per-contractor statements */}
      {statements.map(st => {
        const t = todayCalc(dispatches.list, rates.list, st.contractor, todayStr(), opts)
        const refPcs = refProducts.size
          ? dispatches.list.filter(d => d.welder === st.contractor && Number(d.qty) > 0 && refProducts.has(d.productName) && d.date >= from && d.date <= to).reduce((s, d) => s + Number(d.qty), 0)
          : 0
        const settled = settlements.list.find(s => s.welder === st.contractor && s.month === (mode === 'day' ? day.slice(0, 7) : month) && s.locked !== false)
        return (
          <Card key={st.contractor} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-lg text-slate-800">{st.contractor}</div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button size="sm" variant="neutral" onClick={() => exportPDF(st)}>📄 Products</Button>
                <Button size="sm" variant="success" onClick={() => generateHisab(st.contractor)}>🧾 Hisab PDF</Button>
                {owner && !settled && <Button size="sm" variant="primary" onClick={() => setFinalizing(st.contractor)}>🔒 Finalize</Button>}
              </div>
            </div>

            {settled && (
              <div className="flex items-center justify-between bg-slate-100 rounded-xl px-3 py-2 text-xs">
                <span className="font-semibold text-slate-600">🔒 {settled.month} finalized · {settled.net >= 0 ? `${money(settled.net)} payable` : `${money(-settled.net)} advance`} carried · locked ≤ {fmtDate(settled.cutoffDate)}</span>
                {owner && <button onClick={() => reopenSettlement(settled)} className="text-blue-600 font-bold ml-2">Reopen</button>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-amber-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-amber-700">{fmtNum(st.totalPieces)}</div><div className="text-[11px] text-slate-500">{periodShort} pcs · {money(st.payable)}</div></div>
              <div className="bg-slate-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-slate-700">{fmtNum(t.pieces)}</div><div className="text-[11px] text-slate-500">Today · {money(t.earning)}</div></div>
            </div>

            {st.products.length > 0 && (
              <div className="space-y-1">
                {st.products.map(p => (
                  <div key={p.product} className="flex justify-between text-sm"><span className="text-slate-600">{p.product} <span className="text-slate-400">× {fmtNum(p.qty)} @ {p.mixed ? 'mixed' : rate$(p.rate)}</span></span><span className="font-mono font-semibold text-slate-700">{money(p.amount)}</span></div>
                ))}
              </div>
            )}

            {refPcs > 0 && (
              <div className="bg-amber-50 rounded-xl px-3 py-2 text-[11px] text-amber-700">📦 Material / reference: {fmtNum(refPcs)} pcs ({periodShort.toLowerCase()}) — paid via material/dispatch, <b>not</b> in this hisab.</div>
            )}

            <div className="border-t border-slate-100 pt-2 space-y-1 text-sm">
              <Row label={`Payable (${periodShort.toLowerCase()})`} value={money(st.payable)} strong />
              <Row label={`Paid (${periodShort.toLowerCase()})`} value={money(st.paid)} tone="text-emerald-600" />
              <Row label={`Balance (${periodShort.toLowerCase()})`} value={money(st.balance)} tone={st.balance > 0 ? 'text-red-600' : 'text-slate-600'} strong />
              <Row label="Outstanding (all-time)" value={money(st.outstanding)} tone={st.outstanding > 0 ? 'text-red-500' : 'text-slate-500'} />
            </div>

            {pay && pay.contractor === st.contractor
              ? <PayForm contractor={st.contractor} onSave={recordPayment} onCancel={() => setPay(null)} />
              : <Button size="sm" variant="success" className="w-full" onClick={() => setPay({ contractor: st.contractor })}>+ Record payment</Button>}
          </Card>
        )
      })}
      {statements.length === 0 && <Card className="p-8 text-center text-slate-400">No contractors.</Card>}

      {editRate && <EditRateForm rate={editRate} onSave={saveRateEdit} onCancel={() => setEditRate(null)} />}
      {finalizing && <FinalizeForm contractor={finalizing} preview={settlePreview(finalizing)} periodLabel={periodLabel} onConfirm={(dp) => doFinalize(finalizing, dp)} onCancel={() => setFinalizing(null)} />}
    </div>
  )
}

function FinalizeForm({ contractor, preview, periodLabel, onConfirm, onCancel }) {
  const [dayPay, setDayPay] = useState('')
  const dp = Number(dayPay) || 0
  const finalNet = preview.net - dp
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-lg text-slate-800">🔒 Finalize Hisab — {contractor}</div>
        <div className="text-xs text-slate-500">Month: {periodLabel} · counts everything up to {fmtDate(preview.cutoff)}. After finalizing, these entries lock (admin password to change).</div>
        <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-sm">
          <Row label="Total earned (piece + material)" value={money(preview.earned)} />
          <Row label="Advances" value={money(preview.advances)} tone="text-emerald-600" />
          <Row label="Payments" value={money(preview.paid)} tone="text-emerald-600" />
          <div className="border-t border-slate-200 my-1" />
          <Row label="Net now" value={preview.net >= 0 ? `${money(preview.net)} payable` : `${money(-preview.net)} advance`} strong />
        </div>
        <div>
          <FieldLabel>Paid to {contractor} today (optional)</FieldLabel>
          <NumberInput inputMode="decimal" className="mt-1" placeholder="0" value={dayPay} onChange={e => setDayPay(e.target.value)} />
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-sm font-bold text-amber-800">
          Carry forward: {finalNet >= 0 ? `${money(finalNet)} payable to ${contractor}` : `${money(-finalNet)} advance with ${contractor}`}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="neutral" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onConfirm(dp)}>Finalize & Lock</Button>
        </div>
      </div>
    </div>
  )
}

function EditRateForm({ rate, onSave, onCancel }) {
  const [from, setFrom] = useState(rate.effectiveFrom || todayStr())
  const [to, setTo] = useState(rate.effectiveTo || '')
  const [val, setVal] = useState(String(rate.rate ?? ''))
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-slate-800">Fix rate · {rate.productName || rate.product}{rate.contractor ? ' · ' + rate.contractor : ' · All'}</div>
        <div><FieldLabel>Rate ₹/pc</FieldLabel><NumberInput inputMode="decimal" step="0.01" min="0" className="mt-1" value={val} onChange={e => setVal(e.target.value)} /></div>
        <div><FieldLabel>Effective FROM (backdate here, e.g. 1 May)</FieldLabel><DateInput className="mt-1" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><FieldLabel>Effective TO (leave blank = still applies)</FieldLabel><DateInput className="mt-1" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="flex gap-2 pt-1">
          <Button variant="neutral" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="success" className="flex-1" onClick={() => onSave({ effectiveFrom: from, effectiveTo: to, rate: val })}>Save</Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, tone = 'text-slate-700', strong }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className={`font-mono ${strong ? 'font-bold' : ''} ${tone}`}>{value}</span></div>
}

function PayForm({ contractor, onSave, onCancel }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [mode, setMode] = useState('Cash')
  const [remark, setRemark] = useState('')
  const [name, setName] = useState('')
  return (
    <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Amount ₹</FieldLabel><NumberInput className="mt-1 !py-2" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1 !py-2" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><FieldLabel>Mode</FieldLabel><Select className="mt-1" value={mode} onChange={e => setMode(e.target.value)} options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} /></div>
        <div><FieldLabel>Your name</FieldLabel><TextInput className="mt-1" placeholder="(optional)" value={name} onChange={e => setName(e.target.value)} /></div>
      </div>
      <TextInput placeholder="Remark (e.g. June welding payment)" value={remark} onChange={e => setRemark(e.target.value)} />
      <div className="flex gap-2"><Button size="sm" variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button><Button size="sm" variant="success" className="flex-1" onClick={() => onSave(contractor, amount, date, mode, remark, name)}>Save payment</Button></div>
    </div>
  )
}
