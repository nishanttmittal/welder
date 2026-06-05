/**
 * Daily report PDF + native share (WhatsApp). One page: total, per-welder, and
 * per-party product breakdown for a chosen date.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, fmtNum, todayStr } from '../../../core/utils/format'
import { APP_TITLE } from '../config'
import { byWelder, partyProductBreakdown, totalSent } from './report'

const AMBER = [180, 83, 9]

export function buildDailyPdf(dispatches, date) {
  const doc = new jsPDF('p', 'pt', 'a4')
  doc.setFontSize(16); doc.setTextColor(...AMBER); doc.setFont(undefined, 'bold')
  doc.text(APP_TITLE, 40, 40)
  doc.setFontSize(13); doc.setTextColor(30, 41, 59)
  doc.text(`Daily Dispatch Report — ${fmtDate(date)}`, 40, 60)
  doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont(undefined, 'normal')
  doc.text(`Total sent: ${fmtNum(totalSent(dispatches.filter(d => d.date === date)))} pcs · Generated ${fmtDate(todayStr())}`, 40, 76)

  // Per welder
  autoTable(doc, {
    startY: 92,
    head: [['Welder', 'Pieces Sent']],
    body: byWelder(dispatches, date, date).map(w => [w.welder, fmtNum(w.qty)]),
    headStyles: { fillColor: AMBER }, styles: { fontSize: 10 },
  })

  // Per party → products
  let y = doc.lastAutoTable.finalY + 20
  for (const grp of partyProductBreakdown(dispatches, date)) {
    autoTable(doc, {
      startY: y,
      head: [[`${grp.party}  (${fmtNum(grp.total)} pcs)`, 'Qty']],
      body: grp.items.map(i => [i.name, fmtNum(i.qty)]),
      headStyles: { fillColor: [71, 85, 105] }, styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 14
  }
  return doc
}

export async function sharePdf(doc, filename) {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared' }
    catch (e) { if (e.name === 'AbortError') return 'cancelled' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
