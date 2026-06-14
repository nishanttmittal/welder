/**
 * Contractor payment math — pure, derived from dispatches + rates + payments.
 * Only valid production counts (qty > 0; cancelled/voided entries excluded).
 *
 * RATES ARE HISTORICAL & TIME-BASED. Each rate record carries effectiveFrom /
 * effectiveTo. The amount for a dispatch always uses the rate that applied ON
 * ITS PRODUCTION DATE — so a June statement keeps June's rate even after a July
 * rate change. Resolution priority: contractor-specific > common product rate.
 *
 * Backward-compat: old simple rates (no dates, field `product`) are treated as
 * "always in effect" (empty effectiveFrom/To, isActive true) so existing
 * statements keep calculating unchanged.
 */
import { todayStr } from '../../../core/utils/format'

const num = (v) => Number(v) || 0
const inRange = (d, from, to) => (!from || (d.date || '') >= from) && (!to || (d.date || '') <= to)

/** A rate's product key, tolerating the legacy `product` field name. */
const rProduct = (r) => r.productName || r.product || ''
const rProcess = (r) => r.process || 'welding'

/** Day before a YYYY-MM-DD date (used to auto-close the previous rate). */
export function dayBefore(dateStr) {
  const dt = new Date((dateStr || todayStr()) + 'T00:00:00')
  dt.setDate(dt.getDate() - 1)
  return dt.toISOString().slice(0, 10)
}

/** Does a rate record apply to (productName, process) on a given date? */
const applies = (r, productName, process, date) =>
  r.isActive !== false &&
  rProcess(r) === process &&
  rProduct(r) === productName &&
  (!r.effectiveFrom || r.effectiveFrom <= date) &&
  (!r.effectiveTo || date <= r.effectiveTo)

const latestFirst = (a, b) =>
  (b.effectiveFrom || '').localeCompare(a.effectiveFrom || '') ||
  (b.createdAt || '').localeCompare(a.createdAt || '')

/**
 * Rate applicable for a product on a specific date. Contractor-specific wins
 * over the common rate; if several match, the one with the latest effectiveFrom.
 */
export function rateOn(rates, productName, contractor, date, process = 'welding') {
  const d = date || todayStr()
  const pool = rates.filter(r => applies(r, productName, process, d))
  const specific = pool.filter(r => r.contractor && r.contractor === contractor).sort(latestFirst)[0]
  if (specific) return num(specific.rate)
  const common = pool.filter(r => !r.contractor).sort(latestFirst)[0]
  return common ? num(common.rate) : 0
}

/** Current rate (today) — thin wrapper kept for existing callers. */
export function rateFor(rates, productName, contractor, process = 'welding') {
  return rateOn(rates, productName, contractor, todayStr(), process)
}

/**
 * The active rate record for an EXACT key (process+product+contractor) whose
 * window covers `onDate` — i.e. the one to auto-close when a new rate starts.
 */
export function currentOpenRate(rates, productName, contractor, process, onDate) {
  return rates.filter(r =>
    r.isActive !== false &&
    rProcess(r) === process &&
    rProduct(r) === productName &&
    (r.contractor || '') === (contractor || '') &&
    (!r.effectiveFrom || r.effectiveFrom <= onDate) &&
    (!r.effectiveTo || onDate <= r.effectiveTo)
  ).sort(latestFirst)[0] || null
}

/** All rate records for a process, sorted for the history table. */
export function rateTimeline(rates, process = 'welding') {
  return [...rates.filter(r => rProcess(r) === process)].sort((a, b) =>
    rProduct(a).localeCompare(rProduct(b)) ||
    (a.contractor || '').localeCompare(b.contractor || '') ||
    (a.effectiveFrom || '').localeCompare(b.effectiveFrom || ''))
}

/** Is this rate record the one in effect today (for the "Active" column)? */
export function isRateActiveNow(r) {
  const d = todayStr()
  return r.isActive !== false && (!r.effectiveFrom || r.effectiveFrom <= d) && (!r.effectiveTo || d <= r.effectiveTo)
}

/**
 * Countable production rows for a contractor in a date range. Optional filters
 * (product / finish) narrow the daily view. Cancelled rows (qty 0) excluded.
 */
export const countable = (dispatches, contractor, from, to, opts = {}) =>
  dispatches.filter(d =>
    d.welder === contractor && num(d.qty) > 0 && inRange(d, from, to)
    && (!opts.product || d.productName === opts.product)
    && (!opts.finish || d.finish === opts.finish)
    // referenceOnly/material products are excluded from pay; includeOnly flips it
    && (!opts.exclude || !opts.exclude.has(d.productName))
    && (!opts.includeOnly || opts.includeOnly.has(d.productName)))

