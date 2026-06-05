/**
 * Export / Share — build the daily dispatch report PDF and share via WhatsApp.
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, useToast, Toast } from '../../../core/ui'
import { todayStr } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { buildDailyPdf, sharePdf } from '../logic/pdf'

export default function Export() {
  const { dispatches } = useWelder()
  const { msg, show } = useToast()
  const [date, setDate] = useState(todayStr())

  const share = async () => {
    const doc = buildDailyPdf(dispatches.list, date)
    const r = await sharePdf(doc, `Welder_Dispatch_${date}.pdf`)
    show(r === 'shared' ? 'Shared ✓' : r === 'cancelled' ? 'Cancelled' : 'Downloaded ✓')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <Card className="p-5 space-y-4">
        <FieldLabel>Daily Dispatch Report</FieldLabel>
        <div>
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="mt-1 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold" />
        </div>
        <Button variant="primary" size="lg" className="w-full !bg-amber-600" onClick={share}>📄 Share Report (WhatsApp)</Button>
        <p className="text-xs text-slate-400 text-center">Total + per-welder + what went to each party that day.</p>
      </Card>
    </div>
  )
}
