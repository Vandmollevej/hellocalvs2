import { sanitizeAiPhoto } from "@/lib/image-metadata";
import { debugLog, errorText } from "@/lib/debug-log";
type JsonSchema = Record<string, unknown>;

type StructuredVisionArgs = {
  photo: string;
  system: string;
  text: string;
  schemaName: string;
  schema: JsonSchema;
  // Flere billeder i samme kald (fx før/efter i 2-års kvalitetstjekket,
  // src/lib/product-recheck.ts) og billedernes detaljegrad.
  extraPhotos?: string[];
  detail?: "low" | "high";
};

export function getProductVisionModel() {
  return process.env.OPENAI_PRODUCT_VISION_MODEL?.trim() || "gpt-5.6-terra";
}

// Reservemodellen, hvis den valgte model afvises (findes ikke/ingen adgang).
// Bruges allerede af måltidsfotoet (src/lib/meal-photo-recognition.ts).
export const FALLBACK_VISION_MODEL = "gpt-4o";

// Robusthed (brugerens krav 2026-10-16, "til bunds een gang for alle"): ét
// fejlet OpenAI-kald efterlod nye varer uden navn, brand, energi og
// fritlægning. Nu har hvert forsøg en tidsgrænse, midlertidige fejl (429,
// 5xx, netværk, tidsgrænse, tomt svar) prøves igen med pause, og afvises
// modellen, prøves reservemodellen.
const ATTEMPT_TIMEOUT_MS = 90_000;
const RETRY_DELAYS_MS = [2_000, 6_000];
const MAX_RETRY_AFTER_MS = 20_000;

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
  id?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

function readOutputText(data: OpenAiResponsesPayload): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const item of data.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }
  return null;
}

class OpenAiCallError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

// 429 og 5xx er midlertidige; status null = netværk/tidsgrænse/tomt svar.
export function isTransientOpenAiStatus(status: number | null) {
  return status === null || status === 408 || status === 409 || status === 429 || status >= 500;
}

// Modellen findes ikke eller kontoen har ikke adgang til den.
export function isModelRejection(status: number | null, body: string) {
  if (status !== 400 && status !== 403 && status !== 404) return false;
  return /model/i.test(body);
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postResponses(apiKey: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new OpenAiCallError(`OpenAI-kaldet nåede ikke frem: ${errorText(error)}`, null);
  }
  if (!response.ok) {
    throw new OpenAiCallError(
      `OpenAI-kald fejlede (${response.status}): ${(await response.text()).slice(0, 1000)}`,
      response.status,
      retryAfterMs(response),
    );
  }
  const data = (await response.json().catch(() => null)) as OpenAiResponsesPayload | null;
  const output = data ? readOutputText(data) : null;
  if (!data || !output) throw new OpenAiCallError("Intet struktureret svar fra OpenAI", null);
  return { data, output };
}

// Ét struktureret kald med genforsøg og reservemodel. `build` laver
// request-bodyen for en given model.
async function requestStructured<T>(
  schemaName: string,
  build: (model: string) => Record<string, unknown>,
): Promise<{ value: T; model: string; responseId: string | null; usage: OpenAiResponsesPayload["usage"] | null; attempts: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    void debugLog({ category: "ai", event: schemaName, level: "error", message: "OPENAI_API_KEY er ikke sat — intet AI-kald" });
    throw new Error("OPENAI_API_KEY er ikke sat");
  }
  let model = getProductVisionModel();
  let attempts = 0;
  let retries = 0;
  for (;;) {
    attempts += 1;
    try {
      const { data, output } = await postResponses(apiKey, build(model));
      return {
        value: JSON.parse(output) as T,
        model,
        responseId: typeof data.id === "string" ? data.id : null,
        usage: data.usage ?? null,
        attempts,
      };
    } catch (error) {
      const status = error instanceof OpenAiCallError ? error.status : null;
      const message = errorText(error);
      if (model !== FALLBACK_VISION_MODEL && isModelRejection(status, message)) {
        void debugLog({
          category: "ai",
          event: schemaName,
          level: "error",
          message: `Modellen ${model} blev afvist — prøver ${FALLBACK_VISION_MODEL}: ${message.slice(0, 300)}`,
        });
        model = FALLBACK_VISION_MODEL;
        continue;
      }
      // Et ugyldigt JSON-svar regnes også som midlertidigt.
      const transient = error instanceof SyntaxError || (error instanceof OpenAiCallError && isTransientOpenAiStatus(status));
      if (!transient || retries >= RETRY_DELAYS_MS.length) throw error;
      const delay = (error instanceof OpenAiCallError ? error.retryAfterMs : null) ?? RETRY_DELAYS_MS[retries];
      retries += 1;
      void debugLog({
        category: "ai",
        event: schemaName,
        level: "warn",
        message: `OpenAI ${schemaName} (${model}) fejlede midlertidigt — nyt forsøg om ${Math.round(delay / 1000)} s: ${message.slice(0, 300)}`,
      });
      await wait(delay);
    }
  }
}

