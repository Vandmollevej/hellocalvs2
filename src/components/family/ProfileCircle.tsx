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
  tone?: "appbar" | "card";
  className?: string;
}) {
  const toneClass = tone === "card" ? "border border-hf-gray-border bg-hf-cream" : "bg-hf-tan";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-hf-black ${toneClass} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.375) }}
    >
      {initialsOf(name)}
    </span>
  );
}
