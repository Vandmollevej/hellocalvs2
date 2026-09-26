import { HfChevron } from "@/components/hf/HfChevron";
import { formatKroner, formatWeekPeriod, type IsoWeek } from "@/lib/scan/weeks";

// Ugevise accordions til Historik og Ikke afregnet (docs/OPRETTELSES-APP.md):
// ugenummer til venstre + perioden mandag–søndag; øverste uge er altid
// foldet ud. Foldet ud vises først antal billeder og beløb for ugen.

export type WeekRow = {
  id: string;
  productName: string;
  brandName: string | null;
  imageUrl: string | null;
  storeName: string | null;
  statusLabel: string;
  amountOre: number;
};

export type WeekGroup = { week: IsoWeek; rows: WeekRow[]; amountOre: number; amountLabel: string };

export function WeekAccordions({ groups, showStore, emptyText }: { groups: WeekGroup[]; showStore?: boolean; emptyText: string }) {
  if (!groups.length) {
    return (
      <p className="hf-type-body p-4 text-center" style={{ color: "var(--hf-color-text-secondary)" }}>
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => (
        <details key={group.week.key} open={index === 0} className="group overflow-hidden rounded-[8px]" style={{ background: "var(--hf-color-card)" }}>
          <summary className="flex h-12 cursor-pointer list-none items-center gap-4 px-4">
            <span className="hf-type-body w-16">Uge {group.week.week}</span>
            <span className="hf-type-body flex-1" style={{ color: "var(--hf-color-text-secondary)" }}>
              {formatWeekPeriod(group.week)}
            </span>
            <span className="transition-transform group-open:rotate-90">
              <HfChevron direction="right" />
            </span>
          </summary>
          <div className="flex justify-between border-t px-4 py-3" style={{ borderColor: "var(--hf-color-line)" }}>
            <span className="hf-type-body">{group.rows.length} billeder</span>
            <span className="hf-type-body">
              {group.amountLabel}: {formatKroner(group.amountOre)}
            </span>
          </div>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 border-t px-4 py-2" style={{ borderColor: "var(--hf-color-line)" }}>
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" className="h-12 w-12 rounded-[8px] bg-hf-white object-contain" />
                ) : (
                  <span className="h-12 w-12 rounded-[8px] bg-hf-white" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="hf-type-body block truncate">
                    {row.brandName ? `${row.brandName} ` : ""}
                    {row.productName}
                  </span>
                  <span className="hf-type-caption block" style={{ color: "var(--hf-color-text-secondary)" }}>
                    {row.statusLabel} · {formatKroner(row.amountOre)}
                  </span>
                </span>
                {showStore && (
                  <span className="hf-type-caption max-w-[35%] text-right" style={{ color: "var(--hf-color-text-secondary)" }}>
                    {row.storeName ?? "Ukendt butik"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
