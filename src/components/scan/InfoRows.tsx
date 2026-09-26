// Read-only rækker til Profil/Bankoplysninger (kun admin kan ændre data).
export function InfoRows({ rows, note }: { rows: [string, string | null][]; note?: string }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <ul className="overflow-hidden rounded-[8px]" style={{ background: "var(--hf-color-card)" }}>
        {rows.map(([label, value]) => (
          <li
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 border-b px-4 py-2 last:border-b-0"
            style={{ borderColor: "var(--hf-color-line)" }}
          >
            <span className="hf-type-body" style={{ color: "var(--hf-color-text-secondary)" }}>
              {label}
            </span>
            <span className="hf-type-body text-right">{value || "—"}</span>
          </li>
        ))}
      </ul>
      {note && (
        <p className="hf-type-caption" style={{ color: "var(--hf-color-text-secondary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
