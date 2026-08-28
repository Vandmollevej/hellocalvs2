-- CreateTable
CREATE TABLE "additives" (
    "e_number" TEXT NOT NULL,
    "international_name" TEXT NOT NULL,
    "danish_name" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "research" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additives_pkey" PRIMARY KEY ("e_number")
);
