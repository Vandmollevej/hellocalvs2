import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { getAdminStatistics } from "@/lib/admin-stats";
import { parseStatsFilter, regionFilterCountries, STATS_TIERS } from "@/lib/admin-stats-range";
import { getProductVisionModel } from "@/lib/product-ai";

// "Analysér med AI" på /admin/statistics (docs/DECISIONS.md 2026-09-27):
// genberegner de aggregerede tal for filteret og beder OpenAI om en kort
// dansk opsummering af ændringer i brugsadfærd. Kun aggregater sendes —
// ingen navne, e-mails eller id'er (docs/PRIVACY.md "AI"), og store: false.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "OPENAI_API_KEY er ikke sat" }, { status: 503 });

  const filter = parseStatsFilter(Object.fromEntries(new URL(req.url).searchParams));
  const stats = await getAdminStatistics(filter);
  const payload = {
    periode: `${stats.range.fromDay} til ${stats.range.toDay}`,
    land: regionFilterCountries(filter.region) ?? "alle",
    abonnement: STATS_TIERS.find((t) => t.value === filter.tier)?.label,
    brugere_i_filter: stats.scopeUserCount,
    nøgletal_nu_mod_forrige_periode: stats.trends,
    abonnementer_nu: stats.tierSnapshot,
    fastholdelse: stats.retention,
    registreringer_pr_ugedag: stats.registrationsByWeekday,
    oprettelser_over_tid: stats.signups.map((p) => ({ tid: p.label, ...p.values })),
    registreringer_over_tid: stats.registrations.map((p) => ({ tid: p.label, ...p.values })),
    top_loggede: stats.top.logged.slice(0, 8),
    top_hellofresh: stats.hellofresh.topLogged.slice(0, 8),
    søgninger_uden_resultat: stats.top.misses.slice(0, 8),
    login_metoder: stats.loginsByMethod,
  };

  const model = process.env.OPENAI_STATS_MODEL?.trim() || getProductVisionModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Du er dataanalytiker for kalorie-appen Hello Cal. Skriv på dansk en kort opsummering (maks. 8 punkter, hvert punkt på egen linje startende med '• ') af de vigtigste ændringer og mønstre i brugsadfærden ud fra de aggregerede tal. Sammenlign med forrige periode, nævn konkrete tal, peg på mulige årsager og 1-2 konkrete handlinger. Opfind ikke data; sig det, hvis datagrundlaget er for lille.",
            },
          ],
        },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(payload) }] },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Stats AI failed", response.status, await response.text());
    return NextResponse.json({ message: `OpenAI-kald fejlede (${response.status})` }, { status: 502 });
  }
  const data = (await response.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  const summary =
    data.output_text?.trim() ||
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((c) => c.type === "output_text" && c.text?.trim())
      ?.text?.trim();
  if (!summary) return NextResponse.json({ message: "Intet svar fra OpenAI" }, { status: 502 });
  return NextResponse.json({ summary });
}
