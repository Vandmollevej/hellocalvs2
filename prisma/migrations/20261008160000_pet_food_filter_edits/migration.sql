-- CreateTable
CREATE TABLE "pet_food_filter_edits" (
    "id" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_food_filter_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pet_food_filter_edits_list_value_key" ON "pet_food_filter_edits"("list", "value");
