import type { Certification } from "@/lib/product-certifications";

// Forenklede mærke-logoer til varesiden; label bruges som tilgængelig tekst.
const LOGOS: Record<Certification, { label: string; bg: string; fg: string; text: string }> = {
  organic: { label: "Økologisk", bg: "#D2232A", fg: "#FFFFFF", text: "Ø" },
  keyhole: { label: "Nøglehulsmærket", bg: "#00843D", fg: "#FFFFFF", text: "⚲" },
  fairtrade: { label: "Fairtrade", bg: "#00B9E4", fg: "#000000", text: "FT" },
  msc: { label: "MSC", bg: "#005DAA", fg: "#FFFFFF", text: "MSC" },
};

export function CertificationLogo({ certification, size = 44 }: { certification: Certification; size?: number }) {
  const logo = LOGOS[certification];
  return (
    <span
      role="img"
      aria-label={logo.label}
      title={logo.label}
      className="flex items-center justify-center rounded-full font-bold ring-2 ring-hf-white"
      style={{ width: size, height: size, background: logo.bg, color: logo.fg, fontSize: size * (logo.text.length > 1 ? 0.3 : 0.5) }}
    >
      {logo.text}
    </span>
  );
}
