-- G11 (docs/DECISIONS.md 2026-09-24): "Vis E-numre" og "Vis toksiner" i Opsætning.
ALTER TABLE "users" ADD COLUMN "showAdditives" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "showToxins" BOOLEAN NOT NULL DEFAULT false;
