// Madvarer-sidens sidst hentede "Mest brugte" + bogmærker, gemt i browseren,
// så siden tegner listen i første billede ved næste besøg og opdaterer den
// stille bagefter — i stedet for skelet-bokse og så indhold i to trin.
// Gemmes med profilens id: en anden profil (familie) eller bruger på samme
// enhed ser aldrig en andens liste.

export type FoodsProduct = {
  id: string;
  name: string;
  // Kun på søgeresultater: "Brand Subbrand Navn" (src/lib/search-result-title.ts).
  searchTitle?: string;
  imageUrl: string | null;
  kcalPer100g: number;
  brand: { name: string } | null;
  // Vare uden energitabel: kcalPer100g = 0 er en pladsholder.
  nutritionMissing?: boolean;
};

export type FoodsSnapshot = {
  profileId: string;
  products: FoodsProduct[];
  favoriteIds: string[];
};

const STORAGE_KEY = "hf:foods:snapshot";

export function readFoodsSnapshot(profileId: string): FoodsSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FoodsSnapshot;
    if (parsed.profileId !== profileId || !Array.isArray(parsed.products) || !Array.isArray(parsed.favoriteIds)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeFoodsSnapshot(snapshot: FoodsSnapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}
