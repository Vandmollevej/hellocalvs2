-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "totpSecret" TEXT;
