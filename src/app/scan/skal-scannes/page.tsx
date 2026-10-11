import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { listOpenScanRequests } from "@/lib/scan/review-requests";
import { DecimalText } from "@/components/DecimalText";

// "Skal scannes" (docs/DECISIONS.md 2026-10-11): Open Food Facts-varer, som
// admin har sendt hertil, fordi de ikke lever op til kvaliteten. De findes i
// Hello Cal, men står som ikke scannet, til en agent har oprettet/suppleret
// dem med "Opret vare" (stregkoden fotograferes igen). Kommentaren viser, hvad
// der mangler.
export default async function ScanSkalScannesPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");

  const items = await listOpenScanRequests();

  return (
    <ScanScreen title="Skal scannes" showBack>
      <div className="flex flex-col gap-4 p-4">
        <p className="hf-type-body text-hf-text-secondary">
          Disse varer findes allerede, men er ikke scannet i en butik. Find varen, og scan den med &quot;Opret vare&quot;.
        </p>
        {items.length === 0 ? (
          <p className="hf-type-body bg-hf-card p-4 text-center rounded-card">Ingen varer skal scannes lige nu.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 bg-hf-card p-3 rounded-card">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-16 w-16 flex-none rounded object-contain" />
                ) : (
                  <div className="h-16 w-16 flex-none rounded bg-hf-tan" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="hf-type-strong">
                    <DecimalText text={[item.brand, item.name, item.packageSizeText].filter(Boolean).join(" ")} />
                  </p>
                  {item.barcode && <p className="hf-type-caption text-hf-text-secondary">Stregkode {item.barcode}</p>}
                  <div className="flex flex-wrap gap-1">
                    {item.categories.map((category) => (
                      <span key={category.key} className="hf-type-caption rounded-full bg-hf-tan px-2 py-0.5">
                        {category.label}
                      </span>
                    ))}
                  </div>
                  <ul className="hf-type-caption list-disc pl-4 text-hf-text-secondary">
                    {item.comments.slice(0, 4).map((comment) => (
                      <li key={comment}>{comment}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/scan/opret" className="hf-type-body text-center underline">
          Opret vare
        </Link>
      </div>
    </ScanScreen>
  );
}
