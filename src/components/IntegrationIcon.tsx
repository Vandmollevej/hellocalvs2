// Integrationens logo. Mærker uden logo endnu (icon = null) får et felt med
// forbogstavet, indtil brugeren lægger et logo i public/integrations/.
export function IntegrationIcon({ icon, label, size, className = "" }: { icon: string | null; label: string; size: number; className?: string }) {
  if (icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`hf-type-body hf-type-strong flex shrink-0 items-center justify-center bg-hf-white text-hf-black ${className}`}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
