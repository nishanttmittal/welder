/**
 * Plating bridge helpers — turn welder dispatches into plating challans.
 *
 * Flow: a welder loads a GAADI (vehicle) with products for one job-work party,
 * then "dispatches" it. Each welder gets a unique challan number per gaadi
 * (e.g. NAV-001 / JIT-001). All welders' material on the SAME gaadi+party+day
 * combine into ONE plating challan (the plating app assigns its own number on
 * push). Each plating line carries the welder challan number in front of the
 * base product name — so the plating app shows it with ZERO changes.
 */
import { welderPrefix } from '../config'

/** Next welder challan code for a welder, from the counters singleton value. */
export function nextWelderChallan(countersValue, welderName) {
  const map = (countersValue && countersValue.challan) || {}
  const n = (map[welderName] || 0) + 1
  return { code: `${welderPrefix(welderName)}-${String(n).padStart(3, '0')}`, n }
}

/** Group undispatched entries by gaadi + party + date (one plating challan each). */
export function groupUndispatched(dispatches, welderFilter = '') {
  const groups = {}
  for (const d of dispatches) {
    if (d.dispatched || !(Number(d.qty) > 0) || !d.gaadi) continue
    if (welderFilter && d.welder !== welderFilter) continue
    const key = `${d.gaadi}|${d.party}|${d.date}`
    ;(groups[key] = groups[key] || { gaadi: d.gaadi, party: d.party, date: d.date, welder: d.welder, entries: [] }).entries.push(d)
  }
  return Object.values(groups).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

/** Plating line items for a group: "NAV-001 Spider" × qty (base name + prefix). */
export const platingItems = (entries, challanCode) =>
  entries.map(d => ({ product: `${challanCode} ${d.productName}`, quantity: Number(d.qty) || 0 }))

export const last4 = (g) => (g || '').replace(/\s/g, '').slice(-4)
