export function TextField({
  label,
  variant = "auth",
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  variant?: "auth" | "standard";
}) {
  const input = (
    <input
      {...props}
      // Højden ejes af .hf-field (48 px); kant og radius er tokens.
      className={`hf-field hf-type-input w-full border border-hf-field-border bg-hf-page outline-none ${
        variant === "auth" ? "rounded-sm px-3" : "rounded-card px-4"
      } ${className}`}
    />
  );

  if (!label) return input;

  return (
    <label className="flex flex-col gap-1">
      <span className="hf-type-label">{label}</span>
      {input}
    </label>
  );
}
