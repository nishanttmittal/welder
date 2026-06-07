/**
 * Welder Contractor module — configuration & constants.
 */

export const APP_TITLE = 'Welder Contractor'

/**
 * Identity of this app on the shared UNICO factory data-backbone. These tag
 * every record so future apps (laser/plating/powder/assembly/packing/dispatch,
 * multi-factory, ERP dashboard) can link to welder data with NO schema redesign.
 * Single factory for now → DEFAULT_FACTORY_ID 'main'.
 */
export const SOURCE_APP = 'welder'
export const WORKFLOW_STAGE = 'welding'
export const DEFAULT_FACTORY_ID = 'main'

/**
 * REAL AUTH (Google sign-in for Manager/Owner; welders stay link-based/anonymous).
 * Roles are managed in-app (Admin → Users & Access), stored at apps/welder/users
 * keyed by email. These bootstrap emails are ALWAYS owner so you can never lock
 * yourself out — add/replace with your own Google account, then manage the rest
 * in-app. Must be lowercase. Mirror this list in firestore.rules.
 */
export const OWNER_EMAILS = ['nspenterprises24@gmail.com']
export const ROLES = { owner: 'owner', manager: 'manager' }

/** Owner — full access incl. approve/edit/delete + log. (Legacy password — used
 *  only in offline/local `?local=1` mode; cloud mode uses Google auth.) */
export const ADMIN_PASSWORD = '6133923_N'
/** Second role (reviews & passes entries) — label is just a display name,
 *  change to anything you like. Password: nsp@123. */
export const INCHARGE_LABEL = 'User1'
export const MANAGER_PASSWORD = 'nsp@123'

/**
 * Entry lifecycle (approval flow): staff creates → pending; manager → passed;
 * owner → approved (counts toward main totals). Owner can approve directly.
 */
export const STATUS = { pending: 'pending', passed: 'passed', approved: 'approved' }
export const statusLabel = (s) => ({ pending: 'Pending', passed: 'Passed', approved: 'Approved' }[s] || 'Pending')
export const statusColor = (s) => ({ pending: 'bg-slate-100 text-slate-600', passed: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700' }[s] || 'bg-slate-100 text-slate-600')

/** Quick-add chips on the quantity stepper. */
export const QUICK_QTYS = [5, 10, 25, 50, 100, 200]

/** Payment modes for contractor payments. */
export const PAYMENT_MODES = ['Cash', 'UPI', 'Cheque', 'Bank Transfer']

/**
 * Finishes a welded product can be sent for. The finish is appended AFTER the
 * product name (e.g. "Spider Chrome"). Default party is a hint for the entry
 * form; the welder can still change it.
 */
export const FINISHES = [
  { key: 'chrome',   label: 'Chrome',    suffix: 'Chrome',    defaultParty: 'Sriram' },
  { key: 'powder',   label: 'Powder',    suffix: 'Powder',    defaultParty: 'Powder Coating Dept' },
  { key: 'gold',     label: 'Gold',      suffix: 'Gold',      defaultParty: 'JP Metal Works' },
  { key: 'rosegold', label: 'Rose Gold', suffix: 'Rose Gold', defaultParty: 'JP Metal Works' },
]

/** Finished product name = base + finish suffix (after the name). */
export const finishedName = (base, finishKey) => {
  const f = FINISHES.find(x => x.key === finishKey)
  return f ? `${base} ${f.suffix}` : base
}

/**
 * Contractor processes for piece-rate pay. 'welding' is what this app records
 * today; the rest future-proof the rate sheet so the SAME pay screen scales to
 * plating, powder, assembly, packing and dispatch contractors later (a rate set
 * now is simply waiting for those apps to feed production into it).
 */
export const PROCESSES = [
  { key: 'welding',  label: 'Welding' },
  { key: 'plating',  label: 'Plating' },
  { key: 'powder',   label: 'Powder Coating' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'packing',  label: 'Packing' },
  { key: 'dispatch', label: 'Dispatch' },
]
export const processLabel = (k) => PROCESSES.find(p => p.key === k)?.label || k

/** Contractors (welders) who use the app — editable in admin. */
export const DEFAULT_WELDERS = ['Naveen', 'Jitender']

/** Where material is sent (job-work persons / departments) — editable. */
export const DEFAULT_PARTIES = ['Sriram', 'Jitender', 'Powder Coating Dept', 'JP Metal Works']

/**
 * Base welded products (chrome list read from JITENDER.xlsx / SRIRAM.xlsx).
 * Each is automatically available in ALL finishes. Powder/Gold-only names can
 * be added later in admin.
 */
export const DEFAULT_PRODUCTS = [
  'Spider', 'Beeta', 'Pune', 'Stool', 'Fan', 'Air', 'Wave',
  'Spider 20"', 'Frame Nickel 1.5"', 'Frame Reduce 1.5" Nickel',
  'Vista', 'Mona', '1" Frame', '1.25" Frame', 'Burfi',
]

/** Finishes that are PLATING (flow to the Plating Job Work app). Powder is
 *  in-house powder coating — it does NOT go to plating. */
export const PLATING_FINISHES = ['chrome', 'gold', 'rosegold']
export const isPlatingFinish = (key) => PLATING_FINISHES.includes(key)

/** Welder challan prefix from the welder's name, e.g. "Naveen" → "NAV". */
export const welderPrefix = (name) => ((name || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'WLD')

export const KEYS = {
  dispatches:   'dispatches',
  products:     'products',
  welders:      'welders',
  parties:      'parties',
  logs:         'logs',
  lastUsed:     'last_used',
  platingOutbox: 'plating_outbox',
  counters:     'counters', // { challan: { Naveen: 3, Jitender: 1 } }
  rates:        'rates',
  payments:     'payments',
  ledger:       'ledger',
  users:        'users',
}
