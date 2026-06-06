/**
 * Firebase service for the Welder Contractor app. Shares the SAME project
 * (`unico-operations`) as the other UNICO apps, under its own namespace so a
 * future combined ERP dashboard can read every app uniformly:
 *   apps/welder/dispatches/{id}   ← one doc per "material sent" entry
 *   apps/welder/products/{id}     ← base welded products
 *   apps/welder/welders/{id}      ← contractor list
 *   apps/welder/parties/{id}      ← where material is sent (job-work/dept)
 *   apps/welder/logs/{id}
 * Offline-capable (persistent cache) so contractors can record without internet.
 */
import { initializeApp, getApp } from 'firebase/app'
import {
  initializeFirestore, collection, doc,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

const APP_NS = 'welder'

let app = null
let db = null
let auth = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true,
  })
  auth = getAuth(app)
}

export { app, db, auth, isFirebaseConfigured, APP_NS }

const coll = (name) => collection(db, 'apps', APP_NS, name)
const cdoc = (name, id) => doc(db, 'apps', APP_NS, name, id)

export const paths = {
  dispatches: () => coll('dispatches'),
  dispatch: (id) => cdoc('dispatches', id),
  products: () => coll('products'),
  product: (id) => cdoc('products', id),
  welders: () => coll('welders'),
  welder: (id) => cdoc('welders', id),
  parties: () => coll('parties'),
  party: (id) => cdoc('parties', id),
  logs: () => coll('logs'),
  logDoc: (id) => cdoc('logs', id),
  platingOutbox: () => coll('plating_outbox'),
  platingOutboxDoc: (id) => cdoc('plating_outbox', id),
  counters: () => doc(db, 'apps', APP_NS, 'meta', 'counters'),
}

/**
 * Cross-app bridge to the Plating Job Work app (apps/platingjobwork) — used to
 * push welder challans into the plating app. SAME Firestore project, different
 * namespace. The plating app's UI is never modified; we only write data it
 * already understands (challans + its atomic challan-number counter).
 */
export const platingPaths = db && {
  challans: () => collection(db, 'apps', 'platingjobwork', 'challans'),
  challan: (id) => doc(db, 'apps', 'platingjobwork', 'challans', id),
  counter: () => doc(db, 'apps', 'platingjobwork', 'meta', 'counter'),
  parties: () => doc(db, 'apps', 'platingjobwork', 'meta', 'parties'),
}

export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    if (!auth) return reject(new Error('Firebase not configured'))
    const unsub = onAuthStateChanged(auth, (user) => { if (user) { unsub(); resolve(user.uid) } })
    signInAnonymously(auth).catch(reject)
  })
}

/** Google identity check for unlocking Admin (isolated secondary app). */
export async function verifyAdminGoogle() {
  if (!isFirebaseConfigured) throw new Error('Cloud not configured')
  const NAME = 'adminVerify'
  let secondary
  try { secondary = getApp(NAME) } catch { secondary = initializeApp(firebaseConfig, NAME) }
  const aAuth = getAuth(secondary)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred = await signInWithPopup(aAuth, provider)
  const email = (cred.user.email || '').toLowerCase()
  await aAuth.signOut().catch(() => {})
  return email
}
