/**
 * Top navigation bar shown inside a module page; "Home" returns to the grid.
 * Uses safe-area top padding so the Home button sits BELOW the iPhone status/
 * signal area and stays tappable. A bigger tap target than before.
 */
export default function NavBar({ title, onHome }) {
  return (
    <header className="bg-slate-800 text-white px-4 flex items-center gap-3 shadow-lg no-print" style={{ paddingTop: 'calc(0.7rem + env(safe-area-inset-top))', paddingBottom: '0.7rem' }}>
      <button onClick={onHome} className="flex items-center gap-1.5 text-slate-200 hover:text-white text-sm font-semibold bg-white/10 rounded-lg px-3 py-1.5 active:scale-95">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Home
      </button>
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm flex-shrink-0">
        <img src={`${import.meta.env.BASE_URL}unico-logo.png`} alt="UNICO" className="max-w-full max-h-full object-contain" />
      </div>
      <h1 className="text-base font-semibold truncate">{title}</h1>
      <button onClick={() => window.location.reload()} className="ml-auto flex items-center gap-1.5 text-slate-200 hover:text-white text-sm font-semibold bg-white/10 rounded-lg px-3 py-1.5 active:scale-95 flex-shrink-0" aria-label="Refresh">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        Refresh
      </button>
    </header>
  )
}
