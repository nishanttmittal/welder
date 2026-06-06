/**
 * Welder Contractor — module manifest. Welder = floor (entry only); admin =
 * full console (dashboard, export, manage).
 */
import { WelderProvider, useWelder } from './WelderContext'
import { todayStr } from '../../core/utils/format'
import { totalSent } from './logic/report'
import { ADMIN_PASSWORD, MANAGER_PASSWORD, INCHARGE_LABEL } from './config'
import Entry from './pages/Entry'
import Dispatch from './pages/Dispatch'
import PlatingOutbox from './pages/PlatingOutbox'
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
  adminPassword: ADMIN_PASSWORD,
  managerPassword: MANAGER_PASSWORD,
  inchargeLabel: INCHARGE_LABEL,
  floorPageKey: 'entry',
  floorLabel: 'Welder',
  floorIcon: '👷',
  // roles: which logged-in role sees the page. Staff use the entry page (floor).
  // roles: who sees the page in their console. Welder/staff use the floor entry.
  // Entry + History are open to User1 & Owner; Dashboard/Export/Admin owner-only.
  pages: [
    { key: 'entry',     title: 'Material Sent',  desc: 'Record material sent for finishing',   icon: '➕', color: 'from-amber-600 to-amber-700', floor: true, floorTab: 'Add', roles: ['incharge', 'owner'], Component: Entry },
    { key: 'dispatch',  title: 'Dispatch Gaadi', desc: 'Send a vehicle → plating challan',      icon: '🚚', color: 'from-orange-600 to-orange-700', floor: true, floorTab: 'Dispatch', roles: ['incharge', 'owner'], Component: Dispatch },
    { key: 'history',   title: 'Entries',        desc: 'View & edit entries (2-day window)',    icon: '🗂️', color: 'from-amber-500 to-amber-600', roles: ['incharge', 'owner'], Component: History },
    { key: 'outbox',    title: 'Plating Outbox', desc: 'Challans ready for the Plating app',    icon: '📤', color: 'from-blue-600 to-blue-700',   roles: ['owner'], Component: PlatingOutbox },
    { key: 'dashboard', title: 'Dashboard',      desc: 'Daily totals, by welder & party',      icon: '📊', color: 'from-blue-600 to-blue-700',   roles: ['owner'], Component: Dashboard },
    { key: 'export',    title: 'Export / Share', desc: 'Daily PDF report for WhatsApp',         icon: '📄', color: 'from-violet-600 to-violet-700', roles: ['owner'], Component: Export },
    { key: 'admin',     title: 'Admin',          desc: 'Products, welders, parties, backup',   icon: '⚙️', color: 'from-slate-600 to-slate-700', roles: ['owner'], Component: Admin },
  ],
}
