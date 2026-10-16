import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Miniaturer via /_next/image (src/lib/image-thumb.ts): disk-cachen i
  // containeren holdes under 1 GB i stedet for halvdelen af den ledige plads.
  images: {
    maximumDiskCacheSize: 1_000_000_000,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
      // Next serverer public-filer med "max-age=0", så browseren spurgte
      // serveren for hvert eneste billede ved hver visning. En time i
      // browseren (som fallback-routen i src/lib/public-volume-file.ts);
      // derefter 304 via ETag. "private": mappen rummer også brugernes fotos.
      ...["/product-images/:path*", "/hellofresh-images/:path*", "/brand-logos/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, max-age=3600" }],
      })),
      // Faste designfiler (ikoner, flag, logoer, betalingsmærker) skifter aldrig
      // indhold under samme navn: gem dem i et år og spørg ikke igen. Ikon-
      // mapperne animals/body-measurements er adgangsmur-billeder og undtaget.
      ...[
        "/icons/:path((?!animals|body-measurements).*)",
        "/flags/:path*",
        "/integrations/:path*",
        "/payment/:path*",
        "/certifications/:path*",
        "/hello-cal-logo:rest(.*)",
        "/hello-cal-fruit:rest(.*)",
        "/flag-:rest(.*)",
        "/apple-icon:rest(.*)",
        "/favicon:rest(.*)",
      ].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      })),
    ];
  },
};

export default nextConfig;
