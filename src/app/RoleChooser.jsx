/**
 * RoleChooser — first screen: pick the worker interface (entry-only, no
 * password) or the Owner/Admin console (password-protected). Remembered per
 * device. Labels come from the module so each app reads naturally.
 */
export default function RoleChooser({ title, icon, floorLabel = 'Worker', floorIcon = '👷', onPick }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-5xl mb-3">{icon}</div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-slate-400 text-sm mt-1 mb-8">Choose how you'll use this device</p>

      <div className="w-full max-w-sm space-y-4">
        <button onClick={() => onPick('floor')}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 flex items-center gap-4 shadow-xl active:scale-95 transition-transform text-left">
          <div className="text-4xl w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">{floorIcon}</div>
          <div>
            <div className="font-bold text-lg">{floorLabel}</div>
            <div className="text-white/80 text-sm mt-0.5">Record material — quick &amp; simple</div>
          </div>
        </button>

        <button onClick={() => onPick('admin')}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 flex items-center gap-4 shadow-xl active:scale-95 transition-transform text-left">
          <div className="text-4xl w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">🔑</div>
          <div>
            <div className="font-bold text-lg">Owner / Admin</div>
            <div className="text-white/80 text-sm mt-0.5">Full control — dashboard &amp; reports</div>
          </div>
        </button>
      </div>
      <p className="text-slate-500 text-xs mt-8 text-center max-w-xs">You can switch anytime from the top bar.</p>
    </div>
  )
}
