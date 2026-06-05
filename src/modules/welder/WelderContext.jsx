/**
 * WelderContext — module state (dispatches + master lists + logs). Two backends
 * with the same shape: LocalWelderProvider (localStorage) and FirestoreProvider
 * (cloud, real-time, offline). WelderProvider picks cloud when configured.
 */
import { createContext, useContext, useCallback } from 'react'
import { useCollection } from '../../core/hooks/useCollection'
import { dispatchesRepo, productsRepo, weldersRepo, partiesRepo, logsRepo, lastUsedStore } from './data'
import { isFirebaseConfigured } from '../../core/db/firebaseConfig'
import { FirestoreProvider } from './FirestoreProvider'

const Ctx = createContext(null)
export { Ctx as WelderCtx }

export function WelderProvider({ children }) {
  return isFirebaseConfigured
    ? <FirestoreProvider>{children}</FirestoreProvider>
    : <LocalWelderProvider>{children}</LocalWelderProvider>
}

export function LocalWelderProvider({ children }) {
  const dispatches = useCollection(dispatchesRepo)
  const products   = useCollection(productsRepo)
  const welders    = useCollection(weldersRepo)
  const parties    = useCollection(partiesRepo)
  const logs       = useCollection(logsRepo)

  const log = useCallback((action, detail, by = 'user') => {
    logs.insert({ ts: new Date().toISOString(), action, detail, by })
  }, [logs])

  const value = {
    dispatches, products, welders, parties, logs,
    lastUsed: lastUsedStore, log,
    cloud: { connected: false, error: '' },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWelder() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWelder must be used inside <WelderProvider>')
  return v
}
