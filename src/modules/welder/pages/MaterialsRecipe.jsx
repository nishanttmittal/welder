/**
 * Materials & Recipe (Admin only) — define raw materials and set each welded
 * product's recipe (which raw materials × how many per piece). Stock auto-deducts
 * from these recipes as welders record production. Measured by pieces or weight.
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, Select, TextInput, NumberInput, SearchBar, useToast, Toast } from '../../../core/ui'
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
  const blank = { name: '', category: '', measureBy: 'number', avgWeight: '', weightUnit: 'kg', reorderLevel: '', unitCost: '', costPerKg: '', supplierName: '' }
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
      reorderLevel: Number(f.reorderLevel) || 0, unitCost: Number(f.unitCost) || 0, costPerKg: Number(f.costPerKg) || 0, supplierName: f.supplierName.trim(),
    }
    if (editId) { components.update(editId, rec); log('MATERIAL_EDIT', name, by) }
    else { components.insert(rec); log('MATERIAL_ADD', name, by) }
    show('Saved ✓'); setF(blank); setEditId(null)
  }
  const edit = (c) => { setEditId(c.id); setF({ name: c.name, category: c.category || '', measureBy: c.measureBy || 'number', avgWeight: c.avgWeight || '', weightUnit: c.weightUnit || 'kg', reorderLevel: c.reorderLevel || '', unitCost: c.unitCost || '', costPerKg: c.costPerKg || '', supplierName: c.supplierName || '' }) }
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
            <div><FieldLabel>Avg weight / piece</FieldLabel><NumberInput className="mt-1" inputMode="decimal" step="0.001" placeholder="e.g. 0.037" value={f.avgWeight} onChange={e => set('avgWeight', e.target.value)} /></div>
            <div><FieldLabel>Unit</FieldLabel><Select className="mt-1" value={f.weightUnit} onChange={e => set('weightUnit', e.target.value)} options={[{ value: 'kg', label: 'kg' }, { value: 'gm', label: 'gm' }]} /></div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><FieldLabel>Reorder at</FieldLabel><NumberInput className="mt-1" value={f.reorderLevel} onChange={e => set('reorderLevel', e.target.value)} /></div>
          {f.measureBy === 'weight'
            ? <div><FieldLabel>₹ / kg</FieldLabel><NumberInput className="mt-1" inputMode="decimal" step="0.01" value={f.costPerKg} onChange={e => set('costPerKg', e.target.value)} /></div>
            : <div><FieldLabel>₹ / piece</FieldLabel><NumberInput className="mt-1" inputMode="decimal" step="0.01" value={f.unitCost} onChange={e => set('unitCost', e.target.value)} /></div>}
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

/* ── Product Recipes (Fitting-style: each product shows its name + recipe) ──── */
function Recipes({ products, components, log, show, by }) {
  const [editId, setEditId] = useState(null)
  const [pSearch, setPSearch] = useState('')
  const sorted = [...products.list].sort((a, b) => a.name.localeCompare(b.name))
  const term = pSearch.trim().toLowerCase()
  const shown = sorted.filter(p => !term || p.name.toLowerCase().includes(term))
  const byId = Object.fromEntries(components.list.map(c => [c.id, c]))

  return (
    <Card className="p-4 space-y-3">
      <FieldLabel>Product Recipes</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Tap a product → add raw materials (like toppings) → set how many per piece.</p>
      {sorted.length > 6 && <SearchBar value={pSearch} onChange={setPSearch} placeholder={`Search ${sorted.length} products…`} />}
      <div className="space-y-2 max-h-[65vh] overflow-auto">
        {shown.map(p => (
          <div key={p.id} className="bg-slate-50 rounded-xl p-3">
            {editId === p.id ? (
              <RecipeEditor product={p} components={components.list}
                onCancel={() => setEditId(null)}
                onSave={(recipe) => { products.update(p.id, { recipe }); log('RECIPE', `${p.name}: ${recipe.length} material/s`, by); show('Recipe saved ✓'); setEditId(null) }} />
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-slate-800 truncate">{p.name}{p.welder ? <span className="text-xs font-normal text-slate-400"> · {p.welder}</span> : ''}</span>
                  <button onClick={() => setEditId(p.id)} className="text-blue-600 text-xs font-bold px-2 flex-shrink-0">Edit recipe</button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {recipeOf(p).length === 0
                    ? <span className="text-xs text-amber-600">No recipe set</span>
                    : recipeOf(p).map((r, i) => <span key={i} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-600">{byId[r.componentId]?.name || '??'} × {r.qty}</span>)}
                </div>
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-slate-400">No products.</p>}
      </div>
    </Card>
  )
}

/** Toppings-style recipe picker for ONE product (like Fitting). */
function RecipeEditor({ product, components, onCancel, onSave }) {
  const [recipe, setRecipe] = useState(() => {
    const m = {}
    ;(product.recipe || []).forEach(r => { if (r.componentId) m[r.componentId] = String(Number(r.qty) || '') })
    return m
  })
  const inRecipe = (id) => Object.prototype.hasOwnProperty.call(recipe, id)
  const add = (id) => setRecipe(r => ({ ...r, [id]: r[id] || '1' }))
  const remove = (id) => setRecipe(r => { const n = { ...r }; delete n[id]; return n })
  const setVal = (id, v) => setRecipe(r => ({ ...r, [id]: v }))
  const byName = (a, b) => a.name.localeCompare(b.name)
  const selected = components.filter(c => inRecipe(c.id)).sort(byName)
  const available = components.filter(c => !inRecipe(c.id)).sort(byName)
  const save = () => onSave(Object.entries(recipe).filter(([, v]) => Number(v) > 0).map(([componentId, v]) => ({ componentId, qty: Number(v) })))

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-slate-800 truncate">Recipe · {product.name}</span>
        <button onClick={onCancel} className="text-slate-500 text-xs font-bold px-1 flex-shrink-0">Cancel</button>
      </div>
      <p className="text-[11px] text-slate-400 mt-0.5">How many of each raw material go into ONE piece.</p>
      {selected.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {selected.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{c.name}</span>
              <NumberInput className="!w-16 text-center !py-1 !px-2" inputMode="decimal" step="0.001" value={recipe[c.id]} onChange={e => setVal(c.id, e.target.value)} />
              <span className="text-[11px] text-slate-400">/pc</span>
              <button onClick={() => remove(c.id)} className="text-red-500 font-bold px-1 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-slate-400 mb-1">Tap to add a raw material:</div>
          <div className="flex flex-wrap gap-1.5">
            {available.map(c => <button key={c.id} onClick={() => add(c.id)} className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1">＋ {c.name}</button>)}
          </div>
        </div>
      )}
      {components.length === 0 && <p className="text-sm text-amber-600 mt-2">Add raw materials in the section above first.</p>}
      <Button variant="primary" className="w-full mt-3 !bg-amber-600" onClick={save}>Save recipe</Button>
    </div>
  )
}
