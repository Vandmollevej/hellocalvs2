import type { Certification } from "@/lib/product-certifications";

// Mærke-logoer på produktcirklen (udledt af varenavnet); filerne ligger i public/certifications.
const LOGOS: Record<Certification, { label: string; file: string }> = {
  organic: { label: "Økologisk", file: "oekologimaerket.png" },
  keyhole: { label: "Nøglehulsmærket", file: "noeglehul.png" },
  fairtrade: { label: "Fairtrade", file: "fairtrade.png" },
  msc: { label: "MSC", file: "msc.png" },
};

export function CertificationLogo({ certification, size = 30 }: { certification: Certification; size?: number }) {
  const logo = LOGOS[certification];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/certifications/${logo.file}`}
      alt={logo.label}
      title={logo.label}
      className="block"
      style={{ height: size, width: "auto" }}
    />
  );
}
