/**
 * Review / Approvals queue.
 *   • Manager (level='manager'): sees PENDING staff entries, taps "Pass ✓" to
 *     forward them. Cannot edit qty/name, create, or delete.
 *   • Owner (level='owner'): sees pending + passed entries, taps "Approve ✓" to
 *     push them to the main totals. Can also send back.
 * Only APPROVED entries count in the dashboard.
 */
import { useMemo } from 'react'
import { Button, Card, FieldLabel, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { statusLabel, statusColor } from '../config'

export default function ReviewQueue({ level = 'manager' }) {
  const { dispatches, log } = useWelder()
  const { msg, show } = useToast()
  const owner = level === 'owner'

  const rows = useMemo(() => {
    const wanted = owner ? ['pending', 'passed'] : ['pending']
    return dispatches.list
      .filter(d => wanted.includes(d.status || 'pending') && (Number(d.qty) || 0) > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))
  }, [dispatches.list, owner])

  const pass = (d) => { dispatches.update(d.id, { status: 'passed', passedBy: 'incharge' }); log('PASS', `${d.finishedName || d.productName} × ${d.qty} · ${d.welder}`, 'incharge', d.id); show('Passed ✓') }
  const approve = (d) => { dispatches.update(d.id, { status: 'approved', approvedBy: 'owner' }); log('APPROVE', `${d.finishedName || d.productName} × ${d.qty} · ${d.welder}`, 'owner', d.id); show('Approved ✓ → main stock') }
  const sendBack = (d) => { dispatches.update(d.id, { status: 'pending', passedBy: '' }); log('SENDBACK', `${d.finishedName || d.productName} × ${d.qty}`, 'owner', d.id); show('Sent back') }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Card className="p-4">
        <FieldLabel>{owner ? 'Approvals — push to main stock' : 'Review — pass entries to owner'}</FieldLabel>
        <p className="text-xs text-slate-400 mt-1">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'} waiting.</p>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">Nothing to {owner ? 'approve' : 'pass'} 🎉</Card>
      ) : (
        <div className="space-y-2">
          {rows.map(d => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-800">{d.finishedName || d.productName} <span className="text-sm font-mono text-amber-700">× {fmtNum(d.qty)}</span></div>
                  <div className="text-xs text-slate-400 mt-0.5">{d.welder} → {d.party} · {fmtDate(d.date)}</div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${statusColor(d.status)}`}>{statusLabel(d.status)}</span>
              </div>
              <div className="flex gap-2 mt-3">
                {!owner && <Button size="sm" variant="primary" className="flex-1 !bg-amber-600" onClick={() => pass(d)}>Pass ✓</Button>}
                {owner && <>
                  <Button size="sm" variant="success" className="flex-1" onClick={() => approve(d)}>Approve ✓</Button>
                  {d.status === 'passed' && <Button size="sm" variant="ghost" onClick={() => sendBack(d)}>Send back</Button>}
                </>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
