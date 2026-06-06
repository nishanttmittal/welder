/**
 * Plating Outbox (owner) — PREVIEW of the combined challans generated from the
 * welders' dispatched gaadis. This is exactly what will be pushed into the
 * Plating Job Work app (party · Outgoing · gaadi · items "NAV-001 Spider").
 * Live push is intentionally NOT enabled yet — the owner reviews here first;
 * one-tap push (assigning the real PJW-#### number) is switched on after
 * approval + the plating cloud rules are confirmed.
 */
import { useMemo } from 'react'
import { Card, FieldLabel, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { last4 } from '../logic/platingBridge'

export default function PlatingOutbox() {
  const { platingOutbox } = useWelder()
  const { msg } = useToast()
  const rows = useMemo(() => [...platingOutbox.list].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [platingOutbox.list])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Card className="p-4 border border-blue-200 bg-blue-50">
        <FieldLabel className="text-blue-700">Plating Outbox — preview</FieldLabel>
        <p className="text-xs text-slate-500 mt-1">These combined challans are ready for your Plating app. Live push (assigning the real PJW-#### number) turns on after you approve and the plating cloud is confirmed. Nothing is written to plating yet.</p>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">Nothing dispatched yet.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map(o => {
            const total = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">🚚 …{last4(o.gaadi)} → {o.party}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{fmtDate(o.date)} · {(o.welderChallans || []).join(', ')} · {fmtNum(total)} pcs</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${o.pushed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.pushed ? `Pushed ${o.platingChallanNo}` : 'Ready'}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-sm"><span className="font-mono text-slate-700">{it.product}</span><span className="font-mono text-slate-600">{fmtNum(it.quantity)}</span></div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
