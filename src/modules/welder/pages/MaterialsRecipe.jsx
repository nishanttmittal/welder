/**
 * Materials & Recipe (Admin only) — define raw materials and set each welded
 * product's recipe (which raw materials × how many per piece). Stock auto-deducts
 * from these recipes as welders record production. Measured by pieces or weight.
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, Select, TextInput, NumberInput, useToast, Toast } from '../../../core/ui'
import { useWelder } from '../WelderContext'
import { recipeOf } from '../logic/stock'

const MEASURE = [{ value: 'number', label: 'Number (pieces)' }, { value: 'weight', label: 'Weight' }]

export default function MaterialsRecipe({ by = 'owner' }) {
  const { components, products, log } = useWelder()
  const { msg, show } = useToast()
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Materials components={components} log={log} show={show} by={by} />
      <Recipes products={products} components={components} log={log} show={show} by={by} />
    </div>
  )
}

/* ── Raw materials master ────────────────────────────────────────────────── */
function Materials({ components, log, show, by }) {
  const blank = { name: '', category: '', measureBy: 'number', avgWeight: '', weightUnit: 'kg', reorderLevel: '', unitCost: '', supplierName: '' }
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const set = (k, v) => setF({ ...f, [k]: v })

  const save = () => {
    const name = f.name.trim()
    if (!name) return show('Enter a material name', 2000)
    if (components.list.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editId)) return show('Already exists', 2000)
    const rec = {
      name, category: f.category.trim(), measureBy: f.measureBy,
      avgWeight: Number(f.avgWeight) || 0, weightUnit: f.weightUnit || 'kg',
      reorderLevel: Number(f.reorderLevel) || 0, unitCost: Number(f.unitCost) || 0, supplierName: f.supplierName.trim(),
    }
    if (editId) { components.update(editId, rec); log('MATERIAL_EDIT', name, by) }
    else { components.insert(rec); log('MATERIAL_ADD', name, by) }
    show('Saved ✓'); setF(blank); setEditId(null)
  }
  const edit = (c) => { setEditId(c.id); setF({ name: c.name, category: c.category || '', measureBy: c.measureBy || 'number', avgWeight: c.avgWeight || '', weightUnit: c.weightUnit || 'kg', reorderLevel: c.reorderLevel || '', unitCost: c.unitCost || '', supplierName: c.supplierName || '' }) }
  const del = (c) => { if (confirm(`Delete material "${c.name}"?`)) { components.remove(c.id); log('MATERIAL_DEL', c.name, by) } }

  return (
    <Card className="p-4 space-y-3">
      <FieldLabel>Raw Materials ({components.list.length})</FieldLabel>
      <div className="space-y-2 bg-slate-50 rounded-xl p-3">
        <TextInput placeholder="Material name" value={f.name} onChange={e => set('name', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <TextInput placeholder="Category (optional)" value={f.category} onChange={e => set('category', e.target.value)} />
          <Select value={f.measureBy} onChange={e => set('measureBy', e.target.value)} options={MEASURE} />
        </div>
        {f.measureBy === 'weight' && (
          <div className="grid grid-cols-2 gap-2">
            <div><FieldLabel>Avg weight / piece</FieldLabel><NumberInput className="mt-1" value={f.avgWeight} onChange={e => set('avgWeight', e.target.value)} /></div>
            <div><FieldLabel>Weight unit</FieldLabel><TextInput className="mt-1" value={f.weightUnit} onChange={e => set('weightUnit', e.target.value)} /></div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><FieldLabel>Reorder at</FieldLabel><NumberInput className="mt-1" value={f.reorderLevel} onChange={e => set('reorderLevel', e.target.value)} /></div>
          <div><FieldLabel>₹/piece</FieldLabel><NumberInput className="mt-1" value={f.unitCost} onChange={e => set('unitCost', e.target.value)} /></div>
          <div><FieldLabel>Supplier</FieldLabel><TextInput className="mt-1" value={f.supplierName} onChange={e => set('supplierName', e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          {editId && <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setF(blank); setEditId(null) }}>Cancel</Button>}
          <Button size="sm" variant="primary" className="flex-1" onClick={save}>{editId ? 'Update material' : '+ Add material'}</Button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-auto">
        {[...components.list].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name)).map(c => (
          <div key={c.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 truncate">{c.name}</div>
              <div className="text-[11px] text-slate-400">{c.category ? c.category + ' · ' : ''}{c.measureBy === 'weight' ? `by weight · ${c.avgWeight || 0}${c.weightUnit}/pc` : 'by pieces'}{c.reorderLevel ? ` · reorder ${c.reorderLevel}` : ''}</div>
            </div>
            <button onClick={() => edit(c)} className="text-blue-600 text-xs font-bold px-1">Edit</button>
            <button onClick={() => del(c)} className="text-red-500 font-bold px-1">✕</button>
          </div>
        ))}
        {components.list.length === 0 && <p className="text-sm text-slate-400">No raw materials yet.</p>}
      </div>
    </Card>
  )
}

/* ── Recipe per product ──────────────────────────────────────────────────── */
function Recipes({ products, components, log, show, by }) {
  const sorted = [...products.list].sort((a, b) => a.name.localeCompare(b.name))
  const [pid, setPid] = useState(sorted[0]?.id || '')
  const product = products.list.find(p => p.id === pid)
  const [recipe, setRecipe] = useState(() => recipeOf(product).map(r => ({ ...r })))
  const [loadedFor, setLoadedFor] = useState(pid)

  // reload recipe when product changes
  if (pid !== loadedFor) { setRecipe(recipeOf(product).map(r => ({ ...r }))); setLoadedFor(pid) }

  const byId = Object.fromEntries(components.list.map(c => [c.id, c]))
  const inRecipe = new Set(recipe.map(r => r.componentId))
  const available = components.list.filter(c => !inRecipe.has(c.id))

  const add = (cid) => setRecipe([...recipe, { componentId: cid, qty: 1 }])
  const setQty = (cid, v) => setRecipe(recipe.map(r => r.componentId === cid ? { ...r, qty: v } : r))
  const remove = (cid) => setRecipe(recipe.filter(r => r.componentId !== cid))
  const save = () => {
    const clean = recipe.filter(r => r.componentId && Number(r.qty) > 0).map(r => ({ componentId: r.componentId, qty: Number(r.qty) }))
    products.update(pid, { recipe: clean })
    log('RECIPE', `${product?.name}: ${clean.length} material/s`, by)
    show('Recipe saved ✓')
  }

  return (
    <Card className="p-4 space-y-3">
      <FieldLabel>Product Recipe</FieldLabel>
      <Select value={pid} onChange={e => setPid(e.target.value)} options={sorted.map(p => ({ value: p.id, label: p.name + (p.welder ? ` (${p.welder})` : '') }))} />
      {!product ? <p className="text-sm text-slate-400">Pick a product.</p> : (
        <>
          <p className="text-xs text-slate-400">Raw materials used to make ONE piece of {product.name}:</p>
          <div className="space-y-1.5">
            {recipe.length === 0 && <p className="text-sm text-slate-400">No materials in this recipe yet.</p>}
            {recipe.map(r => (
              <div key={r.componentId} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{byId[r.componentId]?.name || 'Unknown'}</span>
                <NumberInput className="w-20 text-center !py-1.5" value={r.qty} onChange={e => setQty(r.componentId, e.target.value)} />
                <span className="text-[11px] text-slate-400">/pc</span>
                <button onClick={() => remove(r.componentId)} className="text-red-500 font-bold px-1">✕</button>
              </div>
            ))}
          </div>
          {available.length > 0 && (
            <div>
              <FieldLabel>Add a material</FieldLabel>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {available.map(c => (
                  <button key={c.id} onClick={() => add(c.id)} className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1">＋ {c.name}</button>
                ))}
              </div>
            </div>
          )}
          <Button variant="primary" className="w-full !bg-amber-600" onClick={save}>Save recipe</Button>
        </>
      )}
    </Card>
  )
}
