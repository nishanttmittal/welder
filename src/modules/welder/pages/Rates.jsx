/**
 * RATES — owner sets the piece rate per product (per process / per contractor),
 * with full time-based history (backdate, schedule, edit, deactivate, delete).
 * This is the ONLY place rates are managed. Daily money work is in Hisab.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, NumberInput, Select, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { rateOn, currentOpenRate, dayBefore, rateTimeline, isRateActiveNow } from '../logic/pay'
import { PROCESSES, processLabel, ADMIN_PASSWORD } from '../config'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const rate$ = (n) => '₹' + round2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const rProductName = (r) => r.productName || r.product || ''

export default function Rates({ by = 'owner' }) {
  const { products, rates, welders, log } = useWelder()
  const { msg, show } = useToast()
  const [rateProcess, setRateProcess] = useState('welding')
  const [rateContractor, setRateContractor] = useState('')   // '' = all contractors
  const [effFrom, setEffFrom] = useState(todayStr())
  const [editRate, setEditRate] = useState(null)
  const [unlocked, setUnlocked] = useState(false)   // rates are LOCKED by default — unlock to edit

  const unlock = () => {
    const pwd = prompt('Rates are locked.\nEnter admin password to unlock and edit:')
    if (pwd === null) return
    if (pwd !== ADMIN_PASSWORD) return show('Wrong password — still locked', 2500)
    setUnlocked(true); show('Rates unlocked — you can edit now')
  }

  const sortedProducts = useMemo(() => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [products.list])
  const effectiveRate = (product) => rateOn(rates.list, product, rateContractor, effFrom, rateProcess)
  const timeline = useMemo(() => {
    const all = rateTimeline(rates.list, rateProcess)
    return rateContractor ? all.filter(r => (r.contractor || '') === rateContractor || !r.contractor) : all
  }, [rates.list, rateProcess, rateContractor])

  const applyRateChange = (product, productId, value) => {
    if (!unlocked) return
    const v = round2(value)
    if (v === effectiveRate(product)) return
    const cur = currentOpenRate(rates.list, product, rateContractor, rateProcess, effFrom)
    if (cur) {
      const to = dayBefore(effFrom)
      if (!cur.effectiveFrom || cur.effectiveFrom <= to) rates.update(cur.id, { effectiveTo: to })
      else rates.update(cur.id, { isActive: false })
    }
    rates.insert({ process: rateProcess, productId: productId || '', productName: product, contractor: rateContractor, rate: v, effectiveFrom: effFrom, effectiveTo: '', isActive: true, createdBy: by })
    log('RATE', `[${processLabel(rateProcess)}] ${product}${rateContractor ? ' · ' + rateContractor : ''} = ₹${v}/pc from ${effFrom}`, by)
    show(effFrom > todayStr() ? `Scheduled ₹${v} from ${fmtDate(effFrom)} ✓` : 'Rate updated ✓')
  }
  const deactivateRate = (r) => {
    if (!confirm(`Deactivate this rate (${rProductName(r)} · ₹${r.rate})? Kept in history, stops applying.`)) return
    rates.update(r.id, { isActive: false }); log('RATE_OFF', `${rProductName(r)} ₹${r.rate} deactivated`, by); show('Deactivated ✓')
  }
  const saveRateEdit = ({ effectiveFrom, effectiveTo, rate }) => {
    const r = editRate, v = round2(rate)
    rates.update(r.id, { effectiveFrom, effectiveTo: effectiveTo || '', rate: v, isActive: true })
    log('RATE_EDIT', `${rProductName(r)}: was ₹${r.rate} from ${r.effectiveFrom || '—'} → ₹${v} from ${effectiveFrom}${effectiveTo ? ' to ' + effectiveTo : ''}`, by, r.id)
    setEditRate(null); show('Rate updated ✓')
  }
  const deleteRate = (r) => {
    const reason = prompt(`PERMANENTLY DELETE this rate?\n${rProductName(r)} · ₹${r.rate} from ${r.effectiveFrom || '—'}\nReason (required):`)
    if (reason === null) return
    if (!reason.trim()) return show('Reason required', 2500)
    log('RATE_DELETE', `${rProductName(r)} ₹${r.rate} from ${r.effectiveFrom || '—'} deleted · ${reason.trim()}`, by, r.id)
    rates.remove(r.id); show('Deleted ✓')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      {unlocked ? (
        <div className="flex items-center justify-between bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-3">
          <span className="text-sm font-bold text-emerald-700">🔓 Unlocked — you can edit rates</span>
          <Button size="sm" variant="neutral" onClick={() => setUnlocked(false)}>🔒 Lock</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-rose-50 border-2 border-rose-200 rounded-2xl px-4 py-3">
          <span className="text-sm font-bold text-rose-700">🔒 Rates locked (safe from accidental change)</span>
          <Button size="sm" variant="primary" onClick={unlock}>Unlock to edit</Button>
        </div>
      )}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Process</FieldLabel><Select className="mt-1" value={rateProcess} onChange={e => setRateProcess(e.target.value)} options={PROCESSES.map(p => ({ value: p.key, label: p.label }))} /></div>
          <div><FieldLabel>Rate for</FieldLabel><Select className="mt-1" value={rateContractor} onChange={e => setRateContractor(e.target.value)} options={[{ value: '', label: 'All contractors' }, ...welders.list.map(w => ({ value: w.name, label: w.name }))]} /></div>
        </div>
        <div>
          <FieldLabel>Effective from (you can BACKDATE — pick a past date)</FieldLabel>
          <DateInput className="mt-1" value={effFrom} onChange={e => setEffFrom(e.target.value)} />
          <p className="text-[11px] text-slate-400 mt-1">Past date = backdate · today = now · future = schedule. Old rates are kept; past hisabs keep their old rate. Fix a saved rate with ✏️ below.</p>
        </div>
        {rateContractor && <p className="text-[11px] text-amber-600">Special rate for <b>{rateContractor}</b> — overrides the “All contractors” rate.</p>}
        <div className="space-y-1.5 max-h-80 overflow-auto">
          {sortedProducts.map(p => {
            const common = rateOn(rates.list, p.name, '', effFrom, rateProcess)
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-semibold text-slate-600">{p.name}{p.referenceOnly ? ' 📦' : ''}</span>
                <NumberInput key={`${rateProcess}|${rateContractor}|${effFrom}|${p.id}|${unlocked}`} inputMode="decimal" step="0.01" min="0" disabled={!unlocked} className={`w-24 !py-1.5 text-right ${unlocked ? '' : 'bg-slate-50 text-slate-500'}`} placeholder={rateContractor && common ? `${common} (all)` : '₹/pc'} defaultValue={effectiveRate(p.name) || ''} onBlur={e => applyRateChange(p.name, p.id, e.target.value)} />
              </div>
            )
          })}
          {sortedProducts.length === 0 && <p className="text-sm text-slate-400">No products.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-bold text-slate-700 mb-2">📜 Rate History · {processLabel(rateProcess)}</div>
        {timeline.length === 0 ? <p className="text-sm text-slate-400">No rates yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400 text-left"><th className="py-1 pr-2">Product</th><th className="pr-2">For</th><th className="pr-2 text-right">Rate</th><th className="pr-2">From</th><th className="pr-2">To</th><th></th></tr></thead>
              <tbody>
                {timeline.map(r => {
                  const active = isRateActiveNow(r)
                  return (
                    <tr key={r.id} className={`border-t border-slate-100 ${active ? '' : 'text-slate-400'}`}>
                      <td className="py-1.5 pr-2 font-semibold text-slate-600">{rProductName(r)}</td>
                      <td className="pr-2">{r.contractor || 'All'}</td>
                      <td className="pr-2 text-right font-mono">{rate$(r.rate)}</td>
                      <td className="pr-2 whitespace-nowrap">{r.effectiveFrom ? fmtDate(r.effectiveFrom) : '—'}</td>
                      <td className="pr-2 whitespace-nowrap">{r.effectiveTo ? fmtDate(r.effectiveTo) : (r.isActive === false ? 'off' : 'open')}</td>
                      <td className="whitespace-nowrap text-right">
                        {unlocked ? (<>
                          <button onClick={() => setEditRate(r)} className="px-1" title="Edit">✏️</button>
                          {active && <button onClick={() => deactivateRate(r)} className="px-1" title="Deactivate">⏸</button>}
                          <button onClick={() => deleteRate(r)} className="px-1" title="Delete">🗑</button>
                        </>) : <span className="text-slate-300">🔒</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 mt-2">✏️ edit date/rate · ⏸ deactivate · 🗑 delete. 📦 = material/reference product.</p>
          </div>
        )}
      </Card>

      {editRate && <EditRateForm rate={editRate} onSave={saveRateEdit} onCancel={() => setEditRate(null)} />}
    </div>
  )
}

function EditRateForm({ rate, onSave, onCancel }) {
  const [from, setFrom] = useState(rate.effectiveFrom || todayStr())
  const [to, setTo] = useState(rate.effectiveTo || '')
  const [val, setVal] = useState(String(rate.rate ?? ''))
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-slate-800">Fix rate · {rate.productName || rate.product}{rate.contractor ? ' · ' + rate.contractor : ' · All'}</div>
        <div><FieldLabel>Rate ₹/pc</FieldLabel><NumberInput inputMode="decimal" step="0.01" min="0" className="mt-1" value={val} onChange={e => setVal(e.target.value)} /></div>
        <div><FieldLabel>Effective FROM (backdate here)</FieldLabel><DateInput className="mt-1" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><FieldLabel>Effective TO (blank = still applies)</FieldLabel><DateInput className="mt-1" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="flex gap-2 pt-1">
          <Button variant="neutral" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="success" className="flex-1" onClick={() => onSave({ effectiveFrom: from, effectiveTo: to, rate: val })}>Save</Button>
        </div>
      </div>
    </div>
  )
}
