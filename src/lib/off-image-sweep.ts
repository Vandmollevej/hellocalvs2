import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createExternalImageCutoutJob } from "@/lib/image-cutout-jobs";

// Løbende robot "off-image-sweep" (bruger 2026-10-17): alle Open Food Facts-
// varer skal fritlægges på lige fod med kameraets egne fotos, og først skal
// et matchende billede søges online. Varer, der oprettes ved en scanning, får
// det allerede (createExternalImageCutoutJob i stregkodeopslaget); denne robot
// tager resten — fx importerede eller ældre OFF-varer — ved at lægge samme
// PRODUCT_FRONT-job i kø. Derefter søger logo-agentens "product-image-search"
// (Google Vision WEB_DETECTION) online, og image-agent fritlægger; resultatet
// går som altid via admin (Billedforslag / pendingImageUrl).
// Varer, brugerne har scannet, tages først. Højst MAX_PER_RUN pr. kørsel, så
// Google Vision-forbruget holdes nede.

const MAX_PER_RUN = 50;

const eligible: Prisma.ProductWhereInput = {
  externalSource: "OPEN_FOOD_FACTS",
  deletedAt: null,
  imageUrl: { startsWith: "https://" },
  pendingImageUrl: null,
  // Afviste OFF-billeder må ikke fritlægges (admin Open Food Facts → Billeder).
  OR: [{ offImageReview: null }, { offImageReview: "APPROVED" }],
  // Har varen allerede et forsidejob (scanning, natlig AI-aflæsning, genscanning), er den i gang.
  cutoutJobs: { none: { kind: "PRODUCT_FRONT" } },
};

export async function queueOffImageCutouts(): Promise<string> {
  const scanned = await prisma.product.findMany({
    where: { ...eligible, productScans: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_RUN,
    select: { id: true, imageUrl: true },
  });
  const rest =
    scanned.length < MAX_PER_RUN
      ? await prisma.product.findMany({
          where: { ...eligible, productScans: { none: {} } },
          orderBy: { createdAt: "desc" },
          take: MAX_PER_RUN - scanned.length,
          select: { id: true, imageUrl: true },
        })
      : [];

  let queued = 0;
  for (const product of [...scanned, ...rest]) {
    try {
      await createExternalImageCutoutJob(product.id, product.imageUrl);
      queued += 1;
    } catch (error) {
      console.error("off-image-sweep: could not queue", product.id, error);
    }
  }
  return `${queued} Open Food Facts-varer lagt i kø til billedsøgning og fritlægning (${scanned.length} scannet af brugere)`;
}
