import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { claimForward, ForwardAbuseError } from "@/lib/forwards";
import { AddForwardedItemButton } from "@/components/AddForwardedItemButton";

// "Videresend ret/produkt til en ven" — modtager-siden. Kræver login (så vi
// kender modtagerens identitet, jf. docs/DECISIONS.md 2026-09-02); claimer
// forwarden (sætter recipientId + status OPENED) ved første besøg, hvilket
// også er hvor krydsspærringen tjekkes.
export default async function ForwardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body">Log ind for at se hvad din ven har sendt dig.</p>
        <Link href={`/login?next=/forward/${token}`} className="hf-btn-primary mt-4 inline-block h-12 px-6 leading-[48px]">
          Log ind
        </Link>
      </div>
    );
  }

  let forward;
  try {
    forward = await claimForward(token, user.id);
  } catch (error) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body text-hf-red-dark">
          {error instanceof ForwardAbuseError ? error.message : "Kunne ikke åbne linket."}
        </p>
      </div>
    );
  }

  if (!forward) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body">Linket er ikke gyldigt.</p>
      </div>
    );
  }

  const item =
    forward.kind === "PRODUCT" && forward.productId
      ? await prisma.product.findUnique({ where: { id: forward.productId } })
      : forward.dishId
        ? await prisma.dish.findUnique({ where: { id: forward.dishId } })
        : null;
  const sender = await prisma.user.findUnique({ where: { id: forward.senderId } });

  if (!item) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="hf-type-body">Varen findes ikke længere.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6 text-center">
      <p className="hf-type-body-sm opacity-70">{sender?.displayName ?? "En ven"} har sendt dig</p>
      <h1 className="hf-type-page-title mt-1">{item.name}</h1>
      <div className="mt-6">
        <AddForwardedItemButton kind={forward.kind} itemId={item.id} name={item.name} />
      </div>
    </div>
  );
}
