import type { Locale } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { debugLog, errorText } from "@/lib/debug-log";
import {
  FOREIGN_SCRIPT_PATTERN,
  TARGET_LANGUAGE_NAMES,
  hasForeignScript,
  isHelloFreshLanguage,
  translationTarget,
} from "@/lib/product-language";

// Varetekst på et sprog uden for HelloFresh-landene oversættes til brugerens
// app-sprog (brugerens regel 2026-10-14, src/lib/product-language.ts).
// Originalen gemmes i nameOriginal/ingredientsOriginal, og
// translationStatus = PENDING, så admin kan se den side om side.

type TextFields = Record<string, string | null>;

// Felter, der oversættes; brand og subbrand er navne og skrives kun om til
// latinske bogstaver (fx 饭扫光 → Fansaoguang).
const TRANSLATED_KEYS = ["name", "namePlural", "productType", "variant", "packageSizeText", "ingredientsText"] as const;
const ROMANIZED_KEYS = ["subbrand", "brand"] as const;

async function translateTexts(fields: TextFields, target: Locale): Promise<TextFields | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const language = TARGET_LANGUAGE_NAMES[target];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Du oversætter fødevaretekst fra en emballage til ${language}. Oversæt kun den givne tekst — tilføj eller gæt aldrig noget. ` +
            "Bevar procenttal, E-numre, allergen-fremhævninger og kommaseparering. " +
            "packageSizeText er kun mængden med enhed, fx '248 g' (ikke 'Nettoindhold: 248 g'). " +
            "brand og subbrand er navne: oversæt dem ikke, men skriv dem med latinske bogstaver (pinyin/translitteration), uden accenter. " +
            "Svaret må ALDRIG indeholde kinesiske, japanske, koreanske, kyrilliske, arabiske eller andre ikke-latinske tegn. " +
            "Svar som JSON med præcis de samme nøgler som input; null forbliver null.",
        },
        { role: "user", content: JSON.stringify(fields) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI svarede ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "null") as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return null;
  const out: TextFields = {};
  for (const key of Object.keys(fields)) {
    const value = parsed[key];
    const text = typeof value === "string" ? value.trim() : "";
    // Et felt, der stadig har fremmede tegn, er ikke oversat.
    if (fields[key] && (!text || hasForeignScript(text))) return null;
    out[key] = text || null;
  }
  return out;
}

const inFlight = new Map<string, Promise<boolean>>();
// En mislykket oversættelse prøves tidligst igen efter 10 min, så varesidens
// polling ikke kalder OpenAI hvert sekund.
const RETRY_AFTER_MS = 10 * 60_000;
const failedAt = new Map<string, number>();

// Oversætter varens tekster, hvis de har ikke-latinske tegn, eller hvis
// emballagen er læst som et sprog uden for HelloFresh-landene. Returnerer
// true, når varen blev ændret. Samtidige kald for samme vare deler ét kald.
export function ensureProductLanguage(
  productId: string,
  appLanguage: string | null | undefined,
  options: { detectedLanguage?: string | null } = {},
): Promise<boolean> {
  const running = inFlight.get(productId);
  if (running) return running;
  if (Date.now() - (failedAt.get(productId) ?? 0) < RETRY_AFTER_MS) return Promise.resolve(false);
  const job = translateProduct(productId, translationTarget(appLanguage), options.detectedLanguage ?? null)
    .then((outcome) => {
      if (outcome === "failed") failedAt.set(productId, Date.now());
      else failedAt.delete(productId);
      return outcome === "changed";
    })
    .catch(async (error) => {
      failedAt.set(productId, Date.now());
      await debugLog({
        category: "ai",
        event: "product_translate",
        level: "error",
        message: `Oversættelse af varens tekst fejlede: ${errorText(error)}`,
        productId,
      });
      return false;
    })
    .finally(() => inFlight.delete(productId));
  inFlight.set(productId, job);
  return job;
}

async function translateProduct(
  productId: string,
  target: Locale,
  detectedLanguage: string | null,
): Promise<"changed" | "unchanged" | "failed"> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      namePlural: true,
      productType: true,
      variant: true,
      packageSizeText: true,
      ingredientsText: true,
      subbrand: true,
      nameOriginal: true,
      ingredientsOriginal: true,
      translationStatus: true,
      brand: { select: { id: true, name: true } },
    },
  });
  if (!product) return "unchanged";

  const current: TextFields = {
    name: product.name,
    namePlural: product.namePlural,
    productType: product.productType,
    variant: product.variant,
    packageSizeText: product.packageSizeText,
    ingredientsText: product.ingredientsText,
    subbrand: product.subbrand,
    brand: product.brand?.name ?? null,
  };
  // Et fremmed sprog med latinske bogstaver (fx polsk) kendes kun på AI'ens
  // sprogfelt — og kun, så længe varen ikke allerede er oversat.
  const foreignLanguage = isHelloFreshLanguage(detectedLanguage) === false && !product.translationStatus;
  const wanted: TextFields = {};
  for (const key of [...TRANSLATED_KEYS, ...ROMANIZED_KEYS]) {
    const value = current[key];
    if (!value?.trim()) continue;
    const isTranslatedKey = (TRANSLATED_KEYS as readonly string[]).includes(key);
    if (hasForeignScript(value) || (foreignLanguage && isTranslatedKey)) wanted[key] = value;
  }
  if (!Object.keys(wanted).length) return "unchanged";

  const translated = await translateTexts(wanted, target);
  if (!translated) return "failed";

  const data: Record<string, unknown> = {};
  for (const key of TRANSLATED_KEYS) {
    if (key in translated) data[key] = translated[key];
  }
  if ("subbrand" in translated) data.subbrand = translated.subbrand;
  if ("name" in translated && !product.nameOriginal) data.nameOriginal = product.name;
  if ("ingredientsText" in translated && !product.ingredientsOriginal) data.ingredientsOriginal = product.ingredientsText;
  data.translationSourceLang = detectedLanguage?.trim() || "ukendt";
  data.translationStatus = "PENDING";

  // Brandet er fælles: findes navnet med latinske bogstaver allerede, kobles
  // varen dertil; ellers omdøbes brandet selv.
  const romanBrand = translated.brand;
  if (product.brand && romanBrand && romanBrand !== product.brand.name) {
    const existing = await prisma.brand.findUnique({ where: { name: romanBrand }, select: { id: true } });
    if (existing) data.brandId = existing.id;
    else await prisma.brand.update({ where: { id: product.brand.id }, data: { name: romanBrand } });
  }

  await prisma.product.update({ where: { id: productId }, data });
  // Registreringernes titel følger navnet (kun teksten, ikke næringen).
  if (typeof data.name === "string" && data.name !== product.name) {
    await prisma.registration.updateMany({
      where: { productId, titleSnapshot: product.name },
      data: { titleSnapshot: data.name },
    });
  }
  await debugLog({
    category: "ai",
    event: "product_translate",
    message: `Varens tekst oversat til ${TARGET_LANGUAGE_NAMES[target]}: ${product.name} → ${translated.name ?? product.name}`,
    productId,
    data: { from: wanted, to: translated, detectedLanguage },
  });
  return "changed";
}

// Oprydning (vedligeholdelses-jobbet): varer, der stadig har ikke-latinske
// tegn, fx oprettet før reglen. Oversættes til opretterens app-sprog.
export async function translateForeignScriptProducts(limit = 20): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ id: string; appLocale: string | null }>>`
    SELECT p."id", u."appLocale"
    FROM "products" p
    LEFT JOIN "brands" b ON b."id" = p."brandId"
    LEFT JOIN "users" u ON u."id" = p."createdByUserId"
    WHERE p."deletedAt" IS NULL
      AND concat_ws(' ', p."name", p."namePlural", p."productType", p."variant", p."packageSizeText",
                      p."ingredientsText", p."subbrand", b."name") ~ ${FOREIGN_SCRIPT_PATTERN}
    ORDER BY p."createdAt" DESC
    LIMIT ${limit}`;
  let changed = 0;
  for (const row of rows) {
    if (await ensureProductLanguage(row.id, row.appLocale)) changed += 1;
  }
  return changed;
}
