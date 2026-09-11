import type { MetadataRoute } from "next";

// Lader Hello Cal installeres som en rigtig standalone-app (Tilføj til
// hjemmeskærm), så vores egen grønne header kan strække sig bag telefonens
// statusbjælke ligesom HelloFresh's native app, i stedet for at ligge under
// browserens egen adresse-/statuslinje. Se design.md §6.1 og
// docs/DECISIONS.md (2026-09-11).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hello Cal",
    short_name: "Hello Cal",
    description: "Kalorie- og måltidsregistrering",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F3",
    theme_color: "#067A46",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
