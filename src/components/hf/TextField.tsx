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
      className={`hf-type-input w-full border bg-hf-cream outline-none ${
        variant === "auth" ? "h-12 rounded-[4px] px-3" : "h-12 rounded-[8px] px-4"
      } ${className}`}
      style={{ borderColor: "var(--hf-color-field-border)" }}
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
