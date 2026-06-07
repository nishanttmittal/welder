/**
 * Welder Contractor — data access. Master lists are seeded for a fresh install;
 * dispatches start empty and accumulate.
 */
import { createCollection, createSingleton, makeId } from '../../core/db/repository'
import { makeNormalizer } from '../../core/schema/field'
import { dispatchSchema, productSchema, welderSchema, partySchema, platingOutboxSchema, rateSchema, paymentSchema, ledgerSchema, userSchema } from './schema'
import { KEYS, DEFAULT_PRODUCTS, DEFAULT_WELDERS, DEFAULT_PARTIES } from './config'

export const dispatchesRepo = createCollection(KEYS.dispatches, {
  seed: () => [],
  normalize: makeNormalizer(dispatchSchema),
})

export const productsRepo = createCollection(KEYS.products, {
  seed: () => DEFAULT_PRODUCTS.map((name, i) => ({ id: makeId('p'), name, order: i })),
  normalize: makeNormalizer(productSchema),
})

export const weldersRepo = createCollection(KEYS.welders, {
  seed: () => DEFAULT_WELDERS.map((name, i) => ({ id: makeId('w'), name, order: i })),
  normalize: makeNormalizer(welderSchema),
})

export const partiesRepo = createCollection(KEYS.parties, {
  seed: () => DEFAULT_PARTIES.map((name, i) => ({ id: makeId('pt'), name, order: i })),
  normalize: makeNormalizer(partySchema),
})

export const platingOutboxRepo = createCollection(KEYS.platingOutbox, {
  seed: () => [],
  normalize: makeNormalizer(platingOutboxSchema),
})

export const ratesRepo = createCollection(KEYS.rates, {
  seed: () => [],
  normalize: makeNormalizer(rateSchema),
})

export const paymentsRepo = createCollection(KEYS.payments, {
  seed: () => [],
  normalize: makeNormalizer(paymentSchema),
})

export const ledgerRepo = createCollection(KEYS.ledger, {
  seed: () => [],
  normalize: makeNormalizer(ledgerSchema),
})

export const usersRepo = createCollection(KEYS.users, {
  seed: () => [],
  normalize: makeNormalizer(userSchema),
})

export const logsRepo = createCollection(KEYS.logs, { seed: () => [] })
export const lastUsedStore = createSingleton(KEYS.lastUsed, {})
export const countersStore = createSingleton(KEYS.counters, {})
