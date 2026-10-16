import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getOpenAiUsage } from "@/lib/openai-usage";
import { OpenAiUsagePanel } from "@/components/admin/OpenAiUsagePanel";

export const dynamic = "force-dynamic";

// Admin "OpenAI" (docs/DECISIONS.md 2026-10-16): status på API-nøglen,
// forbrug i dollar og anslået resterende kredit.
export default async function OpenAiUsagePage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const data = await getOpenAiUsage();

  return (
    <div className="hf-admin-page">
      <div>
        <h1 className="hf-type-title text-hf-black">OpenAI</h1>
        <p className="hf-type-body mt-1 text-text-secondary">
          Kører AI-kaldene, hvad koster de, og hvor meget kredit er der tilbage.
        </p>
      </div>
      <OpenAiUsagePanel initial={data} />
    </div>
  );
}
