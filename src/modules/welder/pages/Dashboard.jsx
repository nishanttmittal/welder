/**
 * Dashboard (owner) — for a chosen day: total sent, each welder's total, and
 * the per-party product breakdown ("what went to whom"). Plus month-to-date.
 */
import { useMemo, useState } from 'react'
import { Card, FieldLabel } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { byWelder, partyProductBreakdown, totalSent, approvedOnly, pipeline } from '../logic/report'
import { statusLabel, statusColor } from '../config'

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

  // Only APPROVED entries count toward the main totals.
  const list = useMemo(() => approvedOnly(dispatches.list), [dispatches.list])
  const pipe = useMemo(() => pipeline(dispatches.list), [dispatches.list])
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

      {(pipe.pending.n > 0 || pipe.passed.n > 0) && (
        <Card className="p-4">
          <FieldLabel>Awaiting Approval</FieldLabel>
          <div className="mt-2 flex gap-2">
            {['pending', 'passed'].map(s => (
              <div key={s} className={`flex-1 rounded-xl py-2 text-center ${statusColor(s)}`}>
                <div className="text-xl font-bold">{pipe[s].n}</div><div className="text-[11px] font-semibold">{statusLabel(s)} ({fmtNum(pipe[s].q)} pcs)</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Approve them in the <b>Approvals</b> screen to count in totals.</p>
        </Card>
      )}

      <div className="flex gap-3">
        <Stat label={`Approved ${fmtDate(date)}`} value={fmtNum(dayTotal)} tone="text-amber-600" />
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