/**
 * Product-wise breakdown for a contractor/range. The rate is resolved PER ROW
 * by its production date, so amounts are always historically correct. The `rate`
 * shown per product is the single rate if uniform across the period, else null
 * (with `mixed: true`) because more than one rate applied.
 */
export function productWise(dispatches, rates, contractor, from, to, opts = {}) {
  const map = {}
  for (const d of countable(dispatches, contractor, from, to, opts)) {
    const rate = rateOn(rates, d.productName, contractor, d.date)
    const m = (map[d.productName] = map[d.productName] || { product: d.productName, qty: 0, amount: 0, _rates: new Set() })
    m.qty += num(d.qty)
    m.amount += num(d.qty) * rate
    m._rates.add(rate)
  }
  return Object.values(map).map(m => {
    const mixed = m._rates.size > 1
    const rate = mixed ? null : ([...m._rates][0] ?? 0)
    return { product: m.product, qty: m.qty, amount: m.amount, rate, mixed }
  }).sort((a, b) => b.amount - a.amount)
}

/** A payment's effective date / remark, tolerant of legacy field names. */
const pDate = (p) => p.paymentDate || p.date || ''
const pRemark = (p) => p.remark || p.note || 'Payment'

export const paidFor = (payments, contractor, from, to) =>
  payments.filter(p => p.contractor === contractor && !p.reversed
    && (!from || pDate(p) >= from) && (!to || pDate(p) <= to))
    .reduce((s, p) => s + num(p.amount), 0)

/** Next unique payment slip number — derived from data, crash-safe. */
export function nextPaymentSlip(payments) {
  let max = 0
  for (const p of (payments || [])) { const m = /UMP-PAY-(\d+)/.exec(p.paymentSlipNo || ''); if (m) max = Math.max(max, Number(m[1]) || 0) }
  return `UMP-PAY-${String(max + 1).padStart(4, '0')}`
}

/** Assemble a payment record (one shape, used by every entry point). */
export function newPayment({ slip, contractor, amount, date, mode, remark, paidByUser, paidByRole }) {
  const r = (remark || '').trim()
  return {
    paymentSlipNo: slip, contractor, amount: num(amount),
    paymentMode: mode || 'cash', remark: r, paymentDate: date,
    paidByUser: (paidByUser || '').trim(), paidByRole: paidByRole || '', reversed: false,
    date, note: r, // legacy mirror so existing reports keep working
  }
}

/** "Sri Ram (Manager)" / "Manager" / "" from a payment or ledger record. */
export const paidByLabel = (user, role) =>
  user && role ? `${user} (${role})` : (user || role || '')

/** Full statement for one contractor over a period + all-time outstanding. */
export function statement(dispatches, rates, payments, contractor, from, to, opts = {}) {
  const products = productWise(dispatches, rates, contractor, from, to, opts)
  const totalPieces = products.reduce((s, p) => s + p.qty, 0)
  const payable = products.reduce((s, p) => s + p.amount, 0)
  const paid = paidFor(payments, contractor, from, to)
  // all-time (payments aren't tagged by product/finish, so outstanding is whole-account)
  const allProducts = productWise(dispatches, rates, contractor, '', '', { exclude: opts.exclude })
  const payableEver = allProducts.reduce((s, p) => s + p.amount, 0)
  const paidEver = paidFor(payments, contractor, '', '')
  return { contractor, products, totalPieces, payable, paid, balance: payable - paid, outstanding: payableEver - paidEver }
}

/** Pieces + earning for a contractor on one day (honours product/finish filters). */
export function today(dispatches, rates, contractor, todayStr, opts = {}) {
  const rows = countable(dispatches, contractor, todayStr, todayStr, opts)
  const pieces = rows.reduce((s, d) => s + num(d.qty), 0)
  const earning = rows.reduce((s, d) => s + num(d.qty) * rateOn(rates, d.productName, contractor, d.date), 0)
  return { pieces, earning }
}

/**
 * CONTRACTOR LEDGER (accounting view) — fully DERIVED, audit-safe, no duplicate
 * counting. Each entry type has exactly one source:
 *   • Production  ← dispatches (credit = qty × rate-on-production-date)
 *   • Payment     ← payments collection (debit)
 *   • Advance     ← ledger collection, type 'advance' (debit)
 *   • Adjustment  ← ledger collection, type 'adjustment' (credit or debit)
 *   • Opening Bal ← ledger collection, type 'opening' (credit or debit)
 * Running balance = Σ(credit − debit); positive = we owe the contractor.
 *
 * Historical integrity: production lines use rateOn(productionDate), so a future
 * rate change never reprices an old line. The period "opening balance" is the
 * carried-forward running balance of everything dated before `from`.
 */
