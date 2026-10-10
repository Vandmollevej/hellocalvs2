-- Flertalstitel til varer (Frida-arket, 2026-10-09)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "namePlural" TEXT;
