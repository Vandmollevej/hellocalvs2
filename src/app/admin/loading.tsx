// Vises med det samme ved sideskift i admin, mens siden henter sine data
// (docs/DECISIONS.md 2026-10-11). Menuen bliver stående og kan bruges.
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-md bg-hf-tan" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-hf-tan" />
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-hf-tan-dark bg-hf-white" />
        ))}
      </div>
      <span className="sr-only">Henter…</span>
    </div>
  );
}
