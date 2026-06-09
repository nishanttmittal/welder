/**
 * Welder Contractor — module manifest. Welder = floor (entry only); admin =
 * full console (dashboard, export, manage).
 */
import { WelderProvider, useWelder } from './WelderContext'
import { todayStr } from '../../core/utils/format'
import { totalSent } from './logic/report'
import { INCHARGE_LABEL } from './config'
import Entry from './pages/Entry'
import ContractorPay from './pages/ContractorPay'
import Ledger from './pages/Ledger'
import RawMaterialStock from './pages/RawMaterialStock'
import MaterialsRecipe from './pages/MaterialsRecipe'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Export from './pages/Export'
import Admin from './pages/Admin'

function HomeStats() {
  const { dispatches, welders } = useWelder()
  const today = todayStr()
  const stat = (n, l) => (
    <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1 text-center">
      <div className="text-2xl font-bold">{n}</div><div className="text-xs text-slate-400 mt-0.5">{l}</div>
    </div>
  )
  return (
    <div className="mt-4 flex gap-3">
      {stat(totalSent(dispatches.list, today, today), 'Sent Today')}
      {stat(welders.list.length, 'Welders')}
      {stat(dispatches.list.length, 'Total Entries')}
    </div>
  )
}

export const welderModule = {
  id: 'welder',
  title: 'Welder Contractor',
  icon: '🔧',
  Provider: WelderProvider,
  HomeStats,
  inchargeLabel: INCHARGE_LABEL,
  floorPageKey: 'entry',
  floorLabel: 'Welder',
  floorIcon: '👷',
  // roles: who sees the page in their console (welders/staff use the floor entry).
  //  • Manager (incharge) + Owner: entry, history, pay, ledger, dashboard.
  //  • Owner (admin) only: export/share, materials, plating outbox + admin
  //    (rates/users/backup/reset).
  pages: [
    { key: 'entry',     title: 'Material Sent',  desc: 'Gaadi + add products → save',           icon: '➕', color: 'from-amber-600 to-amber-700', floor: true, roles: ['incharge', 'owner'], Component: Entry },
    { key: 'history',   title: 'Entries',        desc: 'View & correct entries (48h window)',   icon: '🗂️', color: 'from-amber-500 to-amber-600', roles: ['incharge', 'owner'], Component: History },
    { key: 'pay',       title: 'Contractor Pay', desc: 'Piece-rate earnings & statements',      icon: '💰', color: 'from-emerald-600 to-emerald-700', roles: ['incharge', 'owner'], Component: ContractorPay },
    { key: 'ledger',    title: 'Contractor Ledger', desc: 'Running balance, advances, settlement', icon: '📒', color: 'from-teal-600 to-teal-700', roles: ['incharge', 'owner'], Component: Ledger },
    { key: 'dashboard', title: 'Dashboard',      desc: 'Daily totals, by welder & party',      icon: '📊', color: 'from-blue-600 to-blue-700',   roles: ['incharge', 'owner'], Component: Dashboard },
    { key: 'export',    title: 'Export / Share', desc: 'Daily PDF report for WhatsApp',         icon: '📄', color: 'from-violet-600 to-violet-700', roles: ['owner'], Component: Export },
    { key: 'stock',     title: 'Raw Material Stock', desc: 'Balance + add incoming stock',      icon: '📦', color: 'from-cyan-600 to-cyan-700',   roles: ['incharge', 'owner'], Component: RawMaterialStock },
    { key: 'materials', title: 'Materials & Recipe', desc: 'Raw materials + product recipes',   icon: '🧪', color: 'from-indigo-600 to-indigo-700', roles: ['owner'], Component: MaterialsRecipe },
    { key: 'admin',     title: 'Admin',          desc: 'Rates, users, products, backup',       icon: '⚙️', color: 'from-slate-600 to-slate-700', roles: ['owner'], Component: Admin },
  ],
}
