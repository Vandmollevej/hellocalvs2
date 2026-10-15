import { createHash } from "node:crypto";
import { intlLocale, type Locale } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { debugLog, errorText } from "@/lib/debug-log";
import {
  TARGET_LANGUAGE_NAMES,
  hasForeignScript,
  appLocaleOf,
  inferProductLanguage,
  isTranslatableSource,
  languageCode,
  needsTranslation,
  scriptLanguage,
} from "@/lib/product-language";
import type { ProductTexts } from "@/lib/product-text-swap";

// Oversættelser af varetekst (docs/DECISIONS.md 2026-10-15). Varens kolonner
// står på originalsproget (Product.language) og røres aldrig her; en
// oversættelse til et app-sprog laves første gang en bruger med sproget ser
// varen og gemmes i ProductTranslation. Ændres varens tekst, laves den forfra.

// Felterne, der oversættes. Brand og subbrand er navne: de oversættes ikke,
// men står de med ikke-latinske tegn, skrives de med latinske bogstaver.
const TRANSLATED_KEYS = ["name", "namePlural", "productType", "variant", "packageSizeText", "ingredientsText"] as const;

export type TranslatableProduct = {
  id: string;
  language: string | null;
  name: string;
  namePlural: string | null;
  productType: string | null;
  variant: string | null;
  packageSizeText: string | null;
  ingredientsText: string | null;
  subbrand: string | null;
  brand: { name: string } | null;
  externalSource: string | null;
  createdByUserId: string | null;
};

// Teksten, der skal oversættes: alle udfyldte felter, og navnene kun med
// ikke-latinske tegn. "brand" = brandets navn.
function sourceTexts(product: TranslatableProduct): ProductTexts {
  const texts: ProductTexts = {};
  for (const key of TRANSLATED_KEYS) {
    const value = product[key];
    if (value?.trim()) texts[key] = value;
  }
  if (hasForeignScript(product.subbrand)) texts.subbrand = product.subbrand;
  if (hasForeignScript(product.brand?.name)) texts.brand = product.brand!.name;
  return texts;
}

function hashTexts(texts: ProductTexts): string {
  return createHash("sha1").update(JSON.stringify(texts)).digest("hex");
}

async function callTranslator(texts: ProductTexts, target: Locale, sourceLanguage: string): Promise<ProductTexts | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
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
            `Du oversætter fødevaretekst fra en emballage fra sproget "${sourceLanguage}" til ${TARGET_LANGUAGE_NAMES[target]}. ` +
            "Oversæt kun den givne tekst — tilføj eller gæt aldrig noget. Bevar procenttal, E-numre, allergen-fremhævninger og kommaseparering. " +
            "Navne på oste, retter og andre egennavne, der også bruges på målsproget (fx Brie de Meaux, Mozzarella), beholdes. " +
            "packageSizeText er kun mængden med enhed, fx '248 g' (ikke 'Nettoindhold: 248 g'). " +
            "brand og subbrand er navne: oversæt dem ikke, men skriv dem med latinske bogstaver (pinyin/translitteration), uden accenter. " +
            "Svaret må aldrig indeholde kinesiske, japanske, koreanske, kyrilliske, arabiske eller andre ikke-latinske tegn. " +
            "Svar som JSON med præcis de samme nøgler som input.",
        },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI svarede ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "null") as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return null;
  const out: ProductTexts = {};
  for (const key of Object.keys(texts)) {
    const value = typeof parsed[key] === "string" ? (parsed[key] as string).trim() : "";
    // Et felt, der mangler eller stadig har fremmede tegn, er ikke oversat.
    if (!value || hasForeignScript(value)) return null;
    out[key] = value;
  }
  return out;
}

// Samtidige kald for samme vare og sprog deler ét kald; et mislykket kald
// prøves tidligst igen efter 10 min, så varesidens polling ikke kalder
// OpenAI hvert sekund.
const RETRY_AFTER_MS = 10 * 60_000;
const inFlight = new Map<string, Promise<ProductTexts | null>>();
const failedAt = new Map<string, number>();

