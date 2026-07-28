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

/** Display name for the manager/in-charge role. */
export const INCHARGE_LABEL = 'Manager'


/** Wrong-entry correction window: Manager + Owner may correct an entry within
 *  this many hours of creation; after that, corrections are Owner-only.
 *  (Owner can always correct any entry, any age — this cap is for Manager/staff.) */
export const EDIT_WINDOW_HOURS = 96

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

/** Incoming raw material: flag the lot if its avg weight/piece deviates from the
 *  material's standard avg by more than this %. (Entry is still accepted.) */
export const AVG_WEIGHT_TOLERANCE_PCT = 1

/** Manager can view Contractor Pay & Ledger only this many months back. */
export const MANAGER_HISTORY_MONTHS = 2

/** Preset reasons for a stock set-off / adjustment. */
export const STOCK_ADJUST_REASONS = ['Damaged', 'Scrap', 'Physical count mismatch', 'Testing']

/** Raw-material stock transaction types (immutable, derived log). */
export const STOCK_TXN = { INCOMING: 'INCOMING', AUTO_DEDUCT: 'AUTO_DEDUCT', MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT', CORRECTION: 'CORRECTION' }

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
  // Raw / no finish: product is dispatched AS-IS to a client (no plating, no
  // suffix). Does NOT flow to the Plating app.
  { key: 'raw',      label: 'Raw (no finish)', suffix: '',    defaultParty: '' },
]

/** Finished product name = base + finish suffix (after the name). Raw/no-suffix
 *  finishes keep the base name unchanged. */
export const finishedName = (base, finishKey) => {
  const f = FINISHES.find(x => x.key === finishKey)
  return f && f.suffix ? `${base} ${f.suffix}` : base
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
  'Spider', 'Beeta', 'Pune', 'Stool base', 'Fan', 'Air', 'Wave',
  'Spider 20"', 'Frame Nickel 1.5"', 'Frame Reduce 1.5" Nickel',
  'Vista', 'Mona', '1" Frame', '1.25" Frame', 'Burfi',
]

/** Finishes that are PLATING (flow to the Plating Job Work app). Powder is
 *  in-house powder coating — it does NOT go to plating. */
export const PLATING_FINISHES = ['chrome', 'gold', 'rosegold']
export const isPlatingFinish = (key) => PLATING_FINISHES.includes(key)

/** Welder→Plating sync: only challans dated on/after this go to the Plating
 *  app's Incoming queue (older data already exists there via Excel import).
 *  NOTE: this doubles as the May-2026 firewall — entries dated before this
 *  (e.g. the manager's May backfill below) never reach the Plating app. */
export const PLATING_SYNC_FROM = '2026-06-01'

/**
 * HISTORY FREEZE — everything before this date is the verified pre-June baseline
 * (the May backfill is done). NO ONE — floor, manager, or owner — may create or
 * back-date a dispatch before this. Mirrors the Plating app's FREEZE_BEFORE and
 * lines up with PLATING_SYNC_FROM. (The temporary May-2026 manager backfill
 * window was closed on 2026-06-15 — that's why the old MANAGER_BACKDATE_* are gone.)
 */
export const FREEZE_BEFORE = '2026-06-01'

/**
 * MANAGER BACKFILL WINDOW (temporary, re-openable).
 * When a welder is away and never enters his own dispatches, the Manager (Anshul)
 * fills the gap. While open, the Manager can back-date to BACKFILL_FROM instead of
 * the normal last-7-days rule; Owner can always reach FREEZE_BEFORE regardless.
 * On BACKFILL_LOCK_DATE the Manager window auto-reverts to last-7-days — it flips
 * by calendar date, so NO redeploy is needed to close it.
 *
 * History:
 * - Jun–Jul backfill opened, then CLOSED 2026-07-13 (owner confirmed both months done).
 * - 2026-07-28 (owner request): Jitender was at home and made no entries, so the
 *   window is REOPENED for Anshul from 15 July. Open today + tomorrow; it
 *   auto-closes on 2026-07-30. Owner override intact; no existing data touched.
 * To reopen later: push BACKFILL_LOCK_DATE out and set BACKFILL_FROM to the
 * earliest date the Manager should reach (never earlier than FREEZE_BEFORE).
 */
export const BACKFILL_LOCK_DATE = '2026-07-30'

/** Earliest date the Manager may back-date to while the backfill window is open.
 *  Clamped by FREEZE_BEFORE — verified history can never be re-opened. */
export const BACKFILL_FROM = '2026-07-15'

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
  settlements:  'settlements',
  users:        'users',
  components:   'components',
  receipts:     'receipts',
  adjustments:  'adjustments',
}