export async function callStructuredVision<T>({
  photo,
  system,
  text,
  schemaName,
  schema,
  extraPhotos = [],
  detail = "high",
}: StructuredVisionArgs): Promise<{ value: T; model: string; responseId: string | null }> {
  for (const item of [photo, ...extraPhotos]) {
    if (!item.startsWith("data:image/") && !item.startsWith("https://")) {
      throw new Error("photo skal være data:image/... eller https URL");
    }
  }

  // docs/PRIVACY.md "AI": ingen metadata og ingen ID'er til OpenAI, og
  // svaret må ikke gemmes hos OpenAI (store: false).
  const cleanPhotos = [photo, ...extraPhotos].map(sanitizeAiPhoto);
  const startedAt = Date.now();
  try {
    const result = await requestStructured<T>(schemaName, (model) => ({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text },
            ...cleanPhotos.map((image_url) => ({ type: "input_image", image_url, detail })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
          strict: true,
        },
      },
    }));
    // Admin "Log" (docs/DECISIONS.md 2026-09-28): hvert OpenAI-kald med tid
    // og tokens; scanningens flow/vare kommer fra debug-konteksten.
    void debugLog({
      category: "ai",
      event: schemaName,
      message: `OpenAI ${schemaName} (${result.model}) OK${result.attempts > 1 ? ` efter ${result.attempts} forsøg` : ""}`,
      durationMs: Date.now() - startedAt,
      data: { model: result.model, schemaName, responseId: result.responseId, usage: result.usage, attempts: result.attempts },
    });
    return { value: result.value, model: result.model, responseId: result.responseId };
  } catch (error) {
    void debugLog({
      category: "ai",
      event: schemaName,
      level: "error",
      message: `OpenAI ${schemaName} (${getProductVisionModel()}) fejlede: ${errorText(error).slice(0, 500)}`,
      durationMs: Date.now() - startedAt,
      data: { model: getProductVisionModel(), schemaName },
    });
    throw error;
  }
}

// Struktureret tekstkald uden billede (fx stavekontrollens tvivlsomme ord,
// docs/DECISIONS.md 2026-10-15). Samme privatlivsregler: store: false.
export async function callStructuredText<T>({
  system,
  text,
  schemaName,
  schema,
}: {
  system: string;
  text: string;
  schemaName: string;
  schema: JsonSchema;
}): Promise<{ value: T; model: string }> {
  const startedAt = Date.now();
  try {
    const result = await requestStructured<T>(schemaName, (model) => ({
      model,
      store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text }] },
      ],
      text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
    }));
    void debugLog({
      category: "ai",
      event: schemaName,
      message: `OpenAI-tekstkald (${result.model}) på ${Date.now() - startedAt} ms`,
      durationMs: Date.now() - startedAt,
      data: { model: result.model, usage: result.usage, attempts: result.attempts },
    });
    return { value: result.value, model: result.model };
  } catch (error) {
    void debugLog({
      category: "ai",
      event: schemaName,
      level: "error",
      message: `OpenAI-tekstkald ${schemaName} fejlede: ${errorText(error).slice(0, 500)}`,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
