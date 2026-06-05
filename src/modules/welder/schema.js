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
  field({ name: 'remarks',      label: 'Remarks', type: 'text',   default: '' }),
  // Approval flow: pending (staff) → passed (manager) → approved (owner).
  field({ name: 'status',       label: 'Status',  type: 'text',   default: 'pending' }),
  field({ name: 'passedBy',     label: 'Passed by', type: 'text', default: '' }),
  field({ name: 'approvedBy',   label: 'Approved by', type: 'text', default: '' }),
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
