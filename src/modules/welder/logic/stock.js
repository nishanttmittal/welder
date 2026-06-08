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

export const recipeOf = (product) => (product && Array.isArray(product.recipe) ? product.recipe : [])

/**
 * Stock map keyed by componentId.
 * @param components master list
 * @param receipts   stock-IN list
 * @param dispatches welder dispatches (consumption source; qty>0 only)
 * @param products   product master (for recipes; matched to dispatch by name)
 */
export function computeStock(components, receipts, dispatches, products) {
  const map = {}
  for (const c of components) {
    map[c.id] = {
      id: c.id, name: c.name, category: c.category || '',
      measureBy: c.measureBy || 'number', avgWeight: num(c.avgWeight), weightUnit: c.weightUnit || 'kg',
      reorderLevel: num(c.reorderLevel), unitCost: num(c.unitCost), supplierName: c.supplierName || '',
      received: 0, used: 0, stock: 0, weightEquiv: 0, value: 0, negative: false, reorder: false,
    }
  }
  for (const r of receipts) {
    if (map[r.componentId]) map[r.componentId].received += num(r.qty)
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
    m.stock = m.received - m.used
    m.weightEquiv = m.stock * m.avgWeight
    m.value = Math.max(0, m.stock) * m.unitCost
    m.negative = m.stock < 0
    m.reorder = m.reorderLevel > 0 && m.stock <= m.reorderLevel
  }
  return map
}

/** Materials at/below reorder level or negative — "order now", most urgent first. */
export function reorderList(stockMap) {
  return Object.values(stockMap)
    .filter(m => m.reorder || m.negative)
    .sort((a, b) => (a.stock - a.reorderLevel) - (b.stock - b.reorderLevel))
}

/** Material cost to make one piece of a product (Σ recipe qty × unit cost). */
export function materialCostOf(product, components) {
  const cost = Object.fromEntries(components.map(c => [c.id, num(c.unitCost)]))
  return recipeOf(product).reduce((s, r) => s + num(r.qty) * (cost[r.componentId] || 0), 0)
}
