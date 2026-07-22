/**
 * Incoming Advances — advances pushed from the UNICO Hisab app (owner records an
 * advance there, targets a welder, and it lands here to ACCEPT). Accepting writes
 * the SAME advance the Hisab/Advances screen writes:
 *   ledger { type:'advance', direction:'credit' }  ← credit = advance paid (pay.js)
 * and marks the outbox doc accepted. Nothing is written to the ledger until the
 * owner taps Accept. Owner-only.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../core/db/firebase'
import { Button, Card, useToast, Toast } from '../../../core/ui'
import { fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))

export default function IncomingAdvances({ by = 'owner' }) {
  const { ledger, welders, log } = useWelder()
  const { msg, show } = useToast()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!db) return
    const q = query(collection(db, 'hisab_advance_outbox'), where('target', '==', 'welder'), where('status', '==', 'pending'))
    return onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setRows([]))
  }, [])

  const known = (name) => (welders.list || []).some((w) => (w.name || w) === name)

  const accept = async (r) => {
    if (busy) return
    if (!known(r.name)) { show(`No welder named "${r.name}" — add them first`); return }
    if (!confirm(`Accept advance of ${money(r.amount)} for ${r.name}? It will be added to his ledger.`)) return
    setBusy(r.id)
    try {
      ledger.insert({ contractor: r.name, date: r.date || new Date().toISOString().slice(0, 10),
        type: 'advance', direction: 'credit', amount: Number(r.amount) || 0,
        note: `via Hisab${r.note ? ': ' + r.note : ''}`, createdBy: 'Hisab→Accept', reversed: false })
      await updateDoc(doc(db, 'hisab_advance_outbox', r.id), { status: 'accepted', acceptedAt: new Date().toISOString() })
      log('ADV_INBOX_ACCEPT', `${r.name} advance ${money(r.amount)} accepted from Hisab`, by)
      show('Accepted ✓')
    } catch (e) { show('Failed: ' + e.message) }
    setBusy('')
  }

  const dismiss = async (r) => {
    if (!confirm(`Dismiss this advance of ${money(r.amount)} for ${r.name}? (It won't be added.)`)) return
    try {
      await updateDoc(doc(db, 'hisab_advance_outbox', r.id), { status: 'dismissed', dismissedAt: new Date().toISOString() })
      log('ADV_INBOX_DISMISS', `${r.name} advance ${money(r.amount)} dismissed`, by)
      show('Dismissed')
    } catch (e) { show('Failed: ' + e.message) }
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <p className="text-sm text-slate-500">Advances pushed from the <b>UNICO Hisab</b> app. Accept to add to the welder&apos;s ledger.</p>
      {rows.length === 0 && <Card className="p-6 text-center text-slate-400 text-sm">No incoming advances.</Card>}
      {rows.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800 text-lg">{r.name}</div>
              <div className="text-xs text-slate-400">{fmtDate(r.date)}{r.note ? ' · ' + r.note : ''}</div>
            </div>
            <div className="text-2xl font-extrabold text-rose-600">{money(r.amount)}</div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1" onClick={() => dismiss(r)}>Dismiss</Button>
            <Button variant="success" className="flex-1" disabled={busy === r.id} onClick={() => accept(r)}>{busy === r.id ? 'Accepting…' : 'Accept'}</Button>
          </div>
        </Card>
      ))}
      <Toast msg={msg} />
    </div>
  )
}
