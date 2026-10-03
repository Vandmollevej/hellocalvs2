import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { getEconomy, type ChurnInput } from "@/lib/admin-economy";
import { getProductVisionModel } from "@/lib/product-ai";

// "AI-udregning" på /admin/economy (docs/DECISIONS.md 2026-10-02): kun
// aggregerede tal sendes til OpenAI (ingen navne, e-mails eller id'er,
// store: false). AI'en vurderer afmeldingsprocenten pr. abonnementstype;
// selve forventningen regnes bagefter i koden.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["monthlyChurnPct", "quarterlyChurnPct", "annualChurnPct", "explanation"],
  properties: {
    monthlyChurnPct: { type: "number" },
    quarterlyChurnPct: { type: "number" },
    annualChurnPct: { type: "number" },
    explanation: { type: "string" },
  },
};

export async function POST() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "OPENAI_API_KEY er ikke sat" }, { status: 503 });

  const now = new Date();
  const data = await getEconomy(now);
  const payload = {
    betalende_nu: data.payingNow,
    abonnementer: data.kinds.map((k) => ({
      type: k.label,
      antal: k.count,
      opsagt: k.canceled,
      samlet_pris_pr_periode_kr: k.periodTotalDkk,
    })),
    afmeldinger: data.churn,
    arsabonnementer_sikret_maaneder: data.annualCover.monthsToLatest,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_STATS_MODEL?.trim() || getProductVisionModel(),
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Du er økonom for kalorie-appen Hello Cal. Ud fra de aggregerede abonnementstal skal du vurdere, hvor mange procent (0-90) af de ikke-opsagte abonnenter der afmelder før deres næste fornyelse, pr. type (månedlig, 3 måneder, årlig). Brug de observerede afmeldinger, men vær forsigtig ved små datagrundlag. Forklar kort på dansk (maks. 3 sætninger). Opfind ikke data.",
            },
          ],
        },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(payload) }] },
      ],
      text: { format: { type: "json_schema", name: "economy_churn", schema: SCHEMA, strict: true } },
    }),
  });
  if (!response.ok) {
    console.error("Economy AI failed", response.status, await response.text());
    return NextResponse.json({ message: `OpenAI-kald fejlede (${response.status})` }, { status: 502 });
  }
  const body = (await response.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  const text =
    body.output_text?.trim() ||
    body.output?.flatMap((i) => i.content ?? []).find((c) => c.type === "output_text" && c.text?.trim())?.text?.trim();
  if (!text) return NextResponse.json({ message: "Intet svar fra OpenAI" }, { status: 502 });

  let parsed: { monthlyChurnPct: number; quarterlyChurnPct: number; annualChurnPct: number; explanation: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: "Ugyldigt svar fra OpenAI" }, { status: 502 });
  }
  const clamp = (pct: number) => Math.min(0.9, Math.max(0, (Number(pct) || 0) / 100));
  const churn: ChurnInput = {
    monthly: clamp(parsed.monthlyChurnPct),
    quarterly: clamp(parsed.quarterlyChurnPct),
    annual: clamp(parsed.annualChurnPct),
  };
  const adjusted = await getEconomy(now, churn);
  return NextResponse.json({ forecast: adjusted.forecast, explanation: parsed.explanation });
}
