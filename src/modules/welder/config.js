/**
 * Welder Contractor module — configuration & constants.
 */

export const APP_TITLE = 'Welder Contractor'

/** Admin password (same pattern as the other UNICO apps). */
export const ADMIN_PASSWORD = '6133923_N'

/** Quick-add chips on the quantity stepper. */
export const QUICK_QTYS = [5, 10, 25, 50, 100, 200]

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

export const KEYS = {
  dispatches: 'dispatches',
  products:   'products',
  welders:    'welders',
  parties:    'parties',
  logs:       'logs',
  lastUsed:   'last_used',
}
