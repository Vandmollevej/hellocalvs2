-- Målsætninger (docs/DECISIONS.md, 2026-09-22): historiske, daterede
-- målsætninger for vægt og kropsmål. Hand-written, same reason as other recent
-- migrations in this project — no local PostgreSQL reachable from this
-- workstation to run `prisma migrate dev`.

-- CreateEnum
CREATE TYPE "GoalDirection" AS ENUM ('INCREASE', 'DECREASE', 'MAINTAIN');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_targets" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "startValue" DOUBLE PRECISION,
    "direction" "GoalDirection",
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "goal_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_userId_createdAt_idx" ON "goals"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "goal_targets_goalId_type_key" ON "goal_targets"("goalId", "type");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing users."targetWeightKg" becomes a historical weight
-- goal, so no existing target weight disappears. The start value is the
-- latest weigh-in (falling back to the profile start weight); the column
-- itself is kept and stays in sync with the newest weight goal.
INSERT INTO "goals" ("id", "userId", "createdAt")
SELECT 'goal_backfill_' || u."id", u."id", CURRENT_TIMESTAMP
FROM "users" u
WHERE u."targetWeightKg" IS NOT NULL;

INSERT INTO "goal_targets" ("id", "goalId", "type", "value", "unit", "startValue", "direction")
SELECT
    'goaltarget_backfill_' || u."id",
    'goal_backfill_' || u."id",
    'weight',
    u."targetWeightKg",
    'kg',
    s."start",
    CASE
        WHEN s."start" IS NULL THEN NULL
        WHEN u."targetWeightKg" > s."start" THEN 'INCREASE'::"GoalDirection"
        WHEN u."targetWeightKg" < s."start" THEN 'DECREASE'::"GoalDirection"
        ELSE 'MAINTAIN'::"GoalDirection"
    END
FROM "users" u
CROSS JOIN LATERAL (
    SELECT COALESCE(
        (SELECT w."weightKg" FROM "weight_entries" w WHERE w."userId" = u."id" ORDER BY w."weighedAt" DESC LIMIT 1),
        u."weightKg"
    ) AS "start"
) s
WHERE u."targetWeightKg" IS NOT NULL;
