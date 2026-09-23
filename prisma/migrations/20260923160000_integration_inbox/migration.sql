-- Integrationer leverer forseglede data til en anonym indbakke (docs/PRIVACY.md).

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "inboxId" TEXT;

-- AlterTable
ALTER TABLE "device_tokens" ADD COLUMN     "inboxId" TEXT;

