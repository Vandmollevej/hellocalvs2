"use client";

import { useRouter } from "next/navigation";

// Sortering og visning er altid en dropdown, aldrig knapper. Bruges på
// serversider, hvor valget er en adresse (docs/REGLER.md).
export function LinkSelect({ label, value, options }: { label: string; value: string; options: { value: string; label: string; href: string }[] }) {
  const router = useRouter();
  return (
    <label className="hf-type-caption flex items-center gap-2">
      {label}
      <select
        value={value}
        onChange={(event) => {
          const option = options.find((entry) => entry.value === event.target.value);
          if (option) router.push(option.href);
        }}
        className="hf-input hf-input--compact"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
