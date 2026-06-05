/**
 * Dashboard (owner) — for a chosen day: total sent, each welder's total, and
 * the per-party product breakdown ("what went to whom"). Plus month-to-date.
 */
import { useMemo, useState } from 'react'
import { Card, FieldLabel } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { byWelder, partyProductBreakdown, totalSent } from '../logic/report'

function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <Card className="p-4 flex-1 text-center">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { dispatches } = useWelder()
  const [date, setDate] = useState(todayStr())

  const list = dispatches.list
  const dayTotal = useMemo(() => totalSent(list, date, date), [list, date])
  const welders = useMemo(() => byWelder(list, date, date), [list, date])
  const groups = useMemo(() => partyProductBreakdown(list, date), [list, date])
  const monthFrom = date.slice(0, 8) + '01'
  const monthTotal = useMemo(() => totalSent(list, monthFrom, date), [list, monthFrom, date])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <FieldLabel>Report Date</FieldLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm font-semibold" />
      </Card>

      <div className="flex gap-3">
        <Stat label={`Sent ${fmtDate(date)}`} value={fmtNum(dayTotal)} tone="text-amber-600" />
        <Stat label="Month to date" value={fmtNum(monthTotal)} />
        <Stat label="Welders active" value={welders.length} />
      </div>

      {/* Per welder */}
      <Card className="p-5">
        <FieldLabel>By Welder · {fmtDate(date)}</FieldLabel>
        {welders.length === 0 ? (
          <p className="text-sm text-slate-400 mt-3">Nothing sent on this date.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {welders.map(w => (
              <div key={w.welder} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-slate-700">{w.welder}</span>
                <span className="font-mono font-bold text-amber-700">{fmtNum(w.qty)} pcs</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Per party → products */}
      <Card className="p-5">
        <FieldLabel>Sent to each party · {fmtDate(date)}</FieldLabel>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-400 mt-3">No dispatches on this date.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {groups.map(g => (
              <div key={g.party}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">{g.party}</span>
                  <span className="text-sm font-bold text-amber-700">{fmtNum(g.total)} pcs</span>
                </div>
                <div className="space-y-1">
                  {g.items.map(it => (
                    <div key={it.name} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-semibold text-slate-700">{it.name}</span>
                      <span className="font-mono text-slate-600">{fmtNum(it.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
