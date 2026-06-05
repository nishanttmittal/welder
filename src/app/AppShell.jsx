/**
 * AppShell — mounts the module Provider, then routes to one of two interfaces:
 *   • Welder (floor) — entry-only page, no password. `?welder` (or `?floor`)
 *     locks the device to this view (no admin, no Switch).
 *   • Owner/Admin — password-gated console (card grid + all pages).
 * Role is remembered per device.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import { PasswordGate } from '../core/ui'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'
import RoleChooser from './RoleChooser'

const ROLE_KEY = 'wld:role'

function RoleBar({ label, onSwitch }) {
  return (
    <div className="bg-slate-900 text-slate-300 px-4 py-2 flex items-center justify-between text-xs no-print">
      <span className="font-semibold tracking-wide uppercase">{label}</span>
      {onSwitch && (
        <button onClick={onSwitch} className="flex items-center gap-1 text-slate-400 hover:text-white font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Switch
        </button>
      )}
    </div>
  )
}

function AdminConsole({ module, onSwitch }) {
  const [activeKey, setActiveKey] = useState(null)
  const activePage = module.pages.find(p => p.key === activeKey)
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label="Admin Console" onSwitch={onSwitch} />
      {activePage ? (
        <>
          <NavBar title={activePage.title} onHome={() => setActiveKey(null)} />
          <activePage.Component />
        </>
      ) : (
        <ModuleHome module={module} onOpen={setActiveKey} />
      )}
    </div>
  )
}

function FloorView({ module, onSwitch }) {
  const page = module.pages.find(p => p.key === module.floorPageKey) || module.pages[0]
  const label = module.floorLabel || 'Worker'
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label={label} onSwitch={onSwitch} />
      <header className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-4 no-print">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg">{module.icon}</div>
          <div>
            <div className="font-bold leading-tight">{module.title}</div>
            <div className="text-white/80 text-xs">{page.title}</div>
          </div>
        </div>
      </header>
      <page.Component floor />
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
  const floorOnly = params && (params.has('welder') || params.has('floor'))

  return (
    <Provider>
      {floorOnly ? (
        <FloorView module={module} />
      ) : (
        <>
          {!role && <RoleChooser title={module.title} icon={module.icon} floorLabel={module.floorLabel} floorIcon={module.floorIcon} onPick={pick} />}
          {role === 'floor' && <FloorView module={module} onSwitch={reset} />}
          {role === 'admin' && (
            <PasswordGate password={module.adminPassword} title="Admin Console — Login">
              <AdminConsole module={module} onSwitch={reset} />
            </PasswordGate>
          )}
        </>
      )}
    </Provider>
  )
}
