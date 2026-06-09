/**
 * Daily report PDF + native share (WhatsApp). One page: total, per-welder, and
 * per-party product breakdown for a chosen date.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, fmtNum, todayStr } from '../../../core/utils/format'
import { APP_TITLE, FINISHES } from '../config'
import { byWelder, partyProductBreakdown, totalSent } from './report'

const AMBER = [180, 83, 9]
const finishLabelOf = (k) => (FINISHES.find(f => f.key === k)?.label || k || 'Raw')

/** Column header + value for a chosen grouping dimension. */
const GROUPS = {
  product: { label: 'Product',        key: (d) => d.productName || '—' },
  welder:  { label: 'Contractor',     key: (d) => d.welder || '—' },
  finish:  { label: 'Surface Finish', key: (d) => finishLabelOf(d.finish) },
  party:   { label: 'Sent To',        key: (d) => d.party || '—' },
  finishparty: { label: 'Finish → Person', key: (d) => `${finishLabelOf(d.finish)} → ${d.party || '—'}` },
}

/**
 * Flexible dispatch report — filter by date range + welder/finish/party/product,
 * grouped by product / contractor / finish / party / finish→person. Returns a
 * jsPDF doc ready to share on WhatsApp.
 */
export function buildReportPdf(dispatches, { from, to, groupBy = 'product', welder, finish, party, product }) {
  const rows = dispatches.filter(d => Number(d.qty) > 0
    && (!from || (d.date || '') >= from) && (!to || (d.date || '') <= to)
    && (!welder || d.welder === welder)
    && (!finish || d.finish === finish)
    && (!party || d.party === party)
    && (!product || d.productName === product))

  const g = GROUPS[groupBy] || GROUPS.product
  const map = {}
  for (const d of rows) { const k = g.key(d); map[k] = (map[k] || 0) + Number(d.qty) }
  const body = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmtNum(v)])
  const total = rows.reduce((s, d) => s + Number(d.qty), 0)

  const filters = [
    welder && `Contractor: ${welder}`, finish && `Finish: ${finishLabelOf(finish)}`,
    party && `Sent to: ${party}`, product && `Product: ${product}`,
  ].filter(Boolean).join('  ·  ')

  const doc = new jsPDF('p', 'pt', 'a4')
  doc.setFontSize(16); doc.setTextColor(...AMBER); doc.setFont(undefined, 'bold')
  doc.text(APP_TITLE, 40, 40)
  doc.setFontSize(13); doc.setTextColor(30, 41, 59)
  doc.text(`Report by ${g.label}`, 40, 60)
  doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont(undefined, 'normal')
  const period = from || to ? `${from ? fmtDate(from) : '…'} to ${to ? fmtDate(to) : '…'}` : 'All dates'
  doc.text(`${period}  ·  Total ${fmtNum(total)} pcs`, 40, 76)
  if (filters) doc.text(filters, 40, 90)

  autoTable(doc, {
    startY: filters ? 102 : 92,
    head: [[g.label, 'Pieces']],
    body: body.length ? body : [['No data for these filters', '']],
    foot: body.length ? [['Total', fmtNum(total)]] : undefined,
    headStyles: { fillColor: AMBER }, footStyles: { fillColor: [71, 85, 105], textColor: 255 },
    styles: { fontSize: 10 }, margin: { left: 40, right: 40 },
  })
  return doc
}

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
