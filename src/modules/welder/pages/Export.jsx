/**
 * Export / Share — flexible dispatch report PDF for WhatsApp. Group by product,
 * contractor, surface finish, party (or finish → person), over a date range,
 * with optional filters. Owner (admin) only.
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, Select, useToast, Toast } from '../../../core/ui'
import { todayStr } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { FINISHES } from '../config'
import { buildReportPdf, buildDailyPdf, sharePdf } from '../logic/pdf'

const GROUP_OPTS = [
  ['product', 'By Product'],
  ['welder', 'By Contractor'],
  ['finish', 'By Surface Finish'],
  ['party', 'By Sent-To Person'],
  ['finishparty', 'Finish → Person'],
]

export default function Export() {
  const { dispatches, welders, parties, products } = useWelder()
  const { msg, show } = useToast()
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01')
  const [to, setTo] = useState(todayStr())
  const [groupBy, setGroupBy] = useState('product')
  const [welder, setWelder] = useState('')
  const [finish, setFinish] = useState('')
  const [party, setParty] = useState('')
  const [product, setProduct] = useState('')

  const share = async () => {
    const doc = buildReportPdf(dispatches.list, { from, to, groupBy, welder, finish, party, product })
    const r = await sharePdf(doc, `Welder_Report_${groupBy}_${from}_${to}.pdf`)
    show(r === 'shared' ? 'Shared ✓' : r === 'cancelled' ? 'Cancelled' : 'Downloaded ✓')
  }
  const shareDaily = async () => {
    const doc = buildDailyPdf(dispatches.list, to)
    const r = await sharePdf(doc, `Welder_Dispatch_${to}.pdf`)
    show(r === 'shared' ? 'Shared ✓' : r === 'cancelled' ? 'Cancelled' : 'Downloaded ✓')
  }

  const allOpt = (label, list) => [{ value: '', label }, ...list]

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Card className="p-5 space-y-4">
        <FieldLabel>Report (PDF for WhatsApp)</FieldLabel>

        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>From</FieldLabel><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold" /></div>
          <div><FieldLabel>To</FieldLabel><input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold" /></div>
        </div>

        <div>
          <FieldLabel>Group by</FieldLabel>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {GROUP_OPTS.map(([k, l]) => (
              <button key={k} onClick={() => setGroupBy(k)} className={`py-2 rounded-xl text-sm font-bold ${groupBy === k ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Filters (optional)</FieldLabel>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Select value={welder} onChange={e => setWelder(e.target.value)} options={allOpt('All contractors', welders.list.map(w => ({ value: w.name, label: w.name })))} />
            <Select value={finish} onChange={e => setFinish(e.target.value)} options={allOpt('All finishes', FINISHES.map(f => ({ value: f.key, label: f.label })))} />
            <Select value={party} onChange={e => setParty(e.target.value)} options={allOpt('All persons', parties.list.map(p => ({ value: p.name, label: p.name })))} />
            <Select value={product} onChange={e => setProduct(e.target.value)} options={allOpt('All products', products.list.map(p => ({ value: p.name, label: p.name })))} />
          </div>
        </div>

        <Button variant="primary" size="lg" className="w-full !bg-amber-600" onClick={share}>📄 Share Report (WhatsApp)</Button>
      </Card>

      <Card className="p-5 space-y-2">
        <FieldLabel>Quick: Daily Report</FieldLabel>
        <p className="text-xs text-slate-400 -mt-1">Total + per-contractor + what went to each person on the “To” date.</p>
        <Button variant="neutral" className="w-full" onClick={shareDaily}>📄 Share Daily ({to})</Button>
      </Card>
    </div>
  )
}
