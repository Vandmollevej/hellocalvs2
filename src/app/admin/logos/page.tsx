import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { LogoReviewList } from "@/components/admin/LogoReviewList";

// Admin "Logoer" (docs/LOGO-AGENT.md): logo-robottens fund under 90 %
// (eller uden brandnavn på siden) venter her på et manuelt valg. Hver række:
// brandnavn, originalen fra produktfotoet og det bedste fund.
export default async function AdminLogosPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const searches = await prisma.brandLogoSearch.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: {
      brand: { select: { name: true } },
      candidates: { orderBy: { confidence: "desc" }, take: 10 },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Logoer</h1>
        <p className="text-sm text-text-secondary">
          {searches.length} brands venter. Robotten gemmer selv logoer over 90 %, når brandnavnet også står på siden. Klik en række for at
          sammenligne og vælge. Hentede billeder slettes 7 dage efter valget.
        </p>
      </div>
      <LogoReviewList
        searches={searches.map((search) => ({
          id: search.id,
          brandName: search.brand.name,
          originalUrl: search.originalUrl,
          candidates: search.candidates.map((candidate) => ({
            id: candidate.id,
            imageUrl: candidate.imageUrl,
            confidence: candidate.confidence,
            pageUrl: candidate.pageUrl ?? candidate.sourceUrl,
            brandInPage: candidate.brandInPage,
            width: candidate.width,
            height: candidate.height,
          })),
        }))}
      />
    </div>
  );
}
