-- Invitér en ven via engangslinks uden gemt afsender→modtager-kobling (docs/PRIVACY.md).

-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_rewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eligibleOn" DATE NOT NULL,
    "grantedAt" TIMESTAMP(3),

    CONSTRAINT "invite_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_codeHash_key" ON "invite_links"("codeHash");

-- CreateIndex
CREATE INDEX "invite_links_inviterId_idx" ON "invite_links"("inviterId");

-- CreateIndex
CREATE INDEX "invite_rewards_eligibleOn_idx" ON "invite_rewards"("eligibleOn");

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_rewards" ADD CONSTRAINT "invite_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

