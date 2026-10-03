import { redirect } from "next/navigation";
import { requirePartnerUser } from "@/lib/partner/require-partner";
import { PartnerLoginForm } from "@/components/partner/PartnerLoginForm";

export const dynamic = "force-dynamic";

export default async function PartnerLoginPage() {
  if (await requirePartnerUser()) redirect("/partner");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center">
      <h1 className="hf-type-title mb-1 text-hf-black">Log ind</h1>
      <p className="hf-type-body mb-8 text-text-secondary">Partnerportalen for Hello Cals samarbejdspartnere.</p>
      <PartnerLoginForm />
    </div>
  );
}
