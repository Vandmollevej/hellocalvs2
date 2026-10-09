import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";

// POST /api/dishes/ocr-handwriting — { image: data-URL }
//
// Scan under Retter: telefonen afgør straks, om en side er håndskrift (lav
// OCR-sikkerhed). Håndskrift sendes direkte hertil og læses af OpenAI; trykt
// tekst læses af telefonens egen OCR og kommer aldrig her. Returnerer kun den
// aflæste tekst — intet gemmes.

const MAX_IMAGE_CHARS = 8_000_000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = typeof body?.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ message: "Ugyldigt billede" }, { status: 400 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "AI-nøgle mangler" }, { status: 503 });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Du læser en håndskrevet opskrift på et billede. Skriv teksten ordret af, på samme sprog, " +
              "med overskrifterne Ingredienser og Fremgangsmåde på hver sin linje, når de findes, " +
              "og én ingrediens eller ét trin pr. linje. Find ikke på noget, og svar kun med teksten.",
          },
          { role: "user", content: [{ type: "image_url", image_url: { url: image } }] },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Handwriting OCR failed", error);
    return NextResponse.json({ message: "Aflæsningen fejlede" }, { status: 503 });
  }
}
