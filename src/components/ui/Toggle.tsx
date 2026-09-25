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
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  // Accessible name when the switch sits bare inside a caller's own row
  // (no `label`, so no card).
  ariaLabel?: string;
}) {
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full text-left transition-colors disabled:opacity-50 ${
        checked ? "bg-hf-green" : "bg-hf-tan-dark"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  if (!label) return switchEl;

  // Kortet er den fælles .hf-card; labelen og kontakten centreres lodret mod
  // hinanden, så teksten aldrig står højere end knappen.
  return (
    <div className="hf-card">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[15px] font-medium text-hf-black">{label}</span>
        {switchEl}
      </div>
      {description && (
        <span className="mt-2 block border-t border-hf-gray-light pt-2 text-[12px] text-hf-black opacity-60">
          {description}
        </span>
      )}
    </div>
  );
}
