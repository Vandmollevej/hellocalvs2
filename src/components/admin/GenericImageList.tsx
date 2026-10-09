// "Generiske billeder": generiske varer (produkttype) med billede og tekst, vist som
// listen på produktsiden (miniature + navn). Kun visning; billeder lægges op i feltet ovenfor.

export type GenericImageRow = { id: string; name: string; imageUrl: string | null; cooked: boolean };

export function GenericImageList({ rows }: { rows: GenericImageRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="hf-type-body hf-type-strong text-hf-black">Generiske billeder</h3>
      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen generiske varer endnu.</p>
      ) : (
        <ul className="hf-surface max-h-[40rem] divide-y divide-border-strong overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-4 px-4 py-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hf-tan-dark bg-hf-white">
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
                ) : (
                  <span className="hf-type-micro text-text-muted">Intet</span>
                )}
              </div>
              <span className="hf-type-body min-w-0 flex-1 truncate text-hf-black">{row.name}</span>
              {row.cooked && <span className="hf-type-small text-text-secondary">Tilberedt</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
