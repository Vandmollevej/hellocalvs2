import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadCutoutQueue, formatCopenhagenDateTime } from "@/lib/cutout-queue";
import { ImagesTabs } from "@/components/admin/ImagesTabs";
import { CutoutQueueList } from "@/components/admin/CutoutQueueList";

// Admin → Varegodkendelse → "Billeder i kø til frilæggelse" (docs/DECISIONS.md
// 2026-10-02): fotos der venter på at få fjernet baggrunden, med en besked der
// følger robottens rigtige plan. Planen og sidste kørsel vises nedenunder.
export const dynamic = "force-dynamic";

export default async function AdminCutoutQueuePage() {
  if (!(await requireAdminUser())) redirect("/admin/login");

  const queue = await loadCutoutQueue();
  const count = queue.pending.length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Billedbehandling</h1>
      <ImagesTabs active="cutoutQueue" />
      <p className="hf-type-body text-text-secondary">
        {count === 0 ? "Ingen billeder venter på frilæggelse." : count === 1 ? "1 billede venter på at få fjernet baggrunden." : `${count} billeder venter på at få fjernet baggrunden.`}
      </p>
      <CutoutQueueList rows={queue.pending} emptyText="Køen er tom." />
      <div className="rounded-lg border border-hf-tan-dark bg-hf-tan px-4 py-3">
        <p className="hf-type-strong text-hf-black">
          {queue.robot.notice}
        </p>
        <p className="hf-type-small text-text-secondary">
          {queue.robot.name}: {queue.robot.plan}
          {queue.robot.lastRunAt && ` · sidst kørt ${formatCopenhagenDateTime(queue.robot.lastRunAt)}${queue.robot.lastStatus ? ` (${queue.robot.lastStatus})` : ""}`}
          {" · "}
          <Link href="/admin/robots" className="underline hover:text-text-primary">
            Robotter
          </Link>
        </p>
      </div>
      {queue.failed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="hf-type-strong text-hf-black">Fejlede ({queue.failed.length})</h2>
          <p className="hf-type-small text-text-secondary">Robotten kunne ikke fritlægge disse. De prøves ikke igen af sig selv.</p>
          <CutoutQueueList rows={queue.failed} emptyText="" />
        </section>
      )}
    </div>
  );
}
