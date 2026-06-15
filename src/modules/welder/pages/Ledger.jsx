/**
 * CONTRACTOR LEDGER — clean, read-only running balance for one welder + month.
 * Uses the same computeHisab engine as the Hisab screen, so opening balance,
 * advances and payments always match. Two PDFs:
 *   • Ledger PDF   — the full line-by-line statement (any month).
 *   • Settlement PDF — signature-ready, only after the month is FINALIZED.
 * Add advances / payments in the Hisab screen, not here.
 */
import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useWelder } from '../WelderContext'
import { computeHisab } from '../logic/pay'

const money = (n) => '₹' + fmtNum(Math.round(Number(n) || 0))
const shiftMonth = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) }

export default function Ledger() {
  const { dispatches, products, rates, payments, ledger, settlements, welders } = useWelder()
  const { msg, show } = useToast()
  const [welder, setWelder] = useState(welders.list[0]?.name || '')
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const isCurrentMonth = month >= todayStr().slice(0, 7)
  const refProducts = useMemo(() => new Set(products.list.filter(p => p.referenceOnly).map(p => p.name)), [products.list])
  const h = useMemo(() => computeHisab({ dispatches: dispatches.list, rates: rates.list, payments: payments.list, ledger: ledger.list, settlements: settlements.list, refProducts, welder, month, today: todayStr() }),
    [dispatches.list, rates.list, payments.list, ledger.list, settlements.list, refProducts, welder, month])

  const ledgerPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text('UNICO — Contractor Ledger', 14, 16)
    doc.setFontSize(12); doc.text(welder, 14, 25); doc.setFontSize(10); doc.text(`${monthLabel(month)}${h.locked ? '  (finalized)' : ''}`, 14, 31)
    doc.text(`Opening balance b/f: ${money(h.opening)} ${h.opening >= 0 ? 'payable' : 'advance'}`, 14, 37)
    autoTable(doc, {
      startY: 42,
      head: [['Date', 'Type', 'Details', 'Debit', 'Credit', 'Balance']],
      body: h.lines.map(l => [fmtDate(l.date), l.type, l.desc, l.debit ? money(l.debit) : '', l.credit ? money(l.credit) : '', money(l.runningBalance)]),
      foot: [['', '', 'Closing balance', money(h.earned), money(h.advTotal + h.payTotal), money(h.net)]],
      theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      headStyles: { fillColor: [13, 148, 136], fontSize: 10 }, footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    })
    let y = doc.lastAutoTable.finalY + 8; doc.setFontSize(12); doc.setFont(undefined, 'bold')
    doc.text(h.net >= 0 ? `Net PAYABLE to ${welder}: ${money(h.net)}` : `Advance carried forward: ${money(-h.net)}`, 14, y)
    doc.save(`ledger-${welder}-${month}.pdf`); show('Ledger PDF ready ✓')
  }

  const settlementPDF = () => {
    if (!h.locked) return show('Finalize this month in Hisab first', 2500)
    const doc = new jsPDF()
    doc.setFontSize(17); doc.text('UNICO — Hisab Settlement', 14, 18)
    doc.setFontSize(12); doc.text(`Welder: ${welder}`, 14, 28); doc.text(`Month: ${monthLabel(month)}`, 14, 35)
    autoTable(doc, {
      startY: 42, theme: 'plain', styles: { fontSize: 12, cellPadding: 3 },
      body: [
        ['Opening balance b/f', money(h.opening)],
        ['Add: Earned (piece + material)', money(h.earned)],
        ['Less: Advances', '- ' + money(h.advTotal)],
        ['Less: Payments', '- ' + money(h.payTotal)],
      ],
      foot: [[h.net >= 0 ? 'NET PAYABLE' : 'ADVANCE CARRIED FORWARD', money(Math.abs(h.net))]],
      footStyles: { fontStyle: 'bold', fontSize: 13, fillColor: [241, 245, 249], textColor: 20 },
    })
    let y = doc.lastAutoTable.finalY + 24
    doc.setFontSize(11); doc.text('Welder signature: ____________________', 14, y); doc.text('Owner signature: ____________________', 110, y)
    doc.save(`settlement-${welder}-${month}.pdf`); show('Settlement PDF ready ✓')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3 pb-24">
      <Toast msg={msg} />
      <div className="grid grid-cols-2 gap-2">
        {welders.list.map(w => (
          <button key={w.name} onClick={() => setWelder(w.name)} className={`py-3 rounded-2xl font-bold text-base ${welder === w.name ? 'bg-teal-600 text-white shadow' : 'bg-white text-slate-600 border-2 border-slate-200'}`}>👷 {w.name}</button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-slate-200 p-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-12 h-12 rounded-xl bg-slate-100 text-2xl font-bold active:bg-slate-200">◀</button>
        <div className="text-center"><div className="font-bold text-slate-800">{monthLabel(month)}</div>{h.locked && <div className="text-[11px] text-rose-600 font-bold">🔒 finalized</div>}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrentMonth} className={`w-12 h-12 rounded-xl text-2xl font-bold ${isCurrentMonth ? 'bg-slate-50 text-slate-300' : 'bg-slate-100 active:bg-slate-200'}`}>▶</button>
      </div>

      <Card className="p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 text-left text-xs"><th className="py-1.5 pr-2">Date</th><th className="pr-2">Type</th><th className="pr-2 text-right">Debit</th><th className="pr-2 text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
          <tbody>
            <tr className="border-t border-slate-100 bg-slate-50">
              <td className="py-2 pr-2 text-slate-500" colSpan={2}>Opening balance b/f</td>
              <td></td><td></td><td className="text-right font-mono font-bold">{money(h.opening)}</td>
            </tr>
            {h.lines.map((l, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2 pr-2 whitespace-nowrap text-slate-600">{fmtDate(l.date)}</td>
                <td className="pr-2"><span className="font-semibold text-slate-700">{l.type}</span><div className="text-[11px] text-slate-400 leading-tight">{l.desc}</div></td>
                <td className="pr-2 text-right font-mono text-amber-700">{l.debit ? money(l.debit) : ''}</td>
                <td className="pr-2 text-right font-mono text-emerald-700">{l.credit ? money(l.credit) : ''}</td>
                <td className="text-right font-mono font-semibold">{money(l.runningBalance)}</td>
              </tr>
            ))}
            {h.lines.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-400 text-sm">No entries this month.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-bold">
              <td className="py-2 pr-2 text-slate-700" colSpan={2}>Closing balance</td>
              <td></td><td></td>
              <td className={`text-right font-mono ${h.net >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{money(h.net)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-center text-sm mt-2 font-bold">{h.net >= 0 ? `${money(h.net)} payable to ${welder}` : `${money(-h.net)} advance with ${welder}`}</p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="neutral" onClick={ledgerPDF}>📄 Ledger PDF</Button>
        <Button variant={h.locked ? 'primary' : 'neutral'} disabled={!h.locked} onClick={settlementPDF}>🧾 Settlement PDF</Button>
      </div>
      {!h.locked && <p className="text-center text-[11px] text-slate-400">Settlement PDF unlocks once you Finalize this month in the Hisab screen.</p>}
      <p className="text-center text-[11px] text-slate-400">Read-only ledger. Add advances & payments in <b>Hisab</b>.</p>
    </div>
  )
}
