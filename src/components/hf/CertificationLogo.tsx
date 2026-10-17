import type { Certification } from "@/lib/product-certifications";
import { certificationImageForKind } from "@/lib/certification-images";

const LABELS: Record<Certification, string> = {
  organic: "Økologisk",
  keyhole: "Nøglehulsmærket",
  fairtrade: "Fairtrade",
  msc: "MSC",
};

// Kun Peters egne certifikat-billeder; aldrig tegnede mærker.
export function CertificationLogo({ certification, size = 44 }: { certification: Certification; size?: number }) {
  const label = LABELS[certification];
  const image = certificationImageForKind(certification, label);
  if (!image) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={label} title={label} width={size} height={size} style={{ width: size, height: size }} className="object-contain" />
  );
}
