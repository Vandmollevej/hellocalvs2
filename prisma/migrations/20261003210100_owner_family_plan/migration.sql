-- Ejerens egen app-konto får Seriøs Familie uden udløb (ejerens ønske
-- 2026-10-03), så familiefunktionerne kan bruges med den almindelige konto
-- og ikke kun med admin-kontoen. Ingen betalingsudbyder: tæller som
-- "comped" i statistikken. Har kontoen allerede en rigtig betalingsaftale,
-- sættes kun planen, så Stripe/MobilePay fortsat styrer status og periode.
INSERT INTO "subscriptions" ("id", "userId", "status", "plan", "currentPeriodEnd", "createdAt", "updatedAt")
SELECT replace(gen_random_uuid()::text, '-', ''), u."id", 'ACTIVE', 'FAMILY', NULL, NOW(), NOW()
FROM "users" u
WHERE lower(u."email") = 'peter@packroff.dk'
  AND u."forgottenAt" IS NULL
ON CONFLICT ("userId") DO UPDATE SET
  "plan" = 'FAMILY',
  "status" = CASE WHEN "subscriptions"."providerSubscriptionId" IS NULL THEN 'ACTIVE'::"SubscriptionStatus" ELSE "subscriptions"."status" END,
  "currentPeriodEnd" = CASE WHEN "subscriptions"."providerSubscriptionId" IS NULL THEN NULL ELSE "subscriptions"."currentPeriodEnd" END,
  "updatedAt" = NOW();
