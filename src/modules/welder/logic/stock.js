/**
 * Raw-material stock — pure, DERIVED (never stored as a mutable number):
 *   stock(material) = Σ receipts − Σ (dispatch qty × product recipe) + adjustments
 * Computed on the fly from current data, so voids/edits/recipe fixes are always
 * reflected and there is no double-counting. Stock is kept in PIECES; weight is
 * shown as an equivalent (pieces × avg weight).
 */
const num = (v) => Number(v) || 0

/** Pieces implied by a weight (rounded to whole), 0 if no avg weight. */
export const piecesFromWeight = (avgWeight, weight) => num(avgWeight) > 0 ? Math.round(num(weight) / num(avgWeight)) : 0
/** Expected weight for a piece count (recheck helper). */
export const weightFromPieces = (avgWeight, pieces) => num(avgWeight) * num(pieces)

/** % the lot avg weight deviates from the standard (0 if either is 0). */
export function avgDeviationPct(standardAvg, lotAvg) {
  const s = num(standardAvg), l = num(lotAvg)
  if (s <= 0 || l <= 0) return 0
  return Math.abs(l - s) / s * 100
}

export const recipeOf = (product) => (product && Array.isArray(product.recipe) ? product.recipe : [])

/** Effective cost of ONE piece: weight materials use ₹/kg × avg weight (in kg);
 *  number materials use ₹/piece. */
export function effPieceCost(c) {
  const avgKg = (c.weightUnit === 'gm' ? num(c.avgWeight) / 1000 : num(c.avgWeight))
  return (c.measureBy === 'weight' && num(c.costPerKg)) ? avgKg * num(c.costPerKg) : num(c.unitCost)
}

/**
 * Stock map keyed by componentId.
 * @param components master list
 * @param receipts   stock-IN list
 * @param dispatches welder dispatches (consumption source; qty>0 only)
 * @param products   product master (for recipes; matched to dispatch by name)
 */
export function computeStock(components, receipts, dispatches, products, adjustments = []) {
  const map = {}
  for (const c of components) {
    map[c.id] = {
      id: c.id, name: c.name, category: c.category || '',
      measureBy: c.measureBy || 'number', avgWeight: num(c.avgWeight), weightUnit: c.weightUnit || 'kg',
      reorderLevel: num(c.reorderLevel), unitCost: num(c.unitCost), costPerKg: num(c.costPerKg), supplierName: c.supplierName || '',
      received: 0, used: 0, adjusted: 0, stock: 0, weightEquiv: 0, value: 0, negative: false, reorder: false,
    }
  }
  for (const r of receipts) {
    if (map[r.componentId]) map[r.componentId].received += num(r.qty)
  }
  for (const a of (adjustments || [])) {
    if (map[a.componentId]) map[a.componentId].adjusted += num(a.delta)
  }
  const prodByName = {}
  for (const p of products) prodByName[p.name] = p
  for (const d of dispatches) {
    if (!(num(d.qty) > 0)) continue
    const p = prodByName[d.productName]
    if (!p) continue
    for (const r of recipeOf(p)) {
      if (map[r.componentId]) map[r.componentId].used += num(r.qty) * num(d.qty)
    }
  }
  for (const id in map) {
    const m = map[id]
    m.stock = m.received - m.used + m.adjusted
    m.weightEquiv = m.stock * m.avgWeight
    m.value = Math.max(0, m.stock) * effPieceCost(m)
    m.negative = m.stock < 0
    m.reorder = m.reorderLevel > 0 && m.stock <= m.reorderLevel
  }
  return map
}

/**
 * Immutable stock transaction log — DERIVED from the source records, never a
 * mutable stored balance. Every movement becomes one entry:
 *   INCOMING (receipts) · AUTO_DEDUCT (production × recipe) · MANUAL_ADJUSTMENT
 *   (set-offs). Sum of qty per material === current stock.
 * Fields: material, qty (+in/−out), unit, transactionType, referenceProduct,
 *   referenceChallan, createdBy, createdAt, remark.
 */
export function stockTransactions(components, receipts, dispatches, products, adjustments = []) {
  const compById = Object.fromEntries(components.map(c => [c.id, c]))
  const prodByName = {}; for (const p of products) prodByName[p.name] = p
  const txns = []
  for (const r of receipts) {
    const c = compById[r.componentId]
    txns.push({
      id: `in_${r.id}`, materialId: r.componentId, material: r.componentName || c?.name || '??',
      qty: num(r.qty), unit: 'pcs', transactionType: 'INCOMING', referenceProduct: '', referenceChallan: '',
      createdBy: r.by || '', createdAt: r.createdAt || r.date || '', remark: r.note || (r.flagged ? '⚑ avg-wt flagged' : ''),
    })
  }
  for (const d of dispatches) {
    if (!(num(d.qty) > 0)) continue
    const p = prodByName[d.productName]; if (!p) continue
    for (const r of recipeOf(p)) {
      const c = compById[r.componentId]; if (!c) continue
      txns.push({
        id: `de_${d.id}_${r.componentId}`, materialId: r.componentId, material: c.name,
        qty: -(num(r.qty) * num(d.qty)), unit: 'pcs', transactionType: 'AUTO_DEDUCT',
        referenceProduct: d.productName, referenceChallan: d.welderChallan || '',
        createdBy: d.createdByRole || d.welder || '', createdAt: d.createdAt || d.date || '', remark: '',
      })
    }
  }
  for (const a of adjustments) {
    const c = compById[a.componentId]
    txns.push({
      id: `ad_${a.id}`, materialId: a.componentId, material: a.componentName || c?.name || '??',
      qty: num(a.delta), unit: 'pcs', transactionType: 'MANUAL_ADJUSTMENT', referenceProduct: '', referenceChallan: '',
      createdBy: a.by || '', createdAt: a.createdAt || a.date || '', remark: a.reason || '',
    })
  }
  return txns.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

/** Materials at/below reorder level or negative — "order now", most urgent first. */
export function reorderList(stockMap) {
  return Object.values(stockMap)
    .filter(m => m.reorder || m.negative)
    .sort((a, b) => (a.stock - a.reorderLevel) - (b.stock - b.reorderLevel))
}

/** Material cost to make one piece of a product (Σ recipe qty × per-piece cost). */
export function materialCostOf(product, components) {
  const cost = Object.fromEntries(components.map(c => [c.id, effPieceCost(c)]))
  return recipeOf(product).reduce((s, r) => s + num(r.qty) * (cost[r.componentId] || 0), 0)
}
