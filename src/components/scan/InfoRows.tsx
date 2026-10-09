// Read-only rækker til Profil/Bankoplysninger (kun admin kan ændre data).
export function InfoRows({ rows, note }: { rows: [string, string | null][]; note?: string }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <ul className="overflow-hidden bg-hf-card rounded-card">
        {rows.map(([label, value]) => (
          <li
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 border-b px-4 py-2 last:border-b-0 border-hf-line"
          >
            <span className="hf-type-body text-hf-text-secondary">
              {label}
            </span>
            <span className="hf-type-body text-right">{value || "—"}</span>
          </li>
        ))}
      </ul>
      {note && (
        <p className="hf-type-caption text-hf-text-secondary">
          {note}
        </p>
      )}
    </div>
  );
}
