import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { FORWARD_SENDER_FALLBACK, loadForwardView } from "@/lib/forward-view";
import { AddForwardedItemButton } from "@/components/AddForwardedItemButton";

// "Videresend ret/produkt til en ven" — modtager-siden. Kræver login (så vi
// kender modtagerens identitet, jf. docs/DECISIONS.md 2026-09-02); claimer
// forwarden (sætter recipientId + status OPENED) ved første besøg, hvilket
// også er hvor krydsspærringen tjekkes. Selve opslaget ligger i
// src/lib/forward-view.ts, som også bruges af GET /api/forwards/[token].
export default async function ForwardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-sm p-4 text-center">
        <p className="hf-type-body">Log ind for at se hvad din ven har sendt dig.</p>
        <Link href={`/login?next=/forward/${token}`} className="hf-control hf-btn-primary mt-4 inline-block px-6 leading-[48px]">
          Log ind
        </Link>
      </div>
    );
  }

  const view = await loadForwardView(token, user.id);

  if (view.status === "error") {
    return (
      <div className="mx-auto max-w-sm p-4 text-center">
        <p className="hf-type-body text-hf-red-dark">{view.message}</p>
      </div>
    );
  }

  if (view.status !== "ok") {
    return (
      <div className="mx-auto max-w-sm p-4 text-center">
        <p className="hf-type-body">{view.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-4 text-center">
      <p className="text-text-secondary hf-type-body">{view.senderDisplayName ?? FORWARD_SENDER_FALLBACK} har sendt dig</p>
      <h1 className="hf-type-page-title mt-1">{view.item.name}</h1>
      <div className="mt-8">
        <AddForwardedItemButton kind={view.kind} itemId={view.item.id} name={view.item.name} amountGrams={view.amountGrams} />
      </div>
    </div>
  );
}
