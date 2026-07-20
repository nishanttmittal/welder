/**
 * SaveStatus — tells a worker whether their entry actually reached the cloud.
 *
 * The screens used to say "Saved ✓" the moment a write was handed to Firestore,
 * before the server confirmed anything, so a rejected write was invisible.
 *
 * Three states, and the distinction between the first two matters:
 *   • saved   — nothing to say, so this renders NOTHING. Silence = fine.
 *   • pending — saved on the phone, still syncing. COMPLETELY NORMAL in a
 *               factory with patchy internet. Deliberately calm/amber, never
 *               red: work is not lost and there is nothing for anyone to do.
 *   • failed  — the server actually rejected the write. This one is red,
 *               because someone has to re-enter it.
 *
 * Sits above the bottom bar so it never covers the entry buttons.
 */
export default function SaveStatus({ pending, failed, onDismiss }) {
  if (!pending && !failed) return null

  const isFail = failed > 0
  return (
    <div
      className="fixed inset-x-0 flex justify-center px-3 no-print z-40 pointer-events-none"
      style={{ bottom: 'calc(3.2rem + env(safe-area-inset-bottom))' }}
    >
      <div
        role="status"
        aria-live="polite"
        onClick={isFail ? onDismiss : undefined}
        className={`pointer-events-auto rounded-full shadow-lg px-4 py-2 text-sm font-bold flex items-center gap-2 max-w-full ${
          isFail
            ? 'bg-red-600 text-white cursor-pointer'
            : 'bg-amber-100 text-amber-900 border border-amber-300'
        }`}
      >
        {isFail ? (
          <>
            <span aria-hidden>⚠</span>
            <span className="truncate">
              {failed} एंट्री नहीं भेजी गई — दोबारा भरें · {failed} not saved, please re-enter
            </span>
            <span className="opacity-70 flex-shrink-0">✕</span>
          </>
        ) : (
          <>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden />
            <span className="truncate">सेव हो रहा है… · Saving…</span>
          </>
        )}
      </div>
    </div>
  )
}
