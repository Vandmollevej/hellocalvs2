-- Videresend ret: udløb, modtager, hilsen og afsendernavn (2026-10-09)
ALTER TABLE "forwards" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "forwards" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "forwards" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "forwards" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "forwards" ADD COLUMN IF NOT EXISTS "fromName" TEXT;
