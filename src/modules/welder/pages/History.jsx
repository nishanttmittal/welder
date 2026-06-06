/**
 * Entries — view & edit dispatch entries.
 *   • User1 (owner=false): can Edit / Void entries only within the 2-day window
 *     (today + 2 days back). Older entries are locked ("Admin only"). No delete.
 *   • Owner/Admin (owner=true): edit/void ANY entry, hard-delete (password), and
 *     see the per-entry EDIT LOG (who changed what, when).
 * Every change is logged with who did it + old→new + timestamp.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, SearchBar, NumberStepper, DateInput, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum, daysAgoStr } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { ADMIN_PASSWORD } from '../config'

export default function History({ owner = false, by = 'admin' }) {
  const { dispatches, logs, log } = useWelder()
  const { msg, show } = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [historyOf, setHistoryOf] = useState(null)

  const editWindow = daysAgoStr(2) // welder/User1 may edit entries dated on/after this
  const canEdit = (d) => owner || (d.date || '') >= editWindow

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return dispatches.list
      .filter(d => !term || (d.finishedName || d.productName || '').toLowerCase().includes(term) || (d.welder || '').toLowerCase().includes(term) || (d.party || '').toLowerCase().includes(term) || (d.date || '').includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [dispatches.list, q])

  const startEdit = (d) => { setEditing(d); setEditQty(String(d.qty)); setEditDate(d.date) }
  const saveEdit = () => {
    const v = Number(editQty) || 0
    dispatches.update(editing.id, { qty: v, date: editDate })
    log('EDIT', `${editing.finishedName || editing.productName}: ${editing.qty}→${v}${editDate !== editing.date ? ` · date ${fmtDate(editing.date)}→${fmtDate(editDate)}` : ''}`, by, editing.id)
    show('Updated ✓'); setEditing(null)
  }
  const voidEntry = (d) => {
    const reason = prompt(`Void "${d.finishedName || d.productName} × ${d.qty}" (set to 0)?\nReason:`)
    if (reason === null) return
    log('VOID', `${d.finishedName || d.productName} × ${d.qty} → 0${reason ? ' · ' + reason : ''}`, by, d.id)
    dispatches.update(d.id, { qty: 0 })
    show('Voided ✓')
  }
  const hardDelete = (d) => {
    const pwd = prompt(`HARD DELETE "${d.finishedName || d.productName} × ${d.qty}" permanently.\nEnter admin password:`)
    if (pwd === null) return
    if (pwd !== ADMIN_PASSWORD) return show('Wrong password — not deleted', 2500)
    log('DELETE', `${d.finishedName || d.productName} × ${d.qty} (hard delete)`, by, d.id)
    dispatches.remove(d.id); show('Deleted ✓')
  }
  const entryHistory = (id) => logs.list.filter(l => l.ref === id).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <SearchBar value={q} onChange={setQ} placeholder="Search product / welder / party / date…" />
      {!owner && <p className="text-xs text-slate-400 -mt-1">You can edit entries from the last 2 days. Older entries are locked (admin only).</p>}
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">No entries found.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map(d => {
            const voided = d.qty === 0
            const editable = canEdit(d)
            const hist = entryHistory(d.id)
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold ${voided ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.finishedName || d.productName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{fmtDate(d.date)} · {d.welder} → {d.party}</div>
                  </div>
                  <span className={`font-mono font-bold text-lg ${voided ? 'text-slate-400' : 'text-amber-700'}`}>{voided ? 'void' : `× ${fmtNum(d.qty)}`}</span>
                </div>
                {editable ? (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="neutral" className="flex-1" onClick={() => startEdit(d)}>Edit</Button>
                    {!voided && <Button size="sm" variant="ghost" className="flex-1" onClick={() => voidEntry(d)}>Void</Button>}
                    {owner && <Button size="sm" variant="danger" className="flex-1" onClick={() => hardDelete(d)}>Delete</Button>}
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-slate-400">🔒 Older than 2 days — admin only</div>
                )}
                {owner && hist.length > 0 && (
                  <div className="mt-2">
                    <button onClick={() => setHistoryOf(historyOf === d.id ? null : d.id)} className="text-xs font-bold text-blue-600">{historyOf === d.id ? 'Hide edit log' : `Edit log (${hist.length})`}</button>
                    {historyOf === d.id && (
                      <div className="mt-1.5 space-y-1">
                        {hist.map((l, i) => (
                          <div key={l.id || i} className="text-[11px] bg-slate-50 rounded px-2 py-1 text-slate-500"><b className="text-slate-600">{l.action}</b> {l.detail} · <b>{l.by}</b> · {new Date(l.ts).toLocaleString('en-IN')}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={() => setEditing(null)}>
          <Card className="p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Edit · {editing.finishedName || editing.productName}</FieldLabel>
            <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1.5" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
            <div><FieldLabel>Quantity</FieldLabel><div className="mt-1.5"><NumberStepper value={editQty} onChange={setEditQty} /></div></div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 !bg-amber-600" onClick={saveEdit}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
