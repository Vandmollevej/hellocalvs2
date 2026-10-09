/* eslint-disable @typescript-eslint/no-require-imports */
// Idempotent backfill: krypterer User.email + User.displayName + User.phone og udfylder
// User.emailHash for eksisterende raekker (docs/DEPLOYMENT.md, "Feltkryptering").
//
// Koeres INDE I app-containeren (faar noeglerne fra containerens miljoe):
//   dry-run:  docker compose ... exec -T app node - < scripts/encrypt-user-data/backfill.cjs
//   for alvor: docker compose ... exec -T app node - --apply < scripts/encrypt-user-data/backfill.cjs
// (`node - --apply` => stdin er scriptet; argv indeholder --apply.)
//
// Format SKAL vaere identisk med src/lib/user-crypto.ts. Skriver aldrig vaerdier
// eller noegler til loggen. Raekker der allerede er krypterede springes over.
const { createCipheriv, createHmac, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const PREFIX = "enc:v1:";
const apply = process.argv.includes("--apply");

function need(name, min) {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} mangler i miljoeet.`);
  const key = Buffer.from(raw, "base64");
  if (key.length < min) throw new Error(`${name} er for kort.`);
  return key;
}
const dataKey = need("USER_DATA_KEY", 32).subarray(0, 32);
if (Buffer.from(process.env.USER_DATA_KEY, "base64").length !== 32) throw new Error("USER_DATA_KEY skal vaere praecis 32 bytes.");
const hashKey = need("USER_EMAIL_HASH_KEY", 16);

function enc(plain) {
  if (plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", dataKey, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
const hash = (e) => createHmac("sha256", hashKey).update(e.trim().toLowerCase()).digest("hex");

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const rows = await prisma.$queryRaw`
    SELECT "id", "email", "displayName", "phone", "emailHash" FROM "User"
    WHERE "emailHash" IS NULL OR "email" NOT LIKE 'enc:v1:%' OR "displayName" NOT LIKE 'enc:v1:%'
       OR ("phone" IS NOT NULL AND "phone" NOT LIKE 'enc:v1:%')`;
  console.log(`${rows.length} raekke(r) skal behandles (${apply ? "APPLY" : "dry-run"}).`);
  let done = 0;
  const failed = [];
  for (const r of rows) {
    // Hvis email allerede er krypteret men hash mangler, kan hash ikke udledes uden at dekryptere.
    if (r.email.startsWith(PREFIX)) {
      if (apply && r.phone && !r.phone.startsWith(PREFIX)) {
        await prisma.$executeRaw`UPDATE "User" SET "phone" = ${enc(r.phone)} WHERE "id" = ${r.id}`;
        done++;
      } else if (!r.phone || r.phone.startsWith(PREFIX)) {
        failed.push({ id: r.id, reason: "email krypteret men emailHash mangler" });
      }
      continue;
    }
    if (!apply) continue;
    try {
      await prisma.$executeRaw`
        UPDATE "User" SET "email" = ${enc(r.email)}, "displayName" = ${enc(r.displayName)}, "phone" = ${r.phone ? enc(r.phone) : null}, "emailHash" = ${hash(r.email)}
        WHERE "id" = ${r.id}`;
      done++;
    } catch (e) {
      failed.push({ id: r.id, reason: String(e.code || e.message).slice(0, 80) });
    }
  }
  console.log(`Krypteret: ${done}. Fejlede: ${failed.length}.`);
  for (const f of failed) console.log(`  id=${f.id}: ${f.reason}`);
  const left = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM "User" WHERE "emailHash" IS NULL OR "email" NOT LIKE 'enc:v1:%' OR "displayName" NOT LIKE 'enc:v1:%'
       OR ("phone" IS NOT NULL AND "phone" NOT LIKE 'enc:v1:%')`;
  console.log(`Tilbage ukrypteret: ${left[0].n}.`);
  await prisma.$disconnect();
  if (failed.length) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
