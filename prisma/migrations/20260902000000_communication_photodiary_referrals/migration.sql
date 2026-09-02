-- AlterTable
ALTER TABLE "users" ADD COLUMN "photoDiaryRequiresPasscode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "wantsPushNotifications" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "wantsUpdateNewsEmails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "wantsAdviceEmails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "wantsPartnerOffersEmails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "freeMonthsCredited" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referredRegisteredAt" TIMESTAMP(3) NOT NULL,
    "rewardGrantedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals"("referredUserId");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