export function buildLedger(dispatches, rates, payments, ledger, contractor, from, to, excludeProducts = null) {
  const lines = []

  // Production → DEBIT (increases what we owe the contractor)
  for (const d of dispatches) {
    if (d.welder !== contractor || !(num(d.qty) > 0)) continue
    if (excludeProducts && excludeProducts.has(d.productName)) continue // material/reference, not paid
    const rate = rateOn(rates, d.productName, contractor, d.date)
    lines.push({
      date: d.date, slipNo: d.welderChallan || '', type: 'Production',
      description: `${d.finishedName || d.productName} × ${num(d.qty)} @ ₹${rate}`, paidBy: '',
      debit: num(d.qty) * rate, credit: 0, source: 'production', refId: d.id, _sort: d.createdAt || '',
    })
  }
  // Payment → CREDIT (reduces what we owe). Reversed payments stay visible at 0.
  for (const p of payments) {
    if (p.contractor !== contractor) continue
    const rev = !!p.reversed
    lines.push({
      date: pDate(p), slipNo: p.paymentSlipNo || '', type: 'Payment',
      description: (rev ? 'REVERSED: ' : '') + pRemark(p), paidBy: paidByLabel(p.paidByUser, p.paidByRole),
      debit: 0, credit: rev ? 0 : num(p.amount), reversed: rev, source: 'payment', refId: p.id, _sort: p.createdAt || '',
    })
  }
  // Manual entries: direction 'debit' increases owed, 'credit' decreases.
  for (const e of (ledger || [])) {
    if (e.contractor !== contractor) continue
    const rev = !!e.reversed
    const amt = num(e.amount)
    const isDebit = e.direction === 'debit'
    const label = e.type === 'opening' ? 'Opening Balance' : e.type === 'advance' ? 'Advance' : e.type === 'material' ? 'Material (dispatch)' : 'Adjustment'
    lines.push({
      date: e.date, slipNo: '', type: label,
      description: (rev ? 'REVERSED: ' : '') + (e.note || label), paidBy: e.createdBy || '',
      debit: rev ? 0 : (isDebit ? amt : 0), credit: rev ? 0 : (isDebit ? 0 : amt), reversed: rev,
      source: 'ledger', refId: e.id, _sort: e.createdAt || '',
    })
  }

  lines.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a._sort || '').localeCompare(b._sort || ''))

  // Carried-forward opening = everything strictly before the period start.
  const opening = lines.filter(l => from && (l.date || '') < from).reduce((s, l) => s + l.debit - l.credit, 0)

  const summary = { opening, production: 0, payment: 0, advance: 0, adjustment: 0 }
  let bal = opening
  const periodLines = []
  for (const ln of lines) {
    const inPeriod = (!from || (ln.date || '') >= from) && (!to || (ln.date || '') <= to)
    if (!inPeriod) continue
    bal += ln.debit - ln.credit
    periodLines.push({ ...ln, runningBalance: bal })
    if (ln.type === 'Production') summary.production += ln.debit
    else if (ln.type === 'Payment') summary.payment += ln.credit
    else if (ln.type === 'Advance') summary.advance += ln.credit
    else summary.adjustment += ln.debit - ln.credit // Adjustment / in-period Opening
  }
  return { contractor, opening, lines: periodLines, closing: bal, summary }
}

/** Quote a CSV cell (Excel-safe). */
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

/**
 * Build an Excel-openable CSV from already-computed statements. One product row
 * per contractor, then a subtotal line with payable / paid / balance.
 */
export function statementsCSV(statements, periodLabel) {
  const rows = [['UNICO — Contractor Statement', periodLabel || '']]
  rows.push([])
  rows.push(['Contractor', 'Product', 'Pieces', 'Rate/pc', 'Amount'])
  for (const st of statements) {
    if (st.products.length === 0) rows.push([st.contractor, '(no production)', 0, '', 0])
    st.products.forEach((p, i) => rows.push([i === 0 ? st.contractor : '', p.product, p.qty, p.mixed ? 'mixed' : p.rate, p.amount]))
    rows.push(['', 'TOTAL', st.totalPieces, '', st.payable])
    rows.push(['', 'Paid', '', '', st.paid])
    rows.push(['', 'Balance', '', '', st.balance])
    rows.push(['', 'Outstanding (all-time)', '', '', st.outstanding])
    rows.push([])
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}
