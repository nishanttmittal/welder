/**
 * Dispatch Gaadi — the welder loads a vehicle (gaadi) with products for one
 * job-work party, then taps "Dispatch". That assigns the welder challan number
 * (NAV-001 / JIT-001) and generates the combined plating challan into the
 * Plating Outbox (preview). Powder entries don't go to plating.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { isPlatingFinish } from '../config'
import { nextWelderChallan, platingItems, last4 } from '../logic/platingBridge'

export default function Dispatch({ floor = false, operator = '', by = '' }) {
  const { dispatches, platingOutbox, counters, log } = useWelder()
  const { msg, show } = useToast()
  const who = by || operator || (floor ? 'welder' : 'admin')

  // Only PLATING finishes (chrome/gold/rose) flow to plating; powder stays out.
  const groups = useMemo(() => {
    const g = {}
    for (const d of dispatches.list) {
      if (d.dispatched || !(Number(d.qty) > 0) || !d.gaadi || !isPlatingFinish(d.finish)) continue
      if (operator && d.welder !== operator) continue
      const key = `${d.welder}|${d.gaadi}|${d.party}|${d.date}`
      ;(g[key] = g[key] || { welder: d.welder, gaadi: d.gaadi, party: d.party, date: d.date, entries: [] }).entries.push(d)
    }
    return Object.values(g).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [dispatches.list, operator])

  const [busy, setBusy] = useState('')

  const dispatchGroup = (grp) => {
    setBusy(grp.welder + grp.gaadi + grp.date)
    const { code, n } = nextWelderChallan(counters.get(), grp.welder)
    // 1) stamp the welder challan + mark dispatched on each entry
    grp.entries.forEach(d => dispatches.update(d.id, { welderChallan: code, dispatched: true }))
    // 2) bump this welder's challan counter
    const cur = counters.get() || {}
    counters.set({ ...cur, challan: { ...(cur.challan || {}), [grp.welder]: n } })
    // 3) build/append the combined plating-outbox challan for this gaadi+party+date
    const items = platingItems(grp.entries, code)
    const existing = platingOutbox.list.find(o => !o.pushed && o.gaadi === grp.gaadi && o.party === grp.party && o.date === grp.date)
    if (existing) {
      platingOutbox.update(existing.id, {
        items: [...(existing.items || []), ...items],
        welderChallans: [...(existing.welderChallans || []), code],
      })
    } else {
      platingOutbox.insert({ date: grp.date, gaadi: grp.gaadi, party: grp.party, items, welderChallans: [code], pushed: false, platingChallanNo: '' })
    }
    log('DISPATCH', `${code}: gaadi …${last4(grp.gaadi)} → ${grp.party} (${items.length} item/s)`, who, '')
    show(`Dispatched ${code} → plating outbox ✓`)
    setBusy('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Card className="p-4">
        <FieldLabel>Dispatch a Gaadi</FieldLabel>
        <p className="text-xs text-slate-400 mt-1">Load a vehicle with products (Chrome / Gold / Rose Gold), then dispatch it. It generates the plating challan. Powder is in-house and doesn't go to plating.</p>
      </Card>

      {groups.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">No vehicles waiting. Add entries with a Gaadi number first.</Card>
      ) : (
        <div className="space-y-2">
          {groups.map(grp => {
            const total = grp.entries.reduce((s, d) => s + (Number(d.qty) || 0), 0)
            const k = grp.welder + grp.gaadi + grp.date
            return (
              <Card key={k} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">🚚 Gaadi …{last4(grp.gaadi)} → {grp.party}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{grp.welder} · {fmtDate(grp.date)} · {fmtNum(total)} pcs</div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {grp.entries.map(d => (
                    <div key={d.id} className="flex justify-between text-sm"><span className="font-semibold text-slate-700">{d.productName} <span className="text-slate-400">{d.finishedName?.split(' ').slice(-1)}</span></span><span className="font-mono text-slate-600">{fmtNum(d.qty)}</span></div>
                  ))}
                </div>
                <Button variant="primary" className="w-full mt-3 !bg-amber-600" disabled={busy === k} onClick={() => dispatchGroup(grp)}>Dispatch to plating</Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
