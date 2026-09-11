// The one shared "weight" icon: a bathroom (body) scale, never a kitchen/
// balance scale. Use this everywhere a weight icon appears — do not fall
// back to @tabler/icons-react's IconScale (a balance scale) for weight.
export function IconBathScale({
  size = 20,
  className = "",
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 12l1.6 -1.6" />
    </svg>
  );
}
