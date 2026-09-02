"use client";

// Standing rule (docs/DECISIONS.md 2026-09-02): checkboxes must never be used
// in this app. Every on/off preference is a right-aligned iOS-style toggle —
// use this component instead of a native <input type="checkbox">.
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-hf-green" : "bg-hf-tan-dark"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  if (!label) return switchEl;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-4">
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-hf-black">{label}</span>
        {description && (
          <span className="block text-[12px] text-hf-black opacity-60">{description}</span>
        )}
      </span>
      {switchEl}
    </div>
  );
}
