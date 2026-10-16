import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { QualityControlTabs } from "@/components/admin/QualityControlTabs";
import { IncompleteImageList, type IncompleteImageRow } from "@/components/admin/IncompleteImageList";

// Kvalitetskontrol → Ufuldstændige billeder (docs/DECISIONS.md 2026-10-16):
// billeder, som nat-jobbet "image-screen-local" har markeret som afskåret,
// med hånd over eller åben/halvfuld vare. Admin afviser fejlmarkeringer.
export default async function AdminIncompleteImagesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const screenings = await prisma.productImageScreening.findMany({
    where: { reviewedAt: null, NOT: { flags: { isEmpty: true } }, product: { deletedAt: null } },
    include: { product: { select: { id: true, name: true, brand: { select: { name: true } } } } },
    orderBy: { screenedAt: "desc" },
    take: 200,
  });
  const [screened, flagged] = await Promise.all([
    prisma.productImageScreening.count(),
    prisma.productImageScreening.count({ where: { NOT: { flags: { isEmpty: true } } } }),
  ]);

  const rows: IncompleteImageRow[] = screenings.map((s) => ({
    productId: s.productId,
    productName: s.product.name,
    brandName: s.product.brand?.name ?? null,
    imageUrl: s.imageUrl,
    flags: s.flags,
  }));

  return (
    <div className="hf-admin-page">
      <h1 className="hf-type-title text-hf-black">{t(admin.locale, "quality_control_title")}</h1>
      <QualityControlTabs active="incompleteImages" locale={admin.locale} />
      <p className="hf-type-caption">
        {t(admin.locale, "incomplete_images_hint")} ({screened} / {flagged})
      </p>
      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">{t(admin.locale, "quality_control_empty")}</p>
      ) : (
        <IncompleteImageList rows={rows} locale={admin.locale} />
      )}
      <p className="hf-type-caption">
        <Link href="/admin/cron-jobs">{t(admin.locale, "incomplete_images_job")}</Link>
      </p>
    </div>
  );
}
