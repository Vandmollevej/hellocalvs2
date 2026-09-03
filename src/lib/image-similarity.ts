// Letvægts, ikke-AI billedmatching (average-hash) — bruges kun for det
// tekstløse spor i /camera/create (fx en fersken uden tekst på billedet), som
// et gratis første forsøg før AI-vision-fallback. Kører i browseren via
// canvas, så ingen server-side billedafkodning er nødvendig.
//
// Kendt begrænsning: billeder hostet på et andet domæne uden permissive
// CORS-headers (fx nogle Open Food Facts-billeder) kan gøre canvas'et
// "tainted", så pixel-data ikke kan læses. Sådanne kandidater springes
// stiltiende over — se catch i hashImageUrl.

const HASH_SIZE = 8; // 8x8 gråtoner = 64-bit hash

// BigInt-literaler ("0n") kræver tsconfig target >= ES2020 (projektet bruger
// ES2017); BigInt(...)-funktionskaldet virker uændret på ethvert target.
const ZERO = BigInt(0);
const ONE = BigInt(1);

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hashFromImage(img: HTMLImageElement): bigint {
  const canvas = document.createElement("canvas");
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return ZERO;
  ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
  const { data } = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);

  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }
  const avg = gray.reduce((sum, v) => sum + v, 0) / gray.length;

  let hash = ZERO;
  for (let i = 0; i < gray.length; i += 1) {
    hash = (hash << ONE) | (gray[i] >= avg ? ONE : ZERO);
  }
  return hash;
}

export async function hashImageUrl(src: string): Promise<bigint | null> {
  try {
    const img = await loadImage(src);
    return hashFromImage(img);
  } catch {
    return null;
  }
}

function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > ZERO) {
    count += Number(x & ONE);
    x >>= ONE;
  }
  return count;
}

// 0 (helt forskellige) til 1 (identiske) ud fra 64-bit average-hash.
export function hashSimilarity(a: bigint, b: bigint): number {
  const totalBits = HASH_SIZE * HASH_SIZE;
  return 1 - hammingDistance(a, b) / totalBits;
}

export async function bestImageMatch<T>(
  photoDataUrl: string,
  candidates: T[],
  imageUrl: (candidate: T) => string | null,
  threshold = 0.85
): Promise<{ candidate: T; score: number } | null> {
  const queryHash = await hashImageUrl(photoDataUrl);
  if (queryHash === null) return null;

  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const url = imageUrl(candidate);
    if (!url) continue;
    const hash = await hashImageUrl(url);
    if (hash === null) continue;
    const score = hashSimilarity(queryHash, hash);
    if (!best || score > best.score) best = { candidate, score };
  }
  return best && best.score >= threshold ? best : null;
}
