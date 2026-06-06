/**
 * AppShell — 3-tier access for the Welder app:
 *   • Staff (welder): ?welder=1&who=Name → entry only (data entry, status pending).
 *   • Manager: ?role=manager (or chooser) → review & PASS entries; no edit/create/delete.
 *   • Owner: ?role=owner (or chooser) → approve + full + dashboard + history + admin.
 * iPhone fix: the Switch button lives in a BOTTOM bar (not under the status/signal
 * area at the top), and top bars use safe-area padding so their controls are reachable.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import { PasswordGate } from '../core/ui'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'
import RoleChooser from './RoleChooser'

const ROLE_KEY = 'wld:role'

/** Bottom-fixed bar — reachable on phones, away from the top status area. */
function BottomBar({ label, onSwitch }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-slate-900 text-slate-300 px-4 flex items-center justify-between text-xs no-print z-30"
      style={{ paddingTop: '0.6rem', paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom))' }}>
      <span className="font-semibold tracking-wide uppercase truncate">{label}</span>
      {onSwitch && <button onClick={onSwitch} className="flex items-center gap-1 bg-white/15 rounded-lg px-3 py-1.5 font-bold flex-shrink-0">⇄ Switch</button>}
    </div>
  )
}

function StaffView({ module, operator, onSwitch }) {
  const page = module.pages.find(p => p.key === module.floorPageKey) || module.pages[0]
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 no-print" style={{ paddingTop: 'calc(0.9rem + env(safe-area-inset-top))', paddingBottom: '0.9rem' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg">{module.icon}</div>
          <div><div className="font-bold leading-tight">{module.title}</div><div className="text-white/80 text-xs">{page.title}{operator ? ` · ${operator}` : ''}</div></div>
        </div>
      </header>
      <page.Component floor operator={operator} />
      {onSwitch && <BottomBar label={`Welder${operator ? ' · ' + operator : ''}`} onSwitch={onSwitch} />}
    </div>
  )
}

function Console({ module, level, onSwitch }) {
  const [activeKey, setActiveKey] = useState(null)
  const owner = level === 'owner'
  const by = owner ? 'Owner' : (module.inchargeLabel || 'User1')
  const pages = module.pages.filter(p => (p.roles || []).includes(level))
  const view = { ...module, pages }
  const activePage = pages.find(p => p.key === activeKey)
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {activePage ? (
        <>
          <NavBar title={activePage.title} onHome={() => setActiveKey(null)} />
          <activePage.Component level={level} owner={owner} by={by} />
        </>
      ) : (
        <ModuleHome module={view} onOpen={setActiveKey} />
      )}
      <BottomBar label={owner ? 'Owner' : (module.inchargeLabel || 'In-Charge')} onSwitch={onSwitch} />
    </div>
  )
}

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY))
  const pick = (r) => { localStorage.setItem(ROLE_KEY, r); setRole(r) }
  const reset = () => { localStorage.removeItem(ROLE_KEY); setRole(null) }

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const staffLock = params && (params.has('welder') || params.has('floor'))
  const who = (params && params.get('who')) || ''
  const roleParam = params && params.get('role') // 'user1' | 'owner' (dedicated links)
  const normParam = roleParam === 'user1' ? 'incharge' : roleParam

  if (staffLock) return <Provider><StaffView module={module} operator={who} /></Provider>

  const effective = normParam === 'incharge' || normParam === 'owner' ? normParam : role

  return (
    <Provider>
      {!effective && <RoleChooser title={module.title} icon={module.icon} inchargeLabel={module.inchargeLabel} onPick={pick} />}
      {effective === 'incharge' && (
        <PasswordGate password={[module.managerPassword, module.adminPassword]} title={`${module.inchargeLabel || 'In-Charge'} — Login`}>
          <Console module={module} level="incharge" onSwitch={roleParam ? null : reset} />
        </PasswordGate>
      )}
      {effective === 'owner' && (
        <PasswordGate password={module.adminPassword} title="Owner — Login">
          <Console module={module} level="owner" onSwitch={roleParam ? null : reset} />
        </PasswordGate>
      )}
    </Provider>
  )
}
