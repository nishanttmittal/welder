/**
 * Welder Contractor — pure aggregation helpers for the dashboard & reports.
 * All take the flat dispatches list and slice/group it.
 */
const num = (v) => Number(v) || 0
const inRange = (d, from, to) => (!from || d.date >= from) && (!to || d.date <= to)

/** Only approved entries count toward "main" totals. */
export const approvedOnly = (dispatches) => dispatches.filter(d => d.status === 'approved')

/** Counts (entries + qty) by approval status, for the pipeline view. */
export function pipeline(dispatches) {
  const o = { pending: { n: 0, q: 0 }, passed: { n: 0, q: 0 }, approved: { n: 0, q: 0 } }
  for (const d of dispatches) { const s = d.status || 'pending'; if (o[s]) { o[s].n++; o[s].q += num(d.qty) } }
  return o
}

/** Total pieces sent in a date range. */
export const totalSent = (dispatches, from, to) =>
  dispatches.filter(d => inRange(d, from, to)).reduce((s, d) => s + num(d.qty), 0)

/** Per-welder totals: [{ welder, qty }] sorted desc. */
export function byWelder(dispatches, from, to) {
  const m = {}
  for (const d of dispatches.filter(d => inRange(d, from, to))) m[d.welder] = (m[d.welder] || 0) + num(d.qty)
  return Object.entries(m).map(([welder, qty]) => ({ welder, qty })).sort((a, b) => b.qty - a.qty)
}

/** Per-party totals: [{ party, qty }] sorted desc. */
export function byParty(dispatches, from, to) {
  const m = {}
  for (const d of dispatches.filter(d => inRange(d, from, to))) m[d.party || '—'] = (m[d.party || '—'] || 0) + num(d.qty)
  return Object.entries(m).map(([party, qty]) => ({ party, qty })).sort((a, b) => b.qty - a.qty)
}

/**
 * For a single date: party → list of { name (finished), qty }. This is the core
 * view — "material by product name sent to each party that day".
 */
export function partyProductBreakdown(dispatches, date) {
  const out = {}
  for (const d of dispatches.filter(d => d.date === date)) {
    const party = d.party || '—'
    const name = d.finishedName || d.productName
    out[party] = out[party] || {}
    out[party][name] = (out[party][name] || 0) + num(d.qty)
  }
  // shape: [{ party, total, items: [{name, qty}] }]
  return Object.entries(out).map(([party, items]) => ({
    party,
    total: Object.values(items).reduce((s, q) => s + q, 0),
    items: Object.entries(items).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty),
  })).sort((a, b) => b.total - a.total)
}

/** Per-welder, for a date: [{ welder, total, items:[{name, party, qty}] }]. */
export function welderBreakdown(dispatches, date) {
  const out = {}
  for (const d of dispatches.filter(d => d.date === date)) {
    out[d.welder] = out[d.welder] || []
    out[d.welder].push({ name: d.finishedName || d.productName, party: d.party || '—', qty: num(d.qty) })
  }
  return Object.entries(out).map(([welder, items]) => ({
    welder, total: items.reduce((s, i) => s + i.qty, 0), items,
  })).sort((a, b) => b.total - a.total)
}
