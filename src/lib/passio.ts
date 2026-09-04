// Passio Nutrition-AI client: exchanges PASSIO_API_KEY for a bearer token
// (cached in memory, valid ~24h) and calls the meal-photo recognition
// endpoint. Used only by /api/ai/analyze-meal-photo for the "Måltid"
// camera flow (mode=meal) — HelloFresh recipes are matched locally instead
// (/api/ai/recognize-hellofresh) and never call Passio.

const TOKEN_URL = "https://api.passiolife.com/v2/token-cache/unified/oauth/token";
const API_BASE = "https://api.passiolife.com/v2/products";

type PassioToken = { accessToken: string; customerId: string; expiresAt: number };

let cachedToken: PassioToken | null = null;

async function getToken(): Promise<PassioToken> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken;

  const apiKey = process.env.PASSIO_API_KEY;
  if (!apiKey) throw new Error("PASSIO_API_KEY er ikke sat");

  const res = await fetch(`${TOKEN_URL}/${apiKey}`, { method: "POST" });
  if (!res.ok) throw new Error(`Passio token-kald fejlede (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number; customer_id: string };
  cachedToken = {
    accessToken: data.access_token,
    customerId: data.customer_id,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken;
}

export type PassioIngredient = {
  ingredientName: string;
  weightGrams: number;
  nutritionPreview: { calories: number; protein: number; fat: number; carbs: number; servingWeight: number };
  refCode: string;
};

export async function recognizeMealPhoto(photoDataUrl: string): Promise<PassioIngredient[]> {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/napi/tools/vision/extractIngredientsAutoTyped`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.accessToken}`,
      "Passio-ID": token.customerId,
    },
    body: JSON.stringify({ image: photoDataUrl }),
  });

  if (res.status === 401) {
    // Token may have been revoked/expired early server-side — drop the cache
    // so the next call re-authenticates instead of failing repeatedly.
    cachedToken = null;
    throw new Error("Passio-token afvist (401)");
  }
  if (!res.ok) throw new Error(`Passio-billedgenkendelse fejlede (${res.status}): ${await res.text()}`);

  return (await res.json()) as PassioIngredient[];
}
