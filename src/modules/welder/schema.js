/**
 * Welder Contractor — record schemas. One transaction type (dispatch) plus
 * three simple master lists (products, welders, parties).
 *
 * A DISPATCH = one "material sent" entry: a welder sent N pieces of a product,
 * in a given finish, to a party, on a date. `finishedName` stores the product
 * with the finish suffix (e.g. "Spider Chrome") — that's what flows to the
 * future ready-product inventory.
 */
import { field } from '../../core/schema/field'
import { todayStr } from '../../core/utils/format'

export const dispatchSchema = [
  field({ name: 'date',         label: 'Date',    type: 'date',   default: todayStr, required: true }),
  field({ name: 'welder',       label: 'Welder',  type: 'text',   default: '', required: true }),
  field({ name: 'productName',  label: 'Product', type: 'text',   default: '', required: true }),
  field({ name: 'finish',       label: 'Finish',  type: 'text',   default: 'chrome' }),
  field({ name: 'finishedName', label: 'Sent as', type: 'text',   default: '' }),
  field({ name: 'party',        label: 'Sent to', type: 'text',   default: '' }),
  field({ name: 'qty',          label: 'Quantity', type: 'number', default: 0, required: true }),
  field({ name: 'gaadi',        label: 'Gaadi No', type: 'text',  default: '' }),
  field({ name: 'remarks',      label: 'Remarks', type: 'text',   default: '' }),
  // Plating hand-off: a welder challan number (e.g. NAV-001) is assigned per
  // gaadi when the welder "dispatches" it; then it flows to the plating app.
  field({ name: 'welderChallan', label: 'Welder Challan', type: 'text', default: '' }),
  field({ name: 'dispatched',    label: 'Dispatched',     type: 'toggle', default: false }),
  // Legacy approval fields (no longer gating; kept for backward-compat).
  field({ name: 'status',       label: 'Status',  type: 'text',   default: 'pending' }),
]

/**
 * Plating Outbox — the combined challan generated when a gaadi is dispatched.
 * This is the PREVIEW of what will be pushed into the Plating Job Work app
 * (apps/platingjobwork) once the owner approves. Mirrors the plating challan
 * shape: party, direction 'out', gaadi, items [{ product, quantity }] where
 * product already carries the welder challan prefix (e.g. "NAV-001 Spider").
 */
export const platingOutboxSchema = [
  field({ name: 'date',     label: 'Date',      type: 'date', default: todayStr }),
  field({ name: 'gaadi',    label: 'Gaadi No',  type: 'text', default: '' }),
  field({ name: 'party',    label: 'Party',     type: 'text', default: '' }),
  field({ name: 'items',    label: 'Items',     type: 'list', default: () => [] }),
  field({ name: 'welderChallans', label: 'Welder Challans', type: 'list', default: () => [] }),
  field({ name: 'pushed',   label: 'Pushed to plating', type: 'toggle', default: false }),
  field({ name: 'platingChallanNo', label: 'Plating Challan No', type: 'text', default: '' }),
]

export const productSchema = [
  field({ name: 'name', label: 'Product', type: 'text', default: '', required: true }),
]

export const welderSchema = [
  field({ name: 'name', label: 'Welder', type: 'text', default: '', required: true }),
]

export const partySchema = [
  field({ name: 'name', label: 'Party', type: 'text', default: '', required: true }),
]