// Varens tekst på brugerens sprog — null, når varen ikke skal oversættes,
// eller oversættelsen ikke kan laves lige nu (så vises originalen).
export async function translationFor(product: TranslatableProduct, viewer: Locale): Promise<ProductTexts | null> {
  if (!isTranslatableSource(product) || !needsTranslation(product.language, viewer)) return null;
  const texts = sourceTexts(product);
  if (!Object.keys(texts).length) return null;
  const sourceHash = hashTexts(texts);
  const stored = await prisma.productTranslation.findUnique({
    where: { productId_locale: { productId: product.id, locale: viewer } },
  });
  if (stored && stored.sourceHash === sourceHash) return storedTexts(stored, texts);

  const key = `${product.id}:${viewer}:${sourceHash}`;
  const running = inFlight.get(key);
  if (running) return running;
  if (Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return null;
  const job = (async () => {
    try {
      const translated = await callTranslator(texts, viewer, languageCode(product.language) ?? "ukendt");
      if (!translated) {
        failedAt.set(key, Date.now());
        return null;
      }
      const row = {
        sourceHash,
        name: translated.name ?? null,
        namePlural: translated.namePlural ?? null,
        productType: translated.productType ?? null,
        variant: translated.variant ?? null,
        packageSizeText: translated.packageSizeText ?? null,
        ingredientsText: translated.ingredientsText ?? null,
        subbrand: translated.subbrand ?? null,
        brandName: translated.brand ?? null,
      };
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: viewer } },
        create: { productId: product.id, locale: viewer, ...row },
        update: row,
      });
      await debugLog({
        category: "ai",
        event: "product_translate",
        message: `Varen oversat fra ${product.language} til ${TARGET_LANGUAGE_NAMES[viewer]}: ${product.name} → ${translated.name ?? product.name}`,
        productId: product.id,
        data: { from: texts, to: translated },
      });
      failedAt.delete(key);
      return translated;
    } catch (error) {
      failedAt.set(key, Date.now());
      await debugLog({
        category: "ai",
        event: "product_translate",
        level: "error",
        message: `Oversættelse af varen fejlede: ${errorText(error)}`,
        productId: product.id,
      });
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

function storedTexts(
  row: { name: string | null; namePlural: string | null; productType: string | null; variant: string | null; packageSizeText: string | null; ingredientsText: string | null; subbrand: string | null; brandName: string | null },
  keys: ProductTexts,
): ProductTexts {
  const all: ProductTexts = {
    name: row.name,
    namePlural: row.namePlural,
    productType: row.productType,
    variant: row.variant,
    packageSizeText: row.packageSizeText,
    ingredientsText: row.ingredientsText,
    subbrand: row.subbrand,
    brand: row.brandName,
  };
  const out: ProductTexts = {};
  for (const key of Object.keys(keys)) out[key] = all[key] ?? null;
  return out;
}

// --- Navne i lister (dagbog, favoritter, mest brugte) ---------------------

const TRANSLATABLE_SELECT = {
  id: true,
  language: true,
  name: true,
  namePlural: true,
  productType: true,
  variant: true,
  packageSizeText: true,
  ingredientsText: true,
  subbrand: true,
  externalSource: true,
  createdByUserId: true,
  brand: { select: { name: true } },
} as const;

// Laver oversættelsen i baggrunden (lister venter aldrig på OpenAI).
function translateInBackground(productIds: string[], viewer: Locale) {
  void (async () => {
    for (const productId of productIds) {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: TRANSLATABLE_SELECT });
      if (product) await translationFor(product, viewer).catch(() => null);
    }
  })().catch((error) => console.error("Background product translation failed", error));
}

export type ListedProduct = {
  id: string;
  name: string;
  language: string | null;
  externalSource: string | null;
  createdByUserId: string | null;
};

export type ProductListViewer = { appLocale: string | null; translateForeignText: boolean } | null;

// Varenavne på brugerens sprog til lister: kun gemte oversættelser (ingen
// ventetid); mangler en, laves den i baggrunden til næste visning. Returnerer
// produkt-id → { name, brandName } for de varer, der vises oversat.
// Brug den overalt, hvor en liste viser varenavne (docs/REGLER.md → Varens sprog).
export async function localizedProductNames(
  products: ListedProduct[],
  viewer: ProductListViewer,
): Promise<Map<string, { name: string; brandName: string | null }>> {
  const result = new Map<string, { name: string; brandName: string | null }>();
  if (!viewer || viewer.translateForeignText === false) return result;
  const locale = appLocaleOf(viewer.appLocale);
  const wanted = products.filter((p) => isTranslatableSource(p) && needsTranslation(p.language, locale));
  if (!wanted.length) return result;
  const ids = [...new Set(wanted.map((p) => p.id))];
  const rows = await prisma.productTranslation.findMany({
    where: { productId: { in: ids }, locale },
    select: { productId: true, name: true, brandName: true },
  });
  for (const row of rows) {
    if (row.name) result.set(row.productId, { name: row.name, brandName: row.brandName });
  }
  const missing = ids.filter((id) => !result.has(id));
  if (missing.length) translateInBackground(missing.slice(0, 10), locale);
  return result;
}

// --- Natligt job: oversæt på forhånd ---------------------------------------

const NIGHTLY_LIMIT = 200;

