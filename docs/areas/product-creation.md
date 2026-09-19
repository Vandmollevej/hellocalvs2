# Produktoprettelse — start her

Læs [fælles kort](README.md). Den dedikerede medarbejderapp er planlagt;
der findes allerede produktoprettelse i brugerappen, som skal vurderes til genbrug.

- Formular: `src/app/product/create/page.tsx`.
- Guidet kamera: `src/app/camera/create`; delt kamera: `src/app/camera/page.tsx`.
- Billedbokse: `src/components/hf/CreateProductMediaGrid.tsx`.
- OCR/kladde/kø: `src/lib/product-ocr.ts`, `src/lib/product-draft.ts`,
  `src/lib/offline-product-queue.ts`, `src/components/OfflineQueueBanner.tsx`.
- Data/API: `src/app/api/products`; AI-udtræk:
  `src/app/api/ai/extract-nutrition`, `src/app/api/ai/extract-ingredients`.
- Kontrakt: `docs/AI.md`, `docs/DATABASE.md`, nye bekræftede krav i
  `docs/PROJECT-BOUNDARIES.md`. Design: `design.md` §6.11 og fælles regler.

Product-felter omfatter name, brandId, kcalPer100g, proteinPer100g,
carbsPer100g, fatPer100g, servingSizeGrams, ingredientsText, status,
createdByUserId og relationer til Barcode og ProductImage. Kontrollér
altid hele den relevante model og API-validering i den faktiske kode.
servingSizeGrams må ikke automatisk fortolkes som pakkens nettovægt.

Ingen dedikerede hyldefoto-/markør-/arbejdsafregningsmodeller blev fundet
i Prisma-skemaet. Medarbejderkravene kræver derfor særskilt senere design.
Bevar deling af produktdata med Hello Cal og admin. Eksisterende brugerpoints
må ikke automatisk bruges som medarbejderbetaling. Lokalkø og API'er skal
undersøges konkret før de erklæres tilstrækkelige til det nye flow.
