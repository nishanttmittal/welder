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

/**
 * Next welder challan code for a welder (e.g. NAV-001) — CRASH-SAFE.
 *
 * Instead of trusting a single mutable counter (which lived per-device and could
 * desync or duplicate), we take the HIGHEST number this welder has actually used
 * in the synced dispatches list and add 1. Because dispatches sync across phones
 * in real time, two devices online stay consistent; offline still works.
 *
 * The legacy `countersValue` is kept only as a floor so rapid same-session saves
 * (before the new dispatch round-trips through the cloud snapshot) still advance.
 */
export function nextWelderChallan(countersValue, welderName, dispatches = []) {
  const prefix = welderPrefix(welderName)
  let maxN = 0
  for (const d of dispatches) {
    if (d.welder !== welderName) continue
    const m = /^(.+)-(\d+)$/.exec(d.welderChallan || '')
    if (m && m[1] === prefix) maxN = Math.max(maxN, Number(m[2]) || 0)
  }
  const counterN = ((countersValue && countersValue.challan) || {})[welderName] || 0
  const n = Math.max(maxN, counterN) + 1
  return { code: `${prefix}-${String(n).padStart(3, '0')}`, n }
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
