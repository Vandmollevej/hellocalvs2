import { Prisma } from "@prisma/client";
import { intlLocale, type Locale } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { debugLog, errorText } from "@/lib/debug-log";
import {
  FOREIGN_SCRIPT_PATTERN,
  TARGET_LANGUAGE_NAMES,
  hasForeignScript,
  isHelloFreshLanguage,
  languageCode,
  translationTarget,
} from "@/lib/product-language";
import type { ProductTexts } from "@/lib/product-text-swap";

// Varetekst på et sprog uden for HelloFresh-landene oversættes til brugerens
// app-sprog (brugerens regel 2026-10-14, src/lib/product-language.ts).
// Kolonnerne får oversættelsen; originalen for hvert felt gemmes i
// textOriginals (navn/ingredienser også i nameOriginal/ingredientsOriginal),
// og translationStatus = PENDING, så admin kan se den side om side. Brugere
// med et andet app-sprog får en oversættelse fra originalen, gemt i
// textTranslations.

// Felter, der oversættes; brand og subbrand er navne og skrives kun om til
// latinske bogstaver (fx 饭扫光 → Fansaoguang).
const TRANSLATED_KEYS = ["name", "namePlural", "productType", "variant", "packageSizeText", "ingredientsText"] as const;
const ROMANIZED_KEYS = ["subbrand", "brand"] as const;
const LOCALE_CODES: readonly string[] = ["da", "en", "de", "fr", "nl", "sv", "no"];

async function translateTexts(
  fields: ProductTexts,
  target: Locale,
): Promise<{ texts: ProductTexts; sourceLanguage: string | null } | null> {
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
            'Svar som JSON: {"texts": {præcis de samme nøgler som input; null forbliver null}, "sourceLanguage": ISO 639-1-koden for originalens sprog, fx "zh"}.',
        },
        { role: "user", content: JSON.stringify({ texts: fields }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI svarede ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "null") as
    | { texts?: Record<string, unknown>; sourceLanguage?: unknown }
    | null;
  if (!parsed?.texts || typeof parsed.texts !== "object") return null;
  const texts: ProductTexts = {};
  for (const key of Object.keys(fields)) {
    const value = parsed.texts[key];
    const text = typeof value === "string" ? value.trim() : "";
    // Et felt, der stadig har fremmede tegn, er ikke oversat.
    if (fields[key] && (!text || hasForeignScript(text))) return null;
    texts[key] = text || null;
  }
  return { texts, sourceLanguage: typeof parsed.sourceLanguage === "string" ? languageCode(parsed.sourceLanguage) : null };
}

// Samtidige kald med samme nøgle deler ét kald, og et mislykket kald prøves
// tidligst igen efter 10 min, så varesidens polling ikke kalder OpenAI hvert
// sekund.
const RETRY_AFTER_MS = 10 * 60_000;
const inFlight = new Map<string, Promise<unknown>>();
const failedAt = new Map<string, number>();

