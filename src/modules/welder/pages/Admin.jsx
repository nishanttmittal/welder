/**
 * Admin — manage the master lists (products / welders / parties), back up data,
 * and view the activity log. Adding a product makes it available in ALL finishes
 * automatically (the finish is applied at entry time).
 */
import { useRef, useState } from 'react'
import { Button, Card, FieldLabel, TextInput, useToast, Toast } from '../../../core/ui'
import { useWelder } from '../WelderContext'

/** Reusable add/list/delete for a simple {name} collection. */
function ManageList({ title, repo, hint, log, logKey }) {
  const { msg, show } = useToast()
  const [name, setName] = useState('')
  const add = () => {
    const nm = name.trim()
    if (!nm) return show('Enter a name', 2000)
    if (repo.list.some(x => x.name.toLowerCase() === nm.toLowerCase())) return show('Already exists', 2000)
    repo.insert({ name: nm, order: repo.list.length })
    log(`ADD_${logKey}`, nm, 'admin'); show('Added ✓'); setName('')
  }
  const del = (x) => { if (confirm(`Delete "${x.name}"?`)) { repo.remove(x.id); log(`DEL_${logKey}`, x.name, 'admin') } }
  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>{title} ({repo.list.length})</FieldLabel>
      {hint && <p className="text-xs text-slate-400 -mt-1">{hint}</p>}
      <div className="flex gap-2">
        <TextInput placeholder={`New ${title.toLowerCase()}`} value={name} onChange={e => setName(e.target.value)} />
        <Button variant="primary" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[...repo.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(x => (
          <span key={x.id} className="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700">
            {x.name}<button onClick={() => del(x)} className="text-red-500 font-bold">✕</button>
          </span>
        ))}
      </div>
    </Card>
  )
}

function DataTools() {
  const { dispatches, products, welders, parties, logs, log } = useWelder()
  const { msg, show } = useToast()
  const fileRef = useRef(null)

  const backup = () => {
    const data = { app: 'welder', exportedAt: new Date().toISOString(),
      dispatches: dispatches.list, products: products.list, welders: welders.list, parties: parties.list, logs: logs.list }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `welder-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
    show('Backup downloaded ✓')
  }
  const restore = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try {
      const data = JSON.parse(await f.text())
      if (!confirm('Restore will REPLACE all current data. Continue?')) return
      await dispatches.replaceAll(data.dispatches || [])
      await products.replaceAll(data.products || [])
      await welders.replaceAll(data.welders || [])
      await parties.replaceAll(data.parties || [])
      log('RESTORE', f.name, 'admin'); show('Restored ✓')
    } catch { show('Invalid backup file', 3000) } finally { if (fileRef.current) fileRef.current.value = '' }
  }
  const resetDispatches = async () => {
    if (!confirm('Delete ALL dispatch entries? Master lists stay. Cannot be undone.')) return
    await dispatches.reset(); log('RESET', 'Cleared dispatches', 'admin'); show('Cleared ✓')
  }
  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Backup &amp; Reset</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={backup}>⬇ Backup</Button>
        <Button variant="neutral" onClick={() => fileRef.current?.click()}>⬆ Restore</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={restore} />
      <Button variant="danger" className="w-full" onClick={resetDispatches}>Clear all dispatches</Button>
    </Card>
  )
}

function Logs() {
  const { logs } = useWelder()
  const recent = [...logs.list].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 40)
  return (
    <Card className="p-5">
      <FieldLabel>Activity Log</FieldLabel>
      {recent.length === 0 ? <p className="text-sm text-slate-400 mt-3">No activity yet.</p> : (
        <div className="mt-3 space-y-1.5 max-h-80 overflow-auto">
          {recent.map((l, i) => (
            <div key={l.id || i} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-bold text-slate-600">{l.action}</span><span className="text-slate-500"> · {l.detail}</span>
              <div className="text-slate-300">{new Date(l.ts).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Admin() {
  const { products, welders, parties, log } = useWelder()
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <ManageList title="Products" repo={products} log={log} logKey="PRODUCT" hint="Each product is auto-available in all finishes (Chrome/Powder/Gold/Rose Gold)." />
      <ManageList title="Welders" repo={welders} log={log} logKey="WELDER" />
      <ManageList title="Parties" repo={parties} log={log} logKey="PARTY" hint="Where material is sent: job-work persons / departments." />
      <DataTools />
      <Logs />
    </div>
  )
}
