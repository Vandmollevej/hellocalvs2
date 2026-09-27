import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/admin-i18n";
import { GUIDE_KINDS, defaultGuideConfig, sanitizeGuideConfig, type GuideConfig, type GuideKind } from "@/lib/guide-builder";
import { GuideBuilder } from "@/components/admin/GuideBuilder";

// Admin → Design → Guide-builder: startup-guide og tooltips
// (docs/DECISIONS.md 2026-09-27).
export default async function AdminGuideBuilderPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  let dbUnavailable = false;
  const configs = Object.fromEntries(GUIDE_KINDS.map((kind) => [kind, defaultGuideConfig(kind)])) as Record<GuideKind, GuideConfig>;
  try {
    const rows = await prisma.guideDesign.findMany();
    for (const row of rows) {
      if (row.kind === "startup" || row.kind === "tooltips") configs[row.kind] = sanitizeGuideConfig(row.kind, row.config);
    }
  } catch (error) {
    console.error("Failed to load guide designs", error);
    dbUnavailable = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "gb_title")}</h1>
        <p className="text-sm text-text-secondary">{t(admin.locale, "gb_intro")}</p>
      </div>
      <GuideBuilder locale={admin.locale} initialConfigs={configs} dbUnavailable={dbUnavailable} />
    </div>
  );
}
