-- CreateTable
CREATE TABLE "frida_import_state" (
    "id" SERIAL NOT NULL,
    "figshareArticleId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frida_import_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "frida_import_state_figshareArticleId_key" ON "frida_import_state"("figshareArticleId");
