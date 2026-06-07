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

  // ── Future-compatibility fields ──────────────────────────────────────────
  // Optional & HIDDEN (inList:false → no UI). Present on every record so later
  // apps can connect WITHOUT a database redesign. Auto-filled on save where the
  // value is already known; otherwise left blank. The normalizer backfills these
  // defaults onto old records on read, so nothing breaks.
  field({ name: 'batchId',             label: 'Batch ID',             default: '',        inList: false }), // groups all line items saved together
  field({ name: 'productId',           label: 'Product ID',           default: '',        inList: false }), // id from products master (links to catalogue)
  field({ name: 'workflowStage',       label: 'Workflow Stage',       default: 'welding', inList: false }), // this app's stage in the chain
  field({ name: 'sourceApp',           label: 'Source App',           default: 'welder',  inList: false }), // which app created it
  field({ name: 'destinationApp',      label: 'Destination App',      default: '',        inList: false }), // where it flows next (e.g. platingjobwork)
  field({ name: 'linkedChallanId',     label: 'Linked Challan ID',    default: '',        inList: false }), // welder challan that ties rows / plating challan
  field({ name: 'parentTransactionId', label: 'Parent Transaction',   default: '',        inList: false }), // upstream txn (e.g. an order/production id)
  field({ name: 'createdByRole',       label: 'Created By Role',      default: '',        inList: false }), // welder | incharge | owner
  field({ name: 'updatedAt',           label: 'Updated At',           default: '',        inList: false }), // ISO timestamp, auto-stamped on every write
  field({ name: 'factoryId',           label: 'Factory ID',           default: 'main',    inList: false }), // multi-factory ready
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

/**
 * Base welded product. `welder` makes a product PER-WELDER:
 *   ''            → common (every welder sees & can pick it)
 *   '<name>'      → exclusive to that welder (e.g. Jitender's mechanism parts;
 *                   Naveen never sees them).
 * `noPlating` marks a product that is NOT sent for plating, so it is excluded
 * from the plating outbox / future plating sync even on a plating finish.
 * Both default to backward-compatible values (common, plating-eligible).
 */
export const productSchema = [
  field({ name: 'name',      label: 'Product',         type: 'text',   default: '', required: true }),
  field({ name: 'welder',    label: 'Belongs to',      type: 'text',   default: '' }),     // '' = common
  field({ name: 'noPlating', label: 'Not for plating', type: 'toggle', default: false }),
]

/**
 * Contractor piece-rate (owner-set) — HISTORICAL & TIME-BASED.
 *
 * Rates are never overwritten. When the owner changes a rate, the previous
 * record's `effectiveTo` is set to the day before the new one starts, and a new
 * record is created. Statements resolve the rate by each dispatch's production
 * date (see logic/pay.js → rateOn), so historical periods keep their old rate.
 * Priority: contractor-specific (`contractor` set) > common (`contractor` '').
 * `process` future-proofs for plating/powder/assembly/packing/dispatch.
 *
 * Backward-compat: old records used `product` (no dates). They are read as
 * "always in effect" — rProduct()/applies() in pay.js tolerate the old shape.
 */
export const rateSchema = [
  field({ name: 'process',       label: 'Process',        type: 'text',   default: 'welding' }),
  field({ name: 'productId',     label: 'Product ID',     type: 'text',   default: '' }),
  field({ name: 'productName',   label: 'Product',        type: 'text',   default: '', required: true }),
  field({ name: 'contractor',    label: 'Contractor',     type: 'text',   default: '' }), // '' = applies to all
  field({ name: 'rate',          label: 'Rate/piece',     type: 'number', default: 0 }),
  field({ name: 'effectiveFrom', label: 'Effective From', type: 'date',   default: '' }), // '' = since beginning
  field({ name: 'effectiveTo',   label: 'Effective To',   type: 'date',   default: '' }), // '' = open / current
  field({ name: 'isActive',      label: 'Active',         type: 'toggle', default: true }),
  field({ name: 'createdBy',     label: 'Created By',     type: 'text',   default: '' }),
  // createdAt / updatedAt auto-stamped by the repository / Firestore provider.
]

/**
 * A payment made to a contractor. Recorded by Manager or Owner. Each gets a
 * unique slip number (UMP-PAY-0001…). No payment time — date only.
 * Legacy fields `date`/`note` are kept and mirrored (paymentDate/remark) so old
 * payments and existing reports keep working unchanged.
 * `reversed` lets the owner cancel a payment without deleting history.
 */
export const paymentSchema = [
  field({ name: 'paymentSlipNo', label: 'Slip No',     type: 'text',   default: '' }),
  field({ name: 'contractor',    label: 'Contractor',  type: 'text',   default: '', required: true }),
  field({ name: 'amount',        label: 'Amount',      type: 'number', default: 0 }),
  field({ name: 'paymentMode',   label: 'Mode',        type: 'text',   default: 'cash' }), // cash/upi/cheque/bank
  field({ name: 'remark',        label: 'Remark',      type: 'text',   default: '' }),
  field({ name: 'paymentDate',   label: 'Payment Date', type: 'date',  default: '' }),
  field({ name: 'paidByUser',    label: 'Paid By',     type: 'text',   default: '' }),
  field({ name: 'paidByRole',    label: 'Paid By Role', type: 'text',  default: '' }), // Manager | Owner
  field({ name: 'reversed',      label: 'Reversed',    type: 'toggle', default: false }),
  // legacy (mirrored on new records for back-compat)
  field({ name: 'date',          label: 'Date',        type: 'date',   default: todayStr }),
  field({ name: 'note',          label: 'Note',        type: 'text',   default: '' }),
]

/**
 * Manual ledger entries (owner-only): the NON-derived parts of the contractor
 * ledger. Production is derived from dispatches and Payment from `payments`, so
 * this collection holds only opening balances, advances and adjustments —
 * keeping every figure single-sourced (no duplicate counting).
 *   type:      'opening' | 'advance' | 'adjustment'
 *   direction: 'credit'  (increases what we owe the contractor)
 *            | 'debit'   (decreases it — e.g. an advance paid)
 */
export const ledgerSchema = [
  field({ name: 'contractor', label: 'Contractor', type: 'text',   default: '', required: true }),
  field({ name: 'date',       label: 'Date',       type: 'date',   default: todayStr }),
  field({ name: 'type',       label: 'Type',       type: 'text',   default: 'adjustment' }),
  field({ name: 'direction',  label: 'Direction',  type: 'text',   default: 'debit' }),
  field({ name: 'amount',     label: 'Amount',     type: 'number', default: 0 }),
  field({ name: 'note',       label: 'Note',       type: 'text',   default: '' }),
  field({ name: 'createdBy',  label: 'Created By',  type: 'text',   default: '' }),
  field({ name: 'reversed',   label: 'Reversed',   type: 'toggle', default: false }),
]

/**
 * App user for role-based access (Google sign-in). Doc id = lowercased email so
 * Firestore rules can look the role up directly. Owner manages these in Admin.
 */
export const userSchema = [
  field({ name: 'email',  label: 'Email',  type: 'text',   default: '', required: true }),
  field({ name: 'name',   label: 'Name',   type: 'text',   default: '' }),
  field({ name: 'role',   label: 'Role',   type: 'text',   default: 'manager' }), // owner | manager
  field({ name: 'active', label: 'Active', type: 'toggle', default: true }),
]

export const welderSchema = [
  field({ name: 'name', label: 'Welder', type: 'text', default: '', required: true }),
]

export const partySchema = [
  field({ name: 'name', label: 'Party', type: 'text', default: '', required: true }),
]
