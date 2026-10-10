-- Beskrivelse og varighed på egne retter (Opret ret-flowet, 2026-10-09)
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "dishes" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
