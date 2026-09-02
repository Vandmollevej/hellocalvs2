import Image from "next/image";

const PROVIDER_BG: Record<"google" | "apple" | "facebook", string> = {
  google: "#4285F4",
  apple: "#232323",
  facebook: "#00178C",
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
      className="grid h-12 w-full items-center overflow-hidden rounded-[8px] text-hf-white"
      style={{ gridTemplateColumns: "47px 1fr 47px", background: PROVIDER_BG[provider] }}
    >
      <span
        className="flex h-full items-center justify-center"
        style={provider === "google" ? { background: "var(--hf-white)" } : undefined}
      >
        <Image src={`/icon-${provider}.png`} alt="" width={20} height={20} />
      </span>
      <span className="hf-type-button col-start-2 text-hf-white">{label}</span>
    </button>
  );
}