function once<T>(key: string, fallback: T, run: () => Promise<{ value: T; failed: boolean }>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  if (Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return Promise.resolve(fallback);
  const job = run()
    .then(({ value, failed }) => {
      if (failed) failedAt.set(key, Date.now());
      else failedAt.delete(key);
      return value;
    })
    .catch(async (error) => {
      failedAt.set(key, Date.now());
      await debugLog({
        category: "ai",
        event: "product_translate",
        level: "error",
        message: `Oversættelse af varens tekst fejlede: ${errorText(error)}`,
        productId: key.split(":")[0],
      });
      return fallback;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

function asTexts(value: unknown): ProductTexts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: ProductTexts = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text === "string" || text === null) out[key] = text;
  }
  return Object.keys(out).length ? out : null;
}

function asLocale(value: string | null | undefined): Locale | null {
  return value && LOCALE_CODES.includes(value) ? (value as Locale) : null;
}

// Oversætter varens tekster, hvis de har ikke-latinske tegn, eller hvis
// emballagen er læst som et sprog uden for HelloFresh-landene. Returnerer
// true, når varen blev ændret.
export function ensureProductLanguage(
  productId: string,
  appLanguage: string | null | undefined,
  options: { detectedLanguage?: string | null } = {},
): Promise<boolean> {
  return once(productId, false, async () => {
    const outcome = await translateProduct(productId, translationTarget(appLanguage), options.detectedLanguage ?? null);
    return { value: outcome === "changed", failed: outcome === "failed" };
  });
}

async function translateProduct(
  productId: string,
  appTarget: Locale,
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
      translationSourceLang: true,
      translationTargetLang: true,
      textOriginals: true,
      brand: { select: { id: true, name: true } },
    },
  });
  if (!product) return "unchanged";

  const current: ProductTexts = {
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
  const wanted: ProductTexts = {};
  for (const key of [...TRANSLATED_KEYS, ...ROMANIZED_KEYS]) {
    const value = current[key];
    if (!value?.trim()) continue;
    const isTranslatedKey = (TRANSLATED_KEYS as readonly string[]).includes(key);
    if (hasForeignScript(value) || (foreignLanguage && isTranslatedKey)) wanted[key] = value;
  }
  if (!Object.keys(wanted).length) return "unchanged";

  // Er varen allerede delvist oversat, bruges samme sprog til resten.
  const target = asLocale(product.translationTargetLang) ?? appTarget;
  const result = await translateTexts(wanted, target);
  if (!result) return "failed";
  const translated = result.texts;

  const data: Record<string, unknown> = {};
  for (const key of TRANSLATED_KEYS) {
    if (key in translated) data[key] = translated[key];
  }
  if ("subbrand" in translated) data.subbrand = translated.subbrand;
  if ("name" in translated && !product.nameOriginal) data.nameOriginal = product.name;
  if ("ingredientsText" in translated && !product.ingredientsOriginal) data.ingredientsOriginal = product.ingredientsText;
  data.textOriginals = { ...(asTexts(product.textOriginals) ?? {}), ...wanted } as Prisma.InputJsonValue;
  data.translationTargetLang = target;
  data.translationSourceLang =
    result.sourceLanguage ?? languageCode(detectedLanguage) ?? product.translationSourceLang ?? "ukendt";
  data.translationStatus = "PENDING";
  // Oversættelser til andre sprog bygger på originalerne og laves forfra.
  data.textTranslations = Prisma.DbNull;

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
    data: { from: wanted, to: translated, detectedLanguage, sourceLanguage: result.sourceLanguage },
  });
  return "changed";
}

type TranslatedProductRow = {
  id: string;
  nameOriginal: string | null;
  ingredientsOriginal: string | null;
  translationSourceLang: string | null;
  translationTargetLang: string | null;
  textOriginals: unknown;
  textTranslations: unknown;
};

function languageName(code: string | null, viewer: Locale): string | null {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames([intlLocale(viewer)], { type: "language" }).of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : null;
  } catch {
    return null;
  }
}

// Den oversatte vare set med brugerens app-sprog: overlay = tekster på
// brugerens sprog, når kolonnerne står på et andet (null = kolonnerne
// gælder), original = originalteksterne til "Vis original". null, når
// varen ikke er oversat.
export async function productTranslationFor(
  product: TranslatedProductRow,
  viewer: Locale,
): Promise<{
  overlay: ProductTexts | null;
  original: ProductTexts;
  // Originalen er på brugerens eget sprog: vis den, uden oversat-linjen.
  sameLanguage: boolean;
  sourceLanguageName: string | null;
  targetLanguageName: string;
} | null> {
  const original =
    asTexts(product.textOriginals) ??
    asTexts({
      ...(product.nameOriginal ? { name: product.nameOriginal } : {}),
      ...(product.ingredientsOriginal ? { ingredientsText: product.ingredientsOriginal } : {}),
    });
  if (!original) return null;
  const sourceCode = languageCode(product.translationSourceLang);
  const sourceLanguageName = languageName(sourceCode, viewer);
  if (sourceCode === viewer) {
    return { overlay: original, original, sameLanguage: true, sourceLanguageName, targetLanguageName: sourceLanguageName ?? viewer };
  }
  // Open Food Facts-oversættelser fra før textOriginals er på dansk.
  const storedTarget = asLocale(product.translationTargetLang) ?? "da";
  let overlay: ProductTexts | null = null;
  let shownTarget: Locale = storedTarget;
  if (viewer !== storedTarget) {
    const cache = (product.textTranslations ?? {}) as Record<string, unknown>;
    overlay =
      asTexts(cache[viewer]) ??
      (await once(`${product.id}:${viewer}`, null as ProductTexts | null, async () => {
        const result = await translateTexts(original, viewer);
        if (!result) return { value: null, failed: true };
        await prisma.product.update({
          where: { id: product.id },
          data: { textTranslations: { ...cache, [viewer]: result.texts } as Prisma.InputJsonValue },
        });
        return { value: result.texts, failed: false };
      }));
    if (overlay) shownTarget = viewer;
  }
  return {
    overlay,
    original,
    sameLanguage: false,
    sourceLanguageName,
    targetLanguageName: languageName(shownTarget, viewer) ?? TARGET_LANGUAGE_NAMES[shownTarget],
  };
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
