/**
 * Route-level loading skeleton. Shapes mirror the common page layout
 * (header rule → scorecard row → wide panel) so the swap-in doesn't jump.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 border-b border-line pb-5">
        <div className="h-7 w-64 rounded bg-surface-2" />
        <div className="mt-3 h-3.5 w-96 max-w-full rounded bg-surface-2/70" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface px-4 py-3.5">
            <div className="h-2.5 w-14 rounded bg-surface-2" />
            <div className="mt-3 h-6 w-20 rounded bg-surface-2" />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-lg border border-line bg-surface lg:col-span-2" />
        <div className="h-64 rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}
