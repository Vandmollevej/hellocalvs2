import { debugLog } from "@/lib/debug-log";
import { getProductVisionModel } from "@/lib/product-ai";
import { aggregatesForAi, type PersonaAggregates } from "@/lib/persona-groups";

// AI-delen af Personas (docs/DECISIONS.md 2026-10-02): OpenAI får KUN de
// anonyme gruppetal fra persona-groups.ts (ingen navne, e-mails, id'er;
// store: false, som /admin/statistics' "Analysér med AI") og svarer med
// strukturerede personas. Model: OPENAI_PERSONA_MODEL, ellers
// OPENAI_STATS_MODEL, ellers produktmodellen.

export type AiPersona = {
  name: string;
  share_pct: number;
  summary: string;
  demographics: string;
  behaviour: string;
  patterns: string[];
  needs: string[];
  actions: string[];
};

export type PersonaAiResult = {
  personas: AiPersona[];
  key_findings: string[];
  data_caveats: string[];
};

export function getPersonaModel() {
  return (
    process.env.OPENAI_PERSONA_MODEL?.trim() ||
    process.env.OPENAI_STATS_MODEL?.trim() ||
    getProductVisionModel()
  );
}

const PERSONA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    personas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          share_pct: { type: "number" },
          summary: { type: "string" },
          demographics: { type: "string" },
          behaviour: { type: "string" },
          patterns: { type: "array", items: { type: "string" } },
          needs: { type: "array", items: { type: "string" } },
          actions: { type: "array", items: { type: "string" } },
        },
        required: ["name", "share_pct", "summary", "demographics", "behaviour", "patterns", "needs", "actions"],
      },
    },
    key_findings: { type: "array", items: { type: "string" } },
    data_caveats: { type: "array", items: { type: "string" } },
  },
  required: ["personas", "key_findings", "data_caveats"],
} as const;

const SYSTEM_PROMPT = `Du er dataanalytiker for kalorie-appen Hello Cal. Du får anonyme, aggregerede tal om appens brugere opdelt på land, by, sprog, aldersgruppe, køn, abonnement og enhed samt adfærdssegmenter (hvor ofte de logger ind, hvornår på døgnet og ugen, hvor meget de logger mad, om de bruger smartur/sundhedsapp, vejer sig, logger motion osv.).
Opgave: Udled 3-6 personas (typiske brugergrupper), der tilsammen dækker brugerne. Hver persona skal have et kort dansk navn (fx "Morgenlogger i storbyen"), en andel i procent (summen må gerne være cirka 100), en kort beskrivelse, demografi (land/by/sprog/alder/køn, hvor tallene bærer det), adfærd (logins, tidspunkt på døgnet/ugen, registreringer, integrationer), 2-5 konkrete mønstre med tal, 1-3 behov og 1-3 konkrete handlinger for Hello Cal.
Regler: Skriv på dansk. Brug kun tallene, du får — opfind ikke data. Grupper under den mindste gruppestørrelse er slået sammen i "Øvrige"; drag ikke konklusioner om dem. Er datagrundlaget lille eller skævt (fx få brugere, logins kun registreret siden 2026-09-27, mange med ukendt alder/by), så skriv det under data_caveats og hold personas'erne forsigtige. Nævn aldrig enkeltpersoner.`;

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

function readOutputText(data: OpenAiResponsesPayload): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const item of data.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }
  return null;
}

export async function analysePersonasWithAi(
  aggregates: PersonaAggregates,
): Promise<{ result: PersonaAiResult; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");
  const model = getPersonaModel();
  const started = Date.now();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(aggregatesForAi(aggregates)) }] },
      ],
      text: { format: { type: "json_schema", name: "hello_cal_personas", schema: PERSONA_SCHEMA, strict: true } },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    void debugLog({
      category: "ai",
      event: "personas",
      level: "error",
      message: `OpenAI-kald fejlede (${response.status})`,
      durationMs: Date.now() - started,
      data: { model, body: body.slice(0, 2000) },
    });
    throw new Error(`OpenAI-kald fejlede (${response.status})`);
  }

  const data = (await response.json()) as OpenAiResponsesPayload;
  const text = readOutputText(data);
  if (!text) throw new Error("Intet struktureret svar fra OpenAI");
  const result = JSON.parse(text) as PersonaAiResult;
  if (!Array.isArray(result.personas)) throw new Error("Uventet svar fra OpenAI");

  void debugLog({
    category: "ai",
    event: "personas",
    message: `${result.personas.length} personas`,
    durationMs: Date.now() - started,
    data: { model, usage: data.usage ?? null, users: aggregates.userCount },
  });
  return { result, model };
}
