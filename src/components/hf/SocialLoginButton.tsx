import Image from "next/image";

// Udbydernes officielle farver er tokens i globals.css (design.md §6.3).
const PROVIDER_BG: Record<"google" | "apple" | "facebook", string> = {
  google: "var(--hf-color-google)",
  apple: "var(--hf-color-action)",
  facebook: "var(--hf-color-facebook)",
};

export function SocialLoginButton({
  provider,
  label,
  onClick,
}: {
  provider: "google" | "apple" | "facebook";
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hf-control grid w-full items-center overflow-hidden text-hf-white rounded-card"
      style={{ gridTemplateColumns: "47px 1fr 47px", background: PROVIDER_BG[provider] }}
    >
      <span className="flex h-full items-center justify-center">
        <Image src={`/icon-${provider}.png`} alt="" width={20} height={20} />
      </span>
      <span className="hf-type-button col-start-2 text-hf-white">{label}</span>
    </button>
  );
}
