import { IconChevronDown } from "@tabler/icons-react";

// Shared card for the select-type settings (Region, Sprog) so they stay
// visually identical.
export function SetupSelectCard({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-hf-tan px-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="hf-type-body hf-type-strong block text-hf-black">{label}</span>
        <span className="hf-type-small block text-hf-black opacity-60">{description}</span>
      </span>
      <div className="relative shrink-0">
        <select
          className="hf-type-body appearance-none rounded-xl border border-hf-tan-dark bg-white py-2 pl-3 pr-8 text-hf-black"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={14}
          stroke={2.5}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hf-black"
        />
      </div>
    </label>
  );
}
