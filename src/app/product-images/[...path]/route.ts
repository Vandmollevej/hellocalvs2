import { servePublicVolumeFile } from "@/lib/public-volume-file";

// Fallback for billeder lagt i volumen efter app-start, se src/lib/public-volume-file.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return servePublicVolumeFile("product-images", (await params).path);
}