# Admin — start her

Læs [fælles kort](README.md). Fokus: administration og kvalitetskontrol.

- UI: `src/app/admin`, `src/components/admin`.
- API: `src/app/api/admin`.
- Adgang: `src/lib/admin-auth.ts`, `src/lib/require-admin.ts`,
  `src/lib/admin-totp.ts`, `src/lib/admin-webauthn.ts`.
- Produktgodkendelse: `src/lib/product-approval.ts`; dubletter:
  `src/lib/product-duplicates.ts`; beskeder: `src/lib/messaging.ts`.
- Kontrakt: `docs/ADMIN.md`; nyere medarbejderkrav:
  `docs/PROJECT-BOUNDARIES.md` (planlagte, ikke implementeret af dette arbejde).

Læs relevante Product-, ProductImage-, ProductDuplicateLink-, BugReport-,
User-, AdminAuditLog- og MessageTemplate-modeller i `prisma/schema.prisma`.
Produktændringer påvirker Hello Cal og oprettelse; godkendelse påvirker
brugerpoints og beskeder. Genbrug fælles funktioner frem for lokal kopi.

Ansatteliste, aflønningsregistrering og hyldeflow er nye krav. Det aktuelle
skema har ikke en dedikeret medarbejder-/aflønningsmodel. User og
PointsTransaction er ikke i sig selv en løsning til lønudbetaling.
Adskil accept af medarbejderarbejde fra produktets datakvalitet.

Design: fælles kort, eksisterende `src/components/admin` og de relevante
afsnit af `design.md`. Dette kort giver ikke almindelige ansatte adminrettigheder.
