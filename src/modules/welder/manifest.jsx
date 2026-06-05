/**
 * Welder Contractor — module manifest. Welder = floor (entry only); admin =
 * full console (dashboard, export, manage).
 */
import { WelderProvider, useWelder } from './WelderContext'
import { todayStr } from '../../core/utils/format'
import { totalSent } from './logic/report'
import { ADMIN_PASSWORD, MANAGER_PASSWORD } from './config'
import { pipeline } from './logic/report'
import Entry from './pages/Entry'
import ReviewQueue from './pages/ReviewQueue'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Export from './pages/Export'
import Admin from './pages/Admin'

function HomeStats() {
  const { dispatches } = useWelder()
  const today = todayStr()
  const pipe = pipeline(dispatches.list)
  const waiting = pipe.pending.n + pipe.passed.n
  const stat = (n, l, tone = '') => (
    <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{n}</div><div className="text-xs text-slate-400 mt-0.5">{l}</div>
    </div>
  )
  return (
    <div className="mt-4 flex gap-3">
      {stat(totalSent(dispatches.list.filter(d => d.status === 'approved'), today, today), 'Approved Today')}
      {stat(waiting, 'Awaiting', waiting ? 'text-amber-300' : '')}
      {stat(dispatches.list.length, 'Total')}
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
  floorPageKey: 'entry',
  floorLabel: 'Welder',
  floorIcon: '👷',
  // roles: which logged-in role sees the page. Staff use the entry page (floor).
  pages: [
    { key: 'entry',     title: 'Material Sent',  desc: 'Record material sent for finishing',   icon: '➕', color: 'from-amber-600 to-amber-700', floor: true, Component: Entry },
    { key: 'review',    title: 'Approvals',      desc: 'Pass / approve entries',               icon: '✅', color: 'from-emerald-600 to-emerald-700', roles: ['manager', 'owner'], Component: ReviewQueue },
    { key: 'dashboard', title: 'Dashboard',      desc: 'Approved totals, by welder & party',   icon: '📊', color: 'from-blue-600 to-blue-700',   roles: ['owner'], Component: Dashboard },
    { key: 'history',   title: 'History',        desc: 'Edit, void or delete (logged)',        icon: '🗂️', color: 'from-amber-500 to-amber-600', roles: ['owner'], Component: History },
    { key: 'export',    title: 'Export / Share', desc: 'Daily report on WhatsApp',             icon: '📄', color: 'from-violet-600 to-violet-700', roles: ['owner'], Component: Export },
    { key: 'admin',     title: 'Admin',          desc: 'Products, welders, parties, backup',   icon: '⚙️', color: 'from-slate-600 to-slate-700', roles: ['owner'], Component: Admin },
  ],
}
