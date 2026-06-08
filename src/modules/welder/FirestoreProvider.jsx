/**
 * Firestore-backed Welder state — real-time, multi-device, offline-capable.
 * Same value shape as the local provider. Seeds master lists (products/welders/
 * parties) on first run with idempotent ids.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { onSnapshot, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore'
import { db, paths, ensureSignedIn } from '../../core/db/firebase'
import { makeNormalizer } from '../../core/schema/field'
import { makeId } from '../../core/db/repository'
import { dispatchSchema, productSchema, welderSchema, partySchema, platingOutboxSchema, rateSchema, paymentSchema, ledgerSchema, userSchema, componentSchema, receiptSchema, adjustmentSchema } from './schema'
import { DEFAULT_PRODUCTS, DEFAULT_WELDERS, DEFAULT_PARTIES } from './config'
import { lastUsedStore, countersStore } from './data'
import { WelderCtx } from './WelderContext'

function useCloudCollection(collPath, docPath, normalize) {
  const [list, setList] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(collPath(), (snap) => setList(snap.docs.map(d => normalize({ id: d.id, ...d.data() }))))
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    list,
    insert: (rec) => { const id = rec.id || makeId('r'); const now = new Date().toISOString(); const row = { createdAt: now, updatedAt: now, ...rec, id }; setDoc(docPath(id), row); return row },
    update: (id, patch) => setDoc(docPath(id), { ...patch, updatedAt: new Date().toISOString() }, { merge: true }),
    remove: (id) => deleteDoc(docPath(id)),
    removeWhere: (pred) => { const hit = list.filter(pred); const b = writeBatch(db); hit.forEach(r => b.delete(docPath(r.id))); b.commit(); return hit.length },
    replaceAll: async (rows) => {
      const ex = await getDocs(collPath()); const b1 = writeBatch(db); ex.forEach(d => b1.delete(d.ref)); await b1.commit()
      const b2 = writeBatch(db); (rows || []).forEach(r => { const id = r.id || makeId('r'); b2.set(docPath(id), { ...r, id }) }); await b2.commit()
    },
    reset: async () => { const ex = await getDocs(collPath()); const b = writeBatch(db); ex.forEach(d => b.delete(d.ref)); await b.commit() },
  }
}

const normDispatch = makeNormalizer(dispatchSchema)
const normProduct  = makeNormalizer(productSchema)
const normWelder   = makeNormalizer(welderSchema)
const normParty    = makeNormalizer(partySchema)
const normOutbox   = makeNormalizer(platingOutboxSchema)
const normRate     = makeNormalizer(rateSchema)
const normPayment  = makeNormalizer(paymentSchema)
const normLedger   = makeNormalizer(ledgerSchema)
const normUser     = makeNormalizer(userSchema)
const normComponent = makeNormalizer(componentSchema)
const normReceipt   = makeNormalizer(receiptSchema)
const normAdjustment = makeNormalizer(adjustmentSchema)

export function FirestoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState('')

  const dispatches = useCloudCollection(paths.dispatches, paths.dispatch, normDispatch)
  const products   = useCloudCollection(paths.products, paths.product, normProduct)
  const welders    = useCloudCollection(paths.welders, paths.welder, normWelder)
  const parties    = useCloudCollection(paths.parties, paths.party, normParty)
  const platingOutbox = useCloudCollection(paths.platingOutbox, paths.platingOutboxDoc, normOutbox)
  const rates      = useCloudCollection(paths.rates, paths.rate, normRate)
  const payments   = useCloudCollection(paths.payments, paths.payment, normPayment)
  const ledger     = useCloudCollection(paths.ledger, paths.ledgerDoc, normLedger)
  const users      = useCloudCollection(paths.users, paths.user, normUser)
  const components = useCloudCollection(paths.components, paths.component, normComponent)
  const receipts   = useCloudCollection(paths.receipts, paths.receipt, normReceipt)
  const adjustments = useCloudCollection(paths.adjustments, paths.adjustment, normAdjustment)
  const logs       = useCloudCollection(paths.logs, paths.logDoc, (r) => r)

  useEffect(() => {
    let done = false
    const timer = setTimeout(() => { if (!done) setTimedOut(true) }, 12000)
    const unsub = onSnapshot(paths.products(),
      () => { done = true; clearTimeout(timer); setReady(true) },
      (e) => { done = true; clearTimeout(timer); setError(e.message); setReady(true) })
    ensureSignedIn().catch((e) => { done = true; clearTimeout(timer); setError(e.message); setTimedOut(true) })
    return () => { clearTimeout(timer); unsub() }
  }, [])

  const log = useCallback((action, detail, by = 'user', ref = '') => {
    const id = makeId('log')
    setDoc(paths.logDoc(id), { id, ts: new Date().toISOString(), action, detail, by, ref })
  }, [])

  // First-run seeding (idempotent ids).
  const seededRef = useRef(false)
  useEffect(() => {
    if (!ready || seededRef.current) return
    seededRef.current = true
    if (products.list.length === 0) DEFAULT_PRODUCTS.forEach((name, i) => setDoc(paths.product(`seed_p${i + 1}`), { id: `seed_p${i + 1}`, name, order: i }))
    if (welders.list.length === 0) DEFAULT_WELDERS.forEach((name, i) => setDoc(paths.welder(`seed_w${i + 1}`), { id: `seed_w${i + 1}`, name, order: i }))
    if (parties.list.length === 0) DEFAULT_PARTIES.forEach((name, i) => setDoc(paths.party(`seed_pt${i + 1}`), { id: `seed_pt${i + 1}`, name, order: i }))
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready && timedOut) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
        <div className="text-4xl">📡</div>
        <div className="text-base font-bold">Can't reach the cloud</div>
        <div className="text-sm text-slate-300 max-w-xs">Check internet and try again.</div>
        <button onClick={() => window.location.reload()} className="mt-2 bg-white text-slate-900 rounded-xl px-6 py-3 font-bold text-sm">Retry</button>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <div className="text-2xl">☁️</div><div className="text-sm text-slate-300">Connecting to cloud…</div>
      </div>
    )
  }

  const value = {
    dispatches, products, welders, parties, platingOutbox, rates, payments, ledger, users, components, receipts, adjustments, logs,
    lastUsed: lastUsedStore, counters: countersStore, log,
    cloud: { connected: !error, error },
  }
  return <WelderCtx.Provider value={value}>{children}</WelderCtx.Provider>
}
