/**
 * Admin — manage the master lists (products / welders / parties), back up data,
 * and view the activity log. Adding a product makes it available in ALL finishes
 * automatically (the finish is applied at entry time).
 */
import { useRef, useState } from 'react'
import { Button, Card, FieldLabel, TextInput, Select, useToast, Toast } from '../../../core/ui'
import { useWelder } from '../WelderContext'
import { OWNER_EMAILS, FINISHES, finishedName } from '../config'

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

/** Type-to-confirm so a stray tap can never delete data. */
function confirmDelete(what) {
  const t = window.prompt(`To delete ${what}, type DELETE below and press OK:`)
  return t !== null && t.trim().toUpperCase() === 'DELETE'
}

function DataTools() {
  const { dispatches, products, welders, parties, platingOutbox, rates, payments, ledger, users, components, receipts, logs, log } = useWelder()
  const { msg, show } = useToast()
  const fileRef = useRef(null)

  // Back up EVERYTHING (every collection in the app).
  const backup = () => {
    const data = {
      app: 'welder', version: 3, exportedAt: new Date().toISOString(),
      dispatches: dispatches.list, products: products.list, welders: welders.list, parties: parties.list,
      rates: rates.list, payments: payments.list, ledger: ledger.list, users: users.list,
      components: components.list, receipts: receipts.list, platingOutbox: platingOutbox.list, logs: logs.list,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `welder-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    show('Full backup downloaded ✓')
  }
  const restore = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try {
      const data = JSON.parse(await f.text())
      if (!confirm('Restore will REPLACE all current data with the backup. Continue?')) return
      const map = { dispatches, products, welders, parties, rates, payments, ledger, users, components, receipts, platingOutbox }
      for (const [k, repo] of Object.entries(map)) { if (Array.isArray(data[k])) await repo.replaceAll(data[k]) }
      log('RESTORE', f.name, 'admin'); show('Restored ✓')
    } catch { show('Invalid backup file', 3000) } finally { if (fileRef.current) fileRef.current.value = '' }
  }
  const resetDispatches = async () => {
    if (!confirmDelete('ALL dispatch entries')) return
    await dispatches.reset(); log('RESET', 'Cleared dispatches', 'admin'); show('Cleared ✓')
  }
  const clearOutbox = async () => {
    if (!confirmDelete('the Plating Outbox list')) return
    await platingOutbox.reset(); log('RESET', 'Cleared plating outbox', 'admin'); show('Outbox cleared ✓')
  }
  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Backup &amp; Reset</FieldLabel>
      <p className="text-[11px] text-slate-400 -mt-1">Backup includes EVERYTHING — entries, rates, payments, ledger, materials, stock, users, etc.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={backup}>⬇ Backup all data</Button>
        <Button variant="neutral" onClick={() => fileRef.current?.click()}>⬆ Restore</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={restore} />
      <Button variant="neutral" className="w-full" onClick={clearOutbox}>🧹 Clear Plating Outbox list</Button>
      <Button variant="danger" className="w-full" onClick={resetDispatches}>Clear ALL dispatches (type DELETE)</Button>
      <p className="text-[11px] text-slate-400">Deletes ask you to type DELETE first, so a stray tap can’t wipe data. For precise removal use “Delete Entries (filtered)” above.</p>
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

/** Users & Access — owner manages who can sign in as Manager/Owner (Google auth). */
function ManageUsers() {
  const { users, log } = useWelder()
  const { msg, show } = useToast()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('manager')
  const add = () => {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) return show('Enter a valid email', 2000)
    if (users.list.some(u => (u.email || '').toLowerCase() === e)) return show('Already added', 2000)
    users.insert({ id: e, email: e, name: name.trim(), role, active: true })
    log('USER_ADD', `${e} as ${role}`, 'owner'); show('User added ✓'); setEmail(''); setName('')
  }
  const toggleActive = (u) => { const on = u.active !== false; users.update(u.id, { active: !on }); log(on ? 'USER_OFF' : 'USER_ON', u.email, 'owner') }
  const setRoleFor = (u, r) => { users.update(u.id, { role: r }); log('USER_ROLE', `${u.email} → ${r}`, 'owner') }
  const remove = (u) => { if (confirm(`Remove ${u.email}? They lose access.`)) { users.remove(u.id); log('USER_DEL', u.email, 'owner') } }
  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Users &amp; Access ({users.list.length})</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Managers/Owners sign in with Google. Add their Google email and role. Welders don’t need accounts.</p>
      {OWNER_EMAILS.length > 0 && <p className="text-[11px] text-emerald-600">Built-in owner (always allowed): {OWNER_EMAILS.join(', ')}</p>}
      <div className="space-y-2">
        <TextInput placeholder="email@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="flex gap-2">
          <TextInput placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
          <Select value={role} onChange={e => setRole(e.target.value)} options={[{ value: 'manager', label: 'Manager' }, { value: 'owner', label: 'Owner' }]} />
          <Button variant="primary" onClick={add}>Add</Button>
        </div>
      </div>
      <div className="space-y-2">
        {users.list.length === 0 && <p className="text-sm text-slate-400">No users added yet.</p>}
        {[...users.list].sort((a, b) => (a.email || '').localeCompare(b.email || '')).map(u => (
          <div key={u.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${u.active === false ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{u.name || u.email}</div>
              <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
            </div>
            <Select className="!py-1.5 text-xs" value={u.role || 'manager'} onChange={e => setRoleFor(u, e.target.value)} options={[{ value: 'manager', label: 'Manager' }, { value: 'owner', label: 'Owner' }]} />
            <button onClick={() => toggleActive(u)} className={`text-xs font-bold px-2 py-1 rounded-lg ${u.active === false ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>{u.active === false ? 'Off' : 'On'}</button>
            <button onClick={() => remove(u)} className="text-red-500 font-bold px-1">✕</button>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Products — common to all welders, or exclusive to one (e.g. Jitender's
 *  mechanism parts), plus a per-product "for plating" flag. */
function ManageProducts() {
  const { products, welders, dispatches, rates, log } = useWelder()
  const { msg, show } = useToast()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')      // '' = common to all welders
  const [plating, setPlating] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const ownerOpts = [{ value: '', label: 'Common (all welders)' }, ...welders.list.map(w => ({ value: w.name, label: `${w.name} only` }))]

  const add = () => {
    const nm = name.trim()
    if (!nm) return show('Enter a name', 2000)
    if (products.list.some(x => x.name.toLowerCase() === nm.toLowerCase() && (x.welder || '') === owner)) return show('Already exists', 2000)
    products.insert({ name: nm, welder: owner, noPlating: !plating, order: products.list.length })
    log('ADD_PRODUCT', `${nm}${owner ? ` (${owner} only)` : ''}${plating ? '' : ' · no-plating'}`, 'owner')
    show('Added ✓'); setName('')
  }
  const setOwnerFor = (p, w) => { products.update(p.id, { welder: w }); log('PRODUCT_OWNER', `${p.name} → ${w || 'Common'}`, 'owner') }
  const togglePlating = (p) => { const np = !p.noPlating; products.update(p.id, { noPlating: np }); log('PRODUCT_PLATING', `${p.name} ${np ? 'no-plating' : 'for plating'}`, 'owner') }
  const startEdit = (p) => { setEditId(p.id); setEditName(p.name) }
  const saveEdit = (p) => {
    const newName = editName.trim()
    if (!newName) return show('Enter a name', 2000)
    if (newName !== p.name) {
      if (products.list.some(x => x.name.toLowerCase() === newName.toLowerCase() && x.id !== p.id)) return show('That name already exists', 2000)
      products.update(p.id, { name: newName })
      // cascade to existing entries + rates so balances/pay stay correct
      let n = 0
      dispatches.list.forEach(d => { if (d.productName === p.name) { dispatches.update(d.id, { productName: newName, finishedName: finishedName(newName, d.finish) }); n++ } })
      rates.list.forEach(r => { if ((r.productName || r.product) === p.name) rates.update(r.id, { productName: newName }) })
      log('PRODUCT_RENAME', `${p.name} → ${newName} (${n} entries)`, 'owner')
      show(`Renamed in ${n} entries ✓`)
    }
    setEditId(null)
  }
  // Delete only from edit mode + must type DELETE — a stray tap can't remove it.
  const del = (p) => { if (confirmDelete(`product "${p.name}"`)) { products.remove(p.id); log('DEL_PRODUCT', p.name, 'owner'); setEditId(null) } }

  const rows = [...products.list].sort((a, b) =>
    (a.welder || '').localeCompare(b.welder || '') || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))

  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Products ({products.list.length})</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Common products show for every welder. Tag a product to one welder (e.g. Jitender’s mechanism parts) so only they see it. “For plating” off = never sent to the plating app.</p>
      <div className="space-y-2">
        <TextInput placeholder="New product name" value={name} onChange={e => setName(e.target.value)} />
        <div className="flex gap-2 items-center">
          <Select value={owner} onChange={e => setOwner(e.target.value)} options={ownerOpts} />
          <button onClick={() => setPlating(p => !p)} className={`text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap ${plating ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{plating ? 'For plating' : 'No plating'}</button>
          <Button variant="primary" onClick={add}>Add</Button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-auto">
        {rows.map(p => (
          <div key={p.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            {editId === p.id ? (
              <>
                <TextInput className="flex-1 !py-1.5" value={editName} onChange={e => setEditName(e.target.value)} />
                <button onClick={() => saveEdit(p)} className="text-xs font-bold text-white bg-emerald-600 px-2.5 py-1.5 rounded-lg">Save</button>
                <button onClick={() => del(p)} className="text-xs font-bold text-white bg-red-600 px-2.5 py-1.5 rounded-lg">Delete</button>
                <button onClick={() => setEditId(null)} className="text-xs font-bold text-slate-500 px-1">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                <button onClick={() => startEdit(p)} className="text-blue-600 text-xs font-bold px-1">Edit name</button>
                <Select className="!py-1.5 text-xs w-28" value={p.welder || ''} onChange={e => setOwnerFor(p, e.target.value)} options={ownerOpts} />
                <button onClick={() => togglePlating(p)} title="For plating?" className={`text-xs font-bold px-2 py-1 rounded-lg ${p.noPlating ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>{p.noPlating ? 'No plating' : 'Plating'}</button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Delete dispatch entries by date range + welder / product / finish / party. */
function FilteredDelete() {
  const { dispatches, welders, products, parties, log } = useWelder()
  const { msg, show } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [welderF, setWelderF] = useState('all')
  const [productF, setProductF] = useState('all')
  const [finishF, setFinishF] = useState('all')
  const [partyF, setPartyF] = useState('all')

  const match = (d) =>
    (!from || (d.date || '') >= from) && (!to || (d.date || '') <= to)
    && (welderF === 'all' || d.welder === welderF)
    && (productF === 'all' || d.productName === productF)
    && (finishF === 'all' || d.finish === finishF)
    && (partyF === 'all' || d.party === partyF)
  const matches = dispatches.list.filter(match)

  const run = () => {
    if (!matches.length) return show('No entries match these filters', 2200)
    if (!confirmDelete(`${matches.length} matching entr${matches.length > 1 ? 'ies' : 'y'}`)) return
    dispatches.removeWhere(match)
    const f = [from && `from ${from}`, to && `to ${to}`, welderF !== 'all' && welderF, productF !== 'all' && productF, finishF !== 'all' && finishF, partyF !== 'all' && partyF].filter(Boolean).join(', ') || 'all'
    log('DELETE_RANGE', `${matches.length} entries deleted (${f})`, 'owner')
    show(`Deleted ${matches.length} entries ✓`)
  }
  const sel = 'border-2 border-slate-200 rounded-xl px-2 py-2 text-sm bg-white'
  return (
    <Card className="p-5 space-y-3 border-2 border-red-200">
      <Toast msg={msg} />
      <FieldLabel>Delete Entries (filtered)</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Pick a date range and any filters, then delete the matching entries.</p>
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-xs text-slate-500">From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={`mt-1 w-full ${sel}`} /></div>
        <div><span className="text-xs text-slate-500">To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className={`mt-1 w-full ${sel}`} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={welderF} onChange={e => setWelderF(e.target.value)} options={[{ value: 'all', label: 'All welders' }, ...welders.list.map(w => ({ value: w.name, label: w.name }))]} />
        <Select value={productF} onChange={e => setProductF(e.target.value)} options={[{ value: 'all', label: 'All products' }, ...products.list.map(p => ({ value: p.name, label: p.name }))]} />
        <Select value={finishF} onChange={e => setFinishF(e.target.value)} options={[{ value: 'all', label: 'All finishes' }, ...FINISHES.map(f => ({ value: f.key, label: f.label }))]} />
        <Select value={partyF} onChange={e => setPartyF(e.target.value)} options={[{ value: 'all', label: 'All parties' }, ...parties.list.map(p => ({ value: p.name, label: p.name }))]} />
      </div>
      <button onClick={run} disabled={!matches.length} className={`w-full rounded-xl py-2.5 text-sm font-bold ${matches.length ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-400'}`}>Delete {matches.length} matching {matches.length === 1 ? 'entry' : 'entries'}</button>
    </Card>
  )
}

export default function Admin() {
  const { welders, parties, log } = useWelder()
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <ManageUsers />
      <ManageProducts />
      <ManageList title="Welders" repo={welders} log={log} logKey="WELDER" />
      <ManageList title="Parties" repo={parties} log={log} logKey="PARTY" hint="Where material is sent: job-work persons / departments." />
      <FilteredDelete />
      <DataTools />
      <Logs />
    </div>
  )
}
