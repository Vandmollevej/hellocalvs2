import Image from "next/image";

// Udbydernes officielle farver er tokens i globals.css (design.md §6.3).
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
      className={`hf-control hf-social-login hf-social-login--${provider}`}
    >
      <span className="flex h-full items-center justify-center">
        <Image src={`/icon-${provider}.png`} alt="" width={20} height={20} />
      </span>
      <span className="hf-type-button col-start-2 text-hf-white">{label}</span>
    </button>
  );
}
