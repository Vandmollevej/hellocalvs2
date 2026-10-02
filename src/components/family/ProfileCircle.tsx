import { initialsOf } from "@/lib/initials";

// Profilcirkel med initialer (samme udtryk som den tidligere faste "PT").
export function ProfileCircle({
  name,
  size = 32,
  tone = "appbar",
  className = "",
}: {
  name: string;
  size?: number;
  // "card": på kortfarven (#EEE9DF) ville den almindelige cirkel forsvinde,
  // så den får sidefarven og en tynd kant.
  // "brand": grøn cirkel med hvide initialer (store profilcirkel på Profil).
  tone?: "appbar" | "card" | "brand";
  className?: string;
}) {
  const toneClass =
    tone === "brand"
      ? "bg-hf-green text-white"
      : tone === "card"
        ? "border border-hf-gray-border bg-hf-cream text-hf-black"
        : "bg-hf-tan text-hf-black";
  return (
    <span
      className={`userback-ignore userback-block hf-type-strong flex shrink-0 items-center justify-center rounded-full ${toneClass} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.375) }}
    >
      {initialsOf(name)}
    </span>
  );
}
