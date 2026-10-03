import { redirect } from "next/navigation";
import { requirePartnerUser } from "@/lib/partner/require-partner";
import { PartnerVerifyForm } from "@/components/partner/PartnerVerifyForm";

export const dynamic = "force-dynamic";

export default async function PartnerVerifyPage() {
  if (await requirePartnerUser()) redirect("/partner");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center">
      <h1 className="hf-type-title mb-1 text-hf-black">Bekræft med 2-faktor</h1>
      <p className="hf-type-body mb-8 text-text-secondary">Skriv den seks-cifrede kode fra jeres authenticator-app.</p>
      <PartnerVerifyForm />
    </div>
  );
}