// Oversætter varer, der kan oversættes, til de app-sprog, som brugere har
// valgt (docs/DECISIONS.md 2026-10-15), så ingen venter ved første visning.
// Kun varer uden gyldig oversættelse; højst 200 kald pr. kørsel.
export async function translateProductsAhead(): Promise<{ message: string; count: number }> {
  const localeRows = await prisma.user.groupBy({
    by: ["appLocale"],
    where: { translateForeignText: true, forgottenAt: null, closedAt: null },
  });
  const locales = [...new Set(localeRows.map((row) => appLocaleOf(row.appLocale)))];
  let translated = 0;
  let checked = 0;
  for (const locale of locales) {
    if (checked >= NIGHTLY_LIMIT) break;
    const products = await prisma.product.findMany({
      where: {
        discontinued: false,
        privateOwnerId: null,
        language: { notIn: ["", locale] },
        NOT: { pendingFields: { has: "name" } },
        translations: { none: { locale } },
      },
      select: TRANSLATABLE_SELECT,
      orderBy: { createdAt: "desc" },
      take: NIGHTLY_LIMIT - checked,
    });
    for (const product of products) {
      if (!isTranslatableSource(product)) continue;
      checked += 1;
      if (await translationFor(product, locale).catch(() => null)) translated += 1;
    }
  }
  return {
    message: `${translated} varer oversat på forhånd (${locales.join(", ") || "ingen sprog"})`,
    count: translated,
  };
}

// Sprognavnet på brugerens sprog ("kinesisk", "Chinese" …).
export function languageName(code: string | null | undefined, viewer: Locale): string | null {
  const language = languageCode(code);
  if (!language || language === "und") return null;
  try {
    const name = new Intl.DisplayNames([intlLocale(viewer)], { type: "language" }).of(language);
    return name && name.toLowerCase() !== language ? name : null;
  } catch {
    return null;
  }
}

// --- Varens sprog ---------------------------------------------------------

const LANGUAGE_SELECT = {
  id: true,
  language: true,
  name: true,
  variant: true,
  subbrand: true,
  packageSizeText: true,
  ingredientsText: true,
  externalSource: true,
  market: true,
  nameOriginal: true,
  scannedCountry: true,
  originCountryCode: true,
  pendingFields: true,
  brand: { select: { name: true } },
  barcodes: { select: { code: true } },
} as const;

type LanguageRow = {
  id: string;
  language: string | null;
  name: string;
  variant: string | null;
  subbrand: string | null;
  packageSizeText: string | null;
  ingredientsText: string | null;
  externalSource: string | null;
  market: string | null;
  nameOriginal: string | null;
  scannedCountry: string | null;
  originCountryCode: string | null;
  pendingFields: string[];
  brand: { name: string } | null;
  barcodes: { code: string }[];
};

// Det sprog, varen bør have — null, når den ikke skal ændres. Et kendt sprog
// ændres kun af ikke-latinske tegn (fx når AI'en har læst en kinesisk forside).
async function languageUpdate(row: LanguageRow, country?: string | null): Promise<string | null> {
  const texts = [row.name, row.variant, row.subbrand, row.packageSizeText, row.ingredientsText, row.brand?.name];
  if (row.language) {
    const script = scriptLanguage(texts);
    return script && script !== row.language ? script : null;
  }
  // Mens AI'en læser forsiden, er navnet en pladsholder.
  if (row.pendingFields.includes("name")) return null;
  let offLang: string | null = null;
  if (row.externalSource === "OPEN_FOOD_FACTS" && row.barcodes.length) {
    const off = await prisma.offProductRecord.findFirst({
      where: { barcode: { in: row.barcodes.map((b) => b.code) } },
      select: { lang: true },
    });
    offLang = off?.lang ?? null;
  }
  return inferProductLanguage({
    texts,
    externalSource: row.externalSource,
    market: row.market,
    offLang,
    translatedToDanish: !!row.nameOriginal,
    scannedCountry: row.scannedCountry ?? country ?? null,
    originCountryCode: row.originCountryCode,
    barcodes: row.barcodes.map((b) => b.code),
  });
}

// Sætter varens sprog, hvis det mangler (eller ikke-latinske tegn viser et
// andet). country = landet, varen blev scannet i, når det ikke står på varen.
// Returnerer sproget.
export async function refreshProductLanguage(productId: string, country?: string | null): Promise<string | null> {
  const row = await prisma.product.findUnique({ where: { id: productId }, select: LANGUAGE_SELECT });
  if (!row) return null;
  const next = await languageUpdate(row, country);
  if (!next) return row.language;
  await prisma.product.update({ where: { id: productId }, data: { language: next } });
  return next;
}

// Vedligeholdet: varer uden sprog får det fra kilden (ingen AI-kald). Uden
// noget signal sættes "" (tjekket, ukendt), så varen ikke tages igen hver
// kørsel; en senere scanning kan stadig sætte sproget.
export async function backfillProductLanguages(limit = 500): Promise<number> {
  const rows = await prisma.product.findMany({
    where: { language: null, NOT: { pendingFields: { has: "name" } } },
    select: LANGUAGE_SELECT,
    take: limit,
  });
  let updated = 0;
  for (const row of rows) {
    const next = await languageUpdate(row);
    await prisma.product.update({ where: { id: row.id }, data: { language: next ?? "" } });
    if (next) updated += 1;
  }
  return updated;
}
