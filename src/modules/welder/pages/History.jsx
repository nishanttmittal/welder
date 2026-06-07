/**
 * Entries — view & CORRECT dispatch entries (controlled correction flow).
 *   • Manager + Owner: correct qty / product / welder / finish / party / date
 *     within EDIT_WINDOW_HOURS (48h) of creation. A reason is MANDATORY and every
 *     change is written to the audit log (old→new · who · when · reason).
 *   • After 48h: corrections are OWNER-ONLY (same audited flow).
 *   • Void = soft-reverse (qty→0, kept & logged). Owner may also hard-delete,
 *     but only with a logged reason — never silent.
 * Nothing is ever overwritten silently.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, SearchBar, Select, NumberStepper, DateInput, TextInput, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { FINISHES, finishedName, EDIT_WINDOW_HOURS } from '../config'

const within48 = (d, now) => {
  if (!d.createdAt) return true
  return (now - new Date(d.createdAt).getTime()) <= EDIT_WINDOW_HOURS * 3600 * 1000
}

export default function History({ owner = false, by = 'admin' }) {
  const { dispatches, products, welders, parties, logs, log } = useWelder()
  const { msg, show } = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [historyOf, setHistoryOf] = useState(null)
  const now = Date.now()

  // Manager/Owner edit within 48h; Owner anytime.
  const canEdit = (d) => owner || within48(d, now)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return dispatches.list
      .filter(d => !term || (d.finishedName || d.productName || '').toLowerCase().includes(term) || (d.welder || '').toLowerCase().includes(term) || (d.party || '').toLowerCase().includes(term) || (d.date || '').includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [dispatches.list, q])

  const saveEdit = (patch, changes, reason) => {
    dispatches.update(editing.id, patch)
    const detail = changes.map(c => `${c.field}: ${c.old}→${c.new}`).join(', ') + ` · reason: ${reason}`
    log('EDIT', detail, by, editing.id)
    show('Corrected ✓'); setEditing(null)
  }
  const voidEntry = (d) => {
    const reason = prompt(`Void "${d.finishedName || d.productName} × ${d.qty}" (set to 0, kept in history)?\nReason:`)
    if (reason === null) return
    if (!reason.trim()) return show('Reason required', 2500)
    log('VOID', `${d.finishedName || d.productName} × ${d.qty} → 0 · reason: ${reason.trim()}`, by, d.id)
    dispatches.update(d.id, { qty: 0 })
    show('Voided ✓')
  }
  const hardDelete = (d) => {
    const reason = prompt(`PERMANENTLY DELETE "${d.finishedName || d.productName} × ${d.qty}"?\nThis cannot be undone. Reason (required):`)
    if (reason === null) return
    if (!reason.trim()) return show('Reason required — not deleted', 2500)
    log('DELETE', `${d.finishedName || d.productName} × ${d.qty} (hard delete) · reason: ${reason.trim()}`, by, d.id)
    dispatches.remove(d.id); show('Deleted ✓')
  }
  const entryHistory = (id) => logs.list.filter(l => l.ref === id).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <SearchBar value={q} onChange={setQ} placeholder="Search product / welder / party / date…" />
      {!owner && <p className="text-xs text-slate-400 -mt-1">You can correct entries within {EDIT_WINDOW_HOURS} hours. Older entries are owner-only.</p>}
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
                    <div className="text-xs text-slate-400 mt-0.5">{fmtDate(d.date)} · {d.welder} → {d.party}{d.welderChallan ? ` · ${d.welderChallan}` : ''}</div>
                  </div>
                  <span className={`font-mono font-bold text-lg ${voided ? 'text-slate-400' : 'text-amber-700'}`}>{voided ? 'void' : `× ${fmtNum(d.qty)}`}</span>
                </div>
                {editable ? (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="neutral" className="flex-1" onClick={() => setEditing(d)}>Correct</Button>
                    {!voided && <Button size="sm" variant="ghost" className="flex-1" onClick={() => voidEntry(d)}>Void</Button>}
                    {owner && <Button size="sm" variant="danger" className="flex-1" onClick={() => hardDelete(d)}>Delete</Button>}
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-slate-400">🔒 Older than {EDIT_WINDOW_HOURS}h — owner only</div>
                )}
                {owner && hist.length > 0 && (
                  <div className="mt-2">
                    <button onClick={() => setHistoryOf(historyOf === d.id ? null : d.id)} className="text-xs font-bold text-blue-600">{historyOf === d.id ? 'Hide audit log' : `Audit log (${hist.length})`}</button>
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
        <EditModal entry={editing} products={products.list} welders={welders.list} parties={parties.list}
          onCancel={() => setEditing(null)} onSave={saveEdit} />
      )}
    </div>
  )
}

/** Correction modal — all six fields, mandatory reason, diff preview. */
function EditModal({ entry, products, welders, parties, onCancel, onSave }) {
  const [welder, setWelder] = useState(entry.welder || '')
  const [product, setProduct] = useState(entry.productName || '')
  const [finish, setFinish] = useState(entry.finish || 'chrome')
  const [party, setParty] = useState(entry.party || '')
  const [qty, setQty] = useState(String(entry.qty ?? ''))
  const [date, setDate] = useState(entry.date || '')
  const [reason, setReason] = useState('')

  const fields = [
    { field: 'welder',  new: welder,            old: entry.welder },
    { field: 'product', new: product,           old: entry.productName },
    { field: 'finish',  new: finish,            old: entry.finish },
    { field: 'party',   new: party,             old: entry.party },
    { field: 'qty',     new: Number(qty) || 0,  old: Number(entry.qty) || 0 },
    { field: 'date',    new: date,              old: entry.date },
  ]
  const changes = fields.filter(f => String(f.new) !== String(f.old))
  const canSave = changes.length > 0 && reason.trim()

  const save = () => {
    if (!canSave) return
    const patch = {
      welder, productName: product, finish, finishedName: finishedName(product, finish),
      party, qty: Number(qty) || 0, date,
    }
    onSave(patch, changes, reason.trim())
  }

  const prodOpts = [...new Set([product, ...products.map(p => p.name)])].filter(Boolean).map(n => ({ value: n, label: n }))
  const welderOpts = [...new Set([welder, ...welders.map(w => w.name)])].filter(Boolean).map(n => ({ value: n, label: n }))
  const partyOpts = [...new Set([party, ...parties.map(p => p.name)])].filter(Boolean).map(n => ({ value: n, label: n }))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={onCancel}>
      <Card className="p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <FieldLabel>Correct entry · <span className="font-mono">{entry.welderChallan || ''}</span></FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Welder</FieldLabel><Select className="mt-1" value={welder} onChange={e => setWelder(e.target.value)} options={welderOpts} /></div>
          <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><FieldLabel>Product</FieldLabel><Select className="mt-1" value={product} onChange={e => setProduct(e.target.value)} options={prodOpts} /></div>
          <div><FieldLabel>Finish</FieldLabel><Select className="mt-1" value={finish} onChange={e => setFinish(e.target.value)} options={FINISHES.map(f => ({ value: f.key, label: f.label }))} /></div>
          <div><FieldLabel>Sent to</FieldLabel><Select className="mt-1" value={party} onChange={e => setParty(e.target.value)} options={partyOpts} /></div>
          <div><FieldLabel>Quantity</FieldLabel><div className="mt-1"><NumberStepper value={qty} onChange={setQty} /></div></div>
        </div>
        <div>
          <FieldLabel>Reason for change <span className="text-red-400 normal-case font-normal">(required)</span></FieldLabel>
          <TextInput className="mt-1" placeholder="e.g. wrong product picked" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        {changes.length > 0 && (
          <div className="text-[11px] bg-amber-50 rounded-lg px-3 py-2 text-amber-700">
            Changing: {changes.map(c => c.field).join(', ')}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" className="flex-1 !bg-amber-600" disabled={!canSave} onClick={save}>Save correction</Button>
        </div>
      </Card>
    </div>
  )
}
