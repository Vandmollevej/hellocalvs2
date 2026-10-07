import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { DEFAULT_ATTIRE_SETTINGS } from "@/lib/weigh-attire";
import { saveWeightAttireSettings } from "./actions";

// Admin: algoritmen, der gætter tøjet ved en vejning (2026-10-07). Den kigger
// på brugerens seneste vejninger med bekræftet tøj og vælger det mest brugte
// omkring samme tidspunkt på dagen.
export default async function AdminWeightAttirePage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const row = await prisma.weightAttireSettings.findUnique({ where: { id: 1 } });
  const s = row ?? DEFAULT_ATTIRE_SETTINGS;

  const field = "w-28 rounded border border-hf-tan-dark bg-page-bg px-3 py-2";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Vejning: tøj-algoritme</h1>
        <p className="hf-type-body text-text-secondary">
          Når en bruger vejer sig, sætter algoritmen tøj-valget automatisk. Den ser på de seneste vejninger med bekræftet
          tøj og tager det valg, der oftest er brugt omkring samme tidspunkt på dagen. Mangler den data, bruges
          standardreglen: undertøj før det valgte klokkeslæt, ellers tøj med mobil i lommen.
        </p>
      </div>
      <form action={saveWeightAttireSettings} className="hf-surface flex max-w-xl flex-col gap-4 p-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-5" />
          <span className="hf-type-body">Algoritmen er slået til (ellers bruges kun standardreglen)</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="hf-type-body hf-type-strong">Antal seneste vejninger, den lærer af</span>
          <input name="lookbackCount" type="number" min={1} max={100} defaultValue={s.lookbackCount} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hf-type-body hf-type-strong">Tidsvindue omkring klokkeslættet (timer, ±)</span>
          <input name="windowHours" inputMode="decimal" defaultValue={String(s.windowHours).replace(".", ",")} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hf-type-body hf-type-strong">Standard: undertøj før kl.</span>
          <input name="underwearBefore" type="number" min={0} max={24} defaultValue={s.underwearBefore} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hf-type-body hf-type-strong">Synk-popup når der er gået (timer)</span>
          <input name="syncStaleHours" type="number" min={1} defaultValue={s.syncStaleHours} className={field} />
        </label>
        <button type="submit" className="hf-btn-primary h-12 px-4">
          Gem
        </button>
      </form>
    </div>
  );
}
