/**
 * Re-sync to Plating — re-push welder challans (chrome/gold/rose, on/after the
 * cutoff) that never reached the Plating app. Skips ones already there, so it
 * never reverts an accepted/rejected incoming. Idempotent — safe to run anytime.
 *
 * Available to Manager + Owner (its own tile) so the floor manager can push
 * pending material without opening the owner-only Admin page.
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, useToast, Toast } from '../../../core/ui'
import { useWelder } from '../WelderContext'
import { isPlatingFinish, PLATING_SYNC_FROM, SOURCE_APP } from '../config'
import { pushPlatingIncoming, listPlatingIncomingIds } from '../../../core/db/firebase'

export function ResyncPlating() {
  const { dispatches, products, log } = useWelder()
  const { msg, show } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const existing = await listPlatingIncomingIds()
      const noPlating = new Set(products.list.filter(p => p.noPlating).map(p => p.name))
      const byCode = {}
      dispatches.list.forEach(d => {
        if (d.payBasis === 'final-dispatch') return // owner pay entry — never goes to plating
        if (!isPlatingFinish(d.finish) || !d.welderChallan || Number(d.qty) <= 0 || (d.date || '') < PLATING_SYNC_FROM) return
        if (noPlating.has(d.productName)) return
        ;(byCode[d.welderChallan] ||= []).push(d)
      })
      let n = 0
      for (const [code, ds] of Object.entries(byCode)) {
        if (existing.has(`feed_${code}`)) continue
        const first = ds[0]
        const items = ds.map(d => ({ product: d.productName, quantity: Number(d.qty) }))
        await pushPlatingIncoming({
          id: `feed_${code}`, status: 'pending', date: first.date, party: first.party, gaadi: first.gaadi || '',
          items, welderChallanNo: code, linkedChallanId: code, batchId: first.batchId || '',
          sourceApp: SOURCE_APP, destinationApp: 'platingjobwork', parentTransactionId: '',
          createdAt: first.updatedAt || new Date().toISOString(), createdBy: first.welder || 'welder',
        }).catch(() => {})
        n++
      }
      log('RESYNC_PLATING', `re-synced ${n} challan/s`, 'owner')
      show(n ? `Re-synced ${n} challan/s to Plating ✓` : 'All already in Plating ✓', 3000)
    } catch { show('Re-sync failed — check internet', 3000) } finally { setBusy(false) }
  }

  return (
    <Card className="p-5 space-y-2">
      <FieldLabel>Re-sync to Plating</FieldLabel>
      <p className="text-[11px] text-slate-400 -mt-1">Re-sends chrome/gold/rose challans that didn’t reach the Plating app (e.g. older entries). Already-handled ones are skipped — safe to run anytime.</p>
      <Button variant="neutral" className="w-full" onClick={run} disabled={busy}>{busy ? 'Re-syncing…' : '🔄 Re-sync challans to Plating'}</Button>
      <Toast msg={msg} />
    </Card>
  )
}

/** Standalone page wrapper (own tile for Manager + Owner). */
export default function ResyncPlatingPage() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <ResyncPlating />
    </div>
  )
}
