// Oversætter produkttekst fra Open Food Facts til dansk (admin godkender
// bagefter, se PendingProductCard). Oversætter kun den givne tekst ordret.
export async function translateToDanish(
  fields: { name: string; ingredients: string | null },
): Promise<{ name: string; ingredients: string | null } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
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
              "Du oversætter fødevaretekst til dansk. Oversæt kun den givne tekst ordret — tilføj eller gæt aldrig noget, " +
              "bevar procenttal, E-numre, allergen-fremhævninger og kommaseparering. Behold mærkenavne uoversat. " +
              'Svar som JSON: {"name": string, "ingredients": string|null}.',
          },
          { role: "user", content: JSON.stringify({ name: fields.name, ingredients: fields.ingredients }) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "null");
    if (!parsed || typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    return {
      name: parsed.name.trim(),
      ingredients: typeof parsed.ingredients === "string" && parsed.ingredients.trim() ? parsed.ingredients.trim() : null,
    };
  } catch (error) {
    console.error("Danish translation failed", error);
    return null;
  }
}
